import { create } from 'zustand';
import type { AgentDataAdapter, OfficeSnapshot } from '../core/adapter';
import type { Agent, AgentId, Lang, LogEntry, Message, OfficeEvent, Project, Task } from '../core/types';
import { uid } from '../core/types';
import { initialAgents } from '../core/agents';
import { SimulationAdapter } from '../core/simulation/SimulationAdapter';
import { PluginAdapter, replayUrl } from '../core/plugin/PluginAdapter';

/** Served by the Agent Office plugin (or replaying a recording): show its live Claude Code events by default. */
export const IN_PLUGIN = location.pathname.startsWith('/premium') || !!replayUrl();
import { detectLang } from '../core/simulation/dialogue';

export type ViewMode = 'overview' | 'life';
export type CameraStyle = 'third' | 'first';
export type PanelTab = 'overview' | 'tasks' | 'activity' | 'comms';
export type SourceKind = 'demo' | 'claude-code';
export type CameraPreset = 'overview' | 'workspace' | 'meeting' | 'manager' | 'lounge' | 'kitchen' | 'security';
export type Modal = null | 'whiteboard' | 'manager' | 'assign' | 'meeting';

interface OfficeState extends OfficeSnapshot {
  adapter: AgentDataAdapter;
  source: SourceKind;
  liveStatus: 'connecting' | 'open' | 'error' | null;
  speed: number;
  running: boolean;

  mode: ViewMode;
  cameraStyle: CameraStyle;
  preset: CameraPreset;
  presetNonce: number;
  /** A camera shot for recording video (id from scene/shots.ts), playing in Overview. */
  shot: string | null;
  selectedId: AgentId | null;
  tab: PanelTab;
  chatWith: AgentId | null;
  chatPending: boolean;
  modal: Modal;
  assignFor: AgentId | null;
  menuOpen: boolean;
  hint: string | null;
  voiceOn: boolean;
  dashboardOpen: boolean;

  dispatch(ev: OfficeEvent): void;
  setSource(kind: SourceKind): void;
  submitProject(title: string): void;
  assignTask(agent: AgentId, title: string): void;
  togglePause(agent: AgentId): void;
  ask(agent: AgentId, text: string): Promise<void>;

  setSpeed(x: number): void;
  setRunning(r: boolean): void;
  setLang(l: Lang): void;
  setMode(m: ViewMode): void;
  setCameraStyle(c: CameraStyle): void;
  goPreset(p: CameraPreset): void;
  playShot(id: string | null): void;
  select(id: AgentId | null, tab?: PanelTab): void;
  setTab(t: PanelTab): void;
  openChat(id: AgentId | null): void;
  openModal(m: Modal, assignFor?: AgentId | null): void;
  setMenu(open: boolean): void;
  setHint(h: string | null): void;
  setVoice(on: boolean): void;
  setDashboard(open: boolean): void;
}

const MAX_LOGS = 500;
const MAX_MESSAGES = 400;

function speak(text: string, lang: Lang) {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text.replace(/[✅"]/g, ''));
  u.lang = lang === 'uz' ? 'uz-UZ' : 'en-US';
  const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang === 'uz' ? 'uz' : 'en'));
  if (voice) u.voice = voice;
  u.rate = 1.05;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
  return u;
}

export const useOffice = create<OfficeState>((set, get) => {
  const blank = () => ({ agents: initialAgents(), tasks: {} as Record<string, Task>, projects: {} as Record<string, Project>, messages: [] as Message[], logs: [] as LogEntry[], activeProjectId: null as string | null });

  const ctx = {
    emit: (ev: OfficeEvent) => get().dispatch(ev),
    getState: (): OfficeSnapshot => {
      const s = get();
      return { agents: s.agents, tasks: s.tasks, projects: s.projects, messages: s.messages, logs: s.logs, activeProjectId: s.activeProjectId, lang: s.lang };
    },
  };

  const makeAdapter = (kind: SourceKind): AgentDataAdapter => {
    if (kind === 'demo') return new SimulationAdapter();
    const live = new PluginAdapter();
    live.onStatus = (st) => set({ liveStatus: st });
    return live;
  };

  const start: SourceKind = IN_PLUGIN ? 'claude-code' : 'demo';
  const adapter = makeAdapter(start);
  queueMicrotask(() => adapter.connect(ctx));

  return {
    ...blank(),
    lang: 'en',
    adapter,
    source: start,
    liveStatus: IN_PLUGIN ? 'connecting' : null,
    speed: 1,
    running: true,
    mode: 'overview',
    cameraStyle: 'third',
    preset: 'overview',
    presetNonce: 0,
    shot: null,
    selectedId: null,
    tab: 'overview',
    chatWith: null,
    chatPending: false,
    modal: null,
    assignFor: null,
    menuOpen: false,
    hint: null,
    voiceOn: false,
    dashboardOpen: true,

    dispatch(ev) {
      set((s) => {
        switch (ev.type) {
          case 'reset':
            return { ...blank() };
          case 'agent.patch': {
            const prev = s.agents[ev.id];
            const next: Agent = { ...prev, ...ev.patch };
            return { agents: { ...s.agents, [ev.id]: next } };
          }
          case 'task.upsert':
            return { tasks: { ...s.tasks, [ev.task.id]: ev.task } };
          case 'project.upsert':
            return { projects: { ...s.projects, [ev.project.id]: ev.project }, activeProjectId: ev.project.id };
          case 'message':
            return { messages: [...s.messages, ev.message].slice(-MAX_MESSAGES) };
          case 'log':
            return { logs: [...s.logs, ev.entry].slice(-MAX_LOGS) };
        }
      });
    },

    setSource(kind) {
      const s = get();
      if (kind === s.source) return;
      s.adapter.disconnect();
      const next = makeAdapter(kind);
      set({ adapter: next, source: kind, liveStatus: kind === 'demo' ? null : 'connecting', chatWith: null });
      next.connect(ctx);
      next.setSpeed?.(s.speed);
    },

    submitProject(title) { get().adapter.submitProject(title.trim()); },
    assignTask(agent, title) { get().adapter.assignTask(agent, title.trim()); },
    togglePause(agent) {
      const s = get();
      if (s.agents[agent].status === 'paused') s.adapter.resumeAgent(agent);
      else s.adapter.pauseAgent(agent);
    },

    async ask(agent, text) {
      const s = get();
      const lang = detectLang(text, s.lang);
      const q: Message = { id: uid('msg'), ts: Date.now(), from: 'user', to: agent, text, channel: 'direct' };
      set({ messages: [...s.messages, q], chatPending: true });
      get().dispatch({ type: 'agent.patch', id: agent, patch: { speaking: false } });
      const answer = await s.adapter.ask(agent, text, lang);
      const a: Message = { id: uid('msg'), ts: Date.now(), from: agent, to: 'user', text: answer, channel: 'direct' };
      set((st) => ({ messages: [...st.messages, a], chatPending: false }));
      get().dispatch({ type: 'agent.patch', id: agent, patch: { speaking: true } });
      const done = () => get().dispatch({ type: 'agent.patch', id: agent, patch: { speaking: false } });
      const u = get().voiceOn ? speak(answer, lang) : undefined;
      if (u) u.onend = done;
      else setTimeout(done, 1800);
    },

    setSpeed(x) { get().adapter.setSpeed?.(x); set({ speed: x }); },
    setRunning(r) { get().adapter.setRunning?.(r); set({ running: r }); },
    setLang(l) { set({ lang: l }); },
    setMode(m) { set({ mode: m, menuOpen: false, hint: null, modal: null, dashboardOpen: m === 'overview' }); },
    setCameraStyle(c) { set({ cameraStyle: c }); },
    goPreset(p) { set((s) => ({ preset: p, presetNonce: s.presetNonce + 1 })); },
    playShot(id) { set({ shot: id, selectedId: null, modal: null, chatWith: null }); },
    select(id, tab) { set({ selectedId: id, tab: tab ?? 'overview' }); },
    setTab(t) { set({ tab: t }); },
    openChat(id) { set({ chatWith: id }); },
    openModal(m, assignFor = null) { set({ modal: m, assignFor }); },
    setMenu(open) { set({ menuOpen: open }); },
    setHint(h) { if (get().hint !== h) set({ hint: h }); },
    setVoice(on) { set({ voiceOn: on }); if (!on && 'speechSynthesis' in window) speechSynthesis.cancel(); },
    setDashboard(open) { set({ dashboardOpen: open }); },
  };
});

/** Helpers for components. */
export const selectProject = (s: OfficeState) => (s.activeProjectId ? s.projects[s.activeProjectId] : null);
