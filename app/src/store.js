import { create } from 'zustand';
import { desks, loungeSpots, couchSeats } from './layout.js';
import { findPath } from './pathfinding.js';
import { computeSky } from './sun.js';
import { alarmSound } from './sound.js';

// Har kadrda o'zgaradigan pozitsiyalar store'da emas, shu yerda turadi.
export const positions = {};

const BASE = [
  { id: 'manager', name: 'Manager', role: 'Asosiy Claude', color: '#e0a03a' },
  { id: 'backend', name: 'Backend', role: 'API va baza', color: '#3b82c4' },
  { id: 'frontend', name: 'Frontend', role: 'Interfeys', color: '#b05cc2' },
  { id: 'devops', name: 'DevOps', role: 'Deploy va CI', color: '#2f9e64' },
];
const EXTRA_COLORS = ['#e8684a', '#17a2b8', '#8a6d3b', '#6f42c1'];
const SPARE = ['spare1', 'spare2', 'spare3', 'spare4'];
export const BAD = new Set(['down', 'unhealthy', 'restarting']);
const PANIC_MS = 7000;

const makeAgent = (a, i, inLounge) => {
  const deskId = a.deskId ?? a.id;
  const start = inLounge && a.id !== 'manager' ? loungeSpots[i % loungeSpots.length] : desks[deskId].seat;
  positions[a.id] = { x: start[0], z: start[1], rot: Math.PI };
  return {
    ...a, deskId, index: i,
    state: inLounge && a.id !== 'manager' ? 'idle' : 'working',
    task: inLounge ? '' : 'Ish boshlanmoqda',
    bubble: '', bubbleUntil: 0, bubbleKind: '',
    path: [], pathId: 0, after: null,
    log: [],
    alarm: null, // { until, text }
    down: null, // { service, reason }
    errors: 0,
    resume: null,
    calmState: 'idle',
  };
};
const initialAgents = (inLounge) => Object.fromEntries(BASE.map((a, i) => [a.id, makeAgent(a, i, inLounge)]));
const stamp = () => new Date().toLocaleTimeString('uz-UZ', { hour12: false });
const calmTimers = {};

export const useOffice = create((set, get) => ({
  mode: 'sim',
  conn: 'off',
  selected: null,
  agents: initialAgents(false),
  feed: [],
  services: {},
  project: '',
  muted: false,
  themeMode: 'auto', // 'auto' | 'day' | 'night'
  timeOffsetH: 0,
  sky: computeSky(30, 20),
  sunInfo: null,

  setMode: (mode) => set({ mode, agents: initialAgents(mode === 'live'), feed: [], services: {}, selected: null }),
  setConn: (conn) => set({ conn }),
  setThemeMode: (themeMode) => set({ themeMode, timeOffsetH: 0 }),
  setTimeOffset: (timeOffsetH) => set({ timeOffsetH }),
  toggleMute: () => set({ muted: !get().muted }),
  select: (id) => set({ selected: get().selected === id ? null : id }),

  ensureAgent: (id) => {
    const { agents } = get();
    if (agents[id]) return agents[id];
    const n = Object.keys(agents).length;
    const used = new Set(Object.values(agents).map((a) => a.deskId));
    const deskId = SPARE.find((s) => !used.has(s)) ?? 'spare1';
    const a = makeAgent({ id, name: id, role: 'Sub-agent', color: EXTRA_COLORS[n % EXTRA_COLORS.length], deskId }, n, true);
    set({ agents: { ...agents, [id]: a } });
    return a;
  },

  patch: (id, p) => set((s) => (s.agents[id] ? { agents: { ...s.agents, [id]: { ...s.agents[id], ...p } } } : s)),
  isPanicking: (id) => { const a = get().agents[id]; return !!a?.alarm && a.alarm.until > Date.now(); },

  // Agentni katakka yuborish. Vahimadagi agent avval tinchlanadi, ishlamay qolgani joyidan qimirlamaydi.
  goTo: (id, cell, after = { state: 'idle' }, force = false) => {
    const a = get().agents[id];
    const pos = positions[id];
    if (!a || !pos) return;
    if (!force && a.down) return;
    if (!force && get().isPanicking(id)) { get().patch(id, { resume: { cell, after } }); return; }
    const path = findPath([pos.x, pos.z], cell);
    get().patch(id, { path, pathId: a.pathId + 1, state: 'walking', after });
  },
  goToDesk: (id, after = { state: 'working' }) => {
    const a = get().agents[id];
    if (a) get().goTo(id, desks[a.deskId].seat, { face: 'desk', ...after });
  },
  arrived: (id) => {
    const a = get().agents[id];
    if (!a) return;
    get().patch(id, { path: [], state: a.after?.state ?? 'idle', after: null });
  },
  // Holatni o'rnatish (vahima paytida — vahimadan keyin qo'llanadi)
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
        agents: { ...s.agents, [id]: { ...a, log: [entry, ...a.log].slice(0, 40) } },
        feed: [{ ...entry, who: a.name, color: a.color }, ...s.feed].slice(0, 80),
      };
    });
  },

  // ---------- Nosozliklar ----------
  panic: (id, text, source = '') => {
    const s = get();
    s.ensureAgent(id);
    const a = get().agents[id];
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

  // Xizmat (konteyner, terminal, log fayl) holati o'zgardi
  setService: (ev) => {
    const prev = get().services[ev.id];
    set({ services: { ...get().services, [ev.id]: { ...ev, at: Date.now() } } });
    const id = ev.agent || 'devops';
    get().ensureAgent(id);
    const icon = ev.kind === 'docker' ? '🐳' : ev.kind === 'terminal' ? '⌨' : '📄';
    if (!prev || prev.state !== ev.state) get().log(id, `${icon} ${ev.name}: ${ev.state}${ev.detail ? ` (${ev.detail})` : ''}`, BAD.has(ev.state) ? 'error' : 'info', ev.name);
    get().recomputeDown(id, ev);
  },
  recomputeDown: (id, trigger) => {
    const bad = Object.values(get().services).filter((sv) => (sv.agent || 'devops') === id && BAD.has(sv.state));
    const a = get().agents[id];
    if (!a) return;
    if (bad.length && !a.down) {
      const sv = bad[0];
      const why = sv.state === 'unhealthy' ? 'sog‘lom emas' : sv.state === 'restarting' ? 'qayta-qayta yiqilmoqda' : 'to‘xtadi';
      get().patch(id, { down: { service: sv.name, reason: why }, alarm: null, path: [], resume: null });
      get().say(id, `💥 ${sv.name} ${why}`, 6000, 'error');
      if (!get().muted) alarmSound();
      const seat = couchSeats[a.index % couchSeats.length];
      get().goTo(id, seat, { face: 'desk', state: 'down' }, true);
    } else if (!bad.length && a.down) {
      get().patch(id, { down: null });
      get().say(id, `✅ ${trigger?.name ?? 'xizmat'} yana ishlayapti`, 4000, 'ok');
      get().goToDesk(id, { state: get().mode === 'sim' ? 'working' : 'idle' });
    } else if (bad.length && a.down && a.down.service !== bad[0].name) {
      get().patch(id, { down: { ...a.down, service: bad[0].name } });
    }
  },
}));
