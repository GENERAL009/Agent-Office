import { create } from 'zustand';
import { buildLayout, kindOf, KIND_COLOR, prettyName } from './layout.js';
import { findPath } from './pathfinding.js';
import { computeSky } from './sun.js';
import { alarmSound } from './sound.js';

// Har kadrda o'zgaradigan pozitsiyalar store'da emas, shu yerda turadi (to'r koordinatalarida).
export const positions = {};

export const DEFAULT_TEAM = [
  { id: 'backend', name: 'Backend', kind: 'backend' },
  { id: 'frontend', name: 'Frontend', kind: 'frontend' },
  { id: 'devops', name: 'DevOps', kind: 'devops' },
];
const EXTRA = ['#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444', '#22c55e', '#06b6d4'];
export const BAD = new Set(['down', 'unhealthy', 'restarting']);
const PANIC_MS = 7000;

export const normTeam = (team) => team.map((r, i) => {
  const kind = r.kind || kindOf(r.id);
  return { ...r, kind, name: r.name || prettyName(r.id), color: r.color || KIND_COLOR[kind] || EXTRA[i % EXTRA.length] };
});

function makeAgent(def, L, index, inLounge) {
  const deskId = def.id === 'manager' ? 'manager' : (L.desks[def.id] ? def.id : null);
  const spots = L.lounge.spots;
  const start = def.spawn ?? (inLounge && def.id !== 'manager' ? spots[index % spots.length] : L.desks[deskId]?.seat ?? spots[0]);
  positions[def.id] = { x: start[0], z: start[1], rot: Math.PI };
  return {
    id: def.id, name: def.name, role: def.role ?? def.kind, color: def.color, kind: def.kind,
    deskId, index,
    state: inLounge && def.id !== 'manager' ? 'idle' : 'working',
    task: inLounge ? '' : 'Ish boshlanmoqda',
    bubble: '', bubbleUntil: 0, bubbleKind: '',
    path: [], pathId: 0, after: null,
    log: [], alarm: null, down: null, errors: 0, resume: null, calmState: 'idle',
  };
}

function agentsFor(team, L, inLounge) {
  const defs = [{ id: 'manager', name: 'Manager', kind: 'manager', color: '#e0a03a', role: 'Asosiy Claude' }, ...team];
  return Object.fromEntries(defs.map((d, i) => [d.id, makeAgent(d, L, i, inLounge)]));
}

const stamp = () => new Date().toLocaleTimeString('uz-UZ', { hour12: false });
const calmTimers = {};
const initialTeam = normTeam(DEFAULT_TEAM);
const initialLayout = buildLayout(initialTeam);

export const useOffice = create((set, get) => ({
  mode: 'sim',
  conn: 'off',
  selected: null,
  team: initialTeam,
  layout: initialLayout,
  agents: agentsFor(initialTeam, initialLayout, false),
  feed: [],
  services: {},
  project: '',
  muted: false,
  themeMode: 'auto',
  timeOffsetH: 0,
  sky: computeSky(30, 20),
  sunInfo: null,
  // boshliq rejimi
  boss: false,
  bossName: (() => { try { return localStorage.getItem('agent-office-boss') || 'Boshliq'; } catch { return 'Boshliq'; } })(),
  nearScreen: null, // { kind: 'desk'|'services'|'feed', id, label }
  screenOpen: false,

  setMode: (mode) => {
    const L = get().layout;
    set({ mode, agents: agentsFor(get().team, L, mode === 'live'), feed: [], services: {}, selected: null });
  },
  setConn: (conn) => set({ conn }),
  setThemeMode: (themeMode) => set({ themeMode, timeOffsetH: 0 }),
  setTimeOffset: (timeOffsetH) => set({ timeOffsetH }),
  toggleMute: () => set({ muted: !get().muted }),
  select: (id) => set({ selected: get().selected === id ? null : id }),
  setBoss: (boss) => set({ boss, screenOpen: false, nearScreen: null, selected: null }),
  setBossName: (bossName) => { try { localStorage.setItem('agent-office-boss', bossName); } catch {} set({ bossName }); },
  setNearScreen: (nearScreen) => set({ nearScreen, ...(nearScreen ? {} : { screenOpen: false }) }),
  setScreenOpen: (screenOpen) => set({ screenOpen }),

  // Jamoa o'zgardi (server, sozlama yoki yangi agent paydo bo'ldi): faqat qo'shamiz
  setTeam: (incoming, { spawnAtEntrance = true, replace = false } = {}) => {
    if (replace) {
      // birinchi yuklash: jamoa aynan loyihadagidek bo'ladi (standart rollar olib tashlanadi)
      const team = normTeam(incoming.filter((r) => r.id !== 'manager'));
      const same = team.map((r) => r.id).join() === get().team.map((r) => r.id).join();
      if (same) { set({ team: get().team.map((c) => ({ ...c, ...team.find((t) => t.id === c.id) })) }); return; }
      const L = buildLayout(team);
      set({ team, layout: L, agents: agentsFor(team, L, get().mode === 'live'), services: {}, selected: null });
      return;
    }
    const cur = get().team;
    const add = normTeam(incoming.filter((r) => r.id !== 'manager' && !cur.some((c) => c.id === r.id)));
    const updated = cur.map((c) => { const n = incoming.find((r) => r.id === c.id); return n ? { ...c, ...normTeam([n])[0] } : c; });
    if (!add.length && JSON.stringify(updated) === JSON.stringify(cur)) return;
    const team = [...updated, ...add];
    const L = buildLayout(team);
    const agents = { ...get().agents };
    let n = Object.keys(agents).length;
    for (const r of add) {
      agents[r.id] = makeAgent({ ...r, spawn: spawnAtEntrance ? [1, 10 + (n % 2)] : undefined }, L, n++, true);
    }
    // nomi/rangi yangilanganlar
    for (const r of updated) if (agents[r.id]) agents[r.id] = { ...agents[r.id], name: r.name, color: r.color, kind: r.kind, deskId: L.desks[r.id] ? r.id : agents[r.id].deskId };
    set({ team, layout: L, agents });
    // yangi xodimlar eshikdan kirib, o'z xonasiga boradi
    for (const r of add) {
      get().say(r.id, `Salom! Men ${r.name} 👋`, 3500, 'ok');
      get().log(r.id, `Jamoaga qo'shildi: ${r.name}`);
      setTimeout(() => get().goToDesk(r.id, { state: 'idle' }), 600);
    }
  },

  // Noma'lum agent paydo bo'lsa — jamoaga qo'shamiz (bino kengayadi)
  ensureAgent: (id) => {
    if (!id) return null;
    if (!get().agents[id]) get().setTeam([...get().team, { id }]);
    return get().agents[id];
  },

  patch: (id, p) => set((s) => (s.agents[id] ? { agents: { ...s.agents, [id]: { ...s.agents[id], ...p } } } : s)),
  isPanicking: (id) => { const a = get().agents[id]; return !!a?.alarm && a.alarm.until > Date.now(); },

  goTo: (id, cell, after = { state: 'idle' }, force = false) => {
    const a = get().agents[id];
    const pos = positions[id];
    if (!a || !pos) return;
    if (!force && a.down) return;
    if (!force && get().isPanicking(id)) { get().patch(id, { resume: { cell, after } }); return; }
    const path = findPath(get().layout, [pos.x, pos.z], cell);
    get().patch(id, { path, pathId: a.pathId + 1, state: 'walking', after });
  },
  goToDesk: (id, after = { state: 'working' }) => {
    const a = get().agents[id];
    const d = a && get().layout.desks[a.deskId];
    if (d) get().goTo(id, d.seat, { face: 'desk', ...after });
  },
  goToLounge: (id, after = { state: 'idle' }) => {
    const a = get().agents[id];
    if (!a) return;
    const spots = get().layout.lounge.spots;
    get().goTo(id, spots[a.index % spots.length], after);
  },
  arrived: (id) => {
    const a = get().agents[id];
    if (a) get().patch(id, { path: [], state: a.after?.state ?? 'idle', after: null });
  },
  setState: (id, state) => {
    const a = get().agents[id];
    if (!a || a.down) return;
    if (get().isPanicking(id)) { get().patch(id, { calmState: state }); return; }
    if (a.state === 'walking') get().patch(id, { after: { ...a.after, state } });
    else get().patch(id, { state });
  },

  say: (id, text, ms = 3500, kind = '') => get().patch(id, { bubble: text, bubbleUntil: Date.now() + ms, bubbleKind: kind }),

  log: (id, text, level = 'info', source = '') => {
    const time = stamp();
    set((s) => {
      const a = s.agents[id];
      if (!a) return s;
      const entry = { time, text, level, source };
      return {
        agents: { ...s.agents, [id]: { ...a, log: [entry, ...a.log].slice(0, 60) } },
        feed: [{ ...entry, who: a.name, color: a.color }, ...s.feed].slice(0, 100),
      };
    });
  },

  // ---------- Nosozliklar ----------
  panic: (id, text, source = '') => {
    get().ensureAgent(id);
    const s = get();
    const a = s.agents[id];
    if (!a) return;
    const was = s.isPanicking(id);
    const calmState = was ? a.calmState : (a.state === 'walking' ? (a.after?.state ?? 'idle') : a.state);
    const resume = was ? a.resume : (a.state === 'walking' && a.path.length ? { cell: a.path[a.path.length - 1], after: a.after } : null);
    s.patch(id, {
      alarm: { until: Date.now() + PANIC_MS, text },
      errors: a.errors + 1,
      calmState: a.down ? 'down' : calmState,
      resume,
      ...(a.down ? {} : { state: 'panic', path: [] }),
    });
    s.say(id, `🔥 ${text}`, 5000, 'error');
    s.log(id, text, 'error', source);
    if (!get().muted) alarmSound();
    clearTimeout(calmTimers[id]);
    calmTimers[id] = setTimeout(() => get().calm(id), PANIC_MS + 50);
  },
  calm: (id) => {
    const a = get().agents[id];
    if (!a || !a.alarm || a.alarm.until > Date.now()) return;
    get().patch(id, { alarm: null });
    if (a.down) return;
    if (a.resume) {
      get().patch(id, { resume: null, state: 'idle' });
      get().goTo(id, a.resume.cell, a.resume.after);
    } else {
      get().patch(id, { state: a.calmState === 'panic' ? 'idle' : a.calmState });
    }
  },
  clearErrors: (id) => get().patch(id, { errors: 0 }),

  setService: (ev) => {
    const id = ev.agent || 'devops';
    get().ensureAgent(id);
    const prev = get().services[ev.id];
    set({ services: { ...get().services, [ev.id]: { ...ev, agent: id, at: Date.now() } } });
    const icon = ev.kind === 'docker' ? '🐳' : ev.kind === 'terminal' ? '⌨' : '📄';
    if (!prev || prev.state !== ev.state) get().log(id, `${icon} ${ev.name}: ${ev.state}${ev.detail ? ` (${ev.detail})` : ''}`, BAD.has(ev.state) ? 'error' : 'info', ev.name);
    get().recomputeDown(id, ev);
  },
  recomputeDown: (id, trigger) => {
    const bad = Object.values(get().services).filter((sv) => sv.agent === id && BAD.has(sv.state));
    const a = get().agents[id];
    if (!a) return;
    if (bad.length && !a.down) {
      const sv = bad[0];
      const why = sv.state === 'unhealthy' ? 'sog‘lom emas' : sv.state === 'restarting' ? 'qayta-qayta yiqilmoqda' : 'to‘xtadi';
      get().patch(id, { down: { service: sv.name, reason: why }, alarm: null, path: [], resume: null });
      get().say(id, `💥 ${sv.name} ${why}`, 6000, 'error');
      if (!get().muted) alarmSound();
      const seats = get().layout.lounge.couchSeats;
      get().goTo(id, seats[a.index % seats.length], { face: 'desk', state: 'down' }, true);
    } else if (!bad.length && a.down) {
      get().patch(id, { down: null });
      get().say(id, `✅ ${trigger?.name ?? 'xizmat'} yana ishlayapti`, 4000, 'ok');
      get().goToDesk(id, { state: get().mode === 'sim' ? 'working' : 'idle' });
    } else if (bad.length && a.down && a.down.service !== bad[0].name) {
      get().patch(id, { down: { ...a.down, service: bad[0].name } });
    }
  },
}));
