// Live data source for the premium office inside the Agent Office plugin.
// It reads the plugin server's event stream (GET /events, same origin) — the same Claude Code hook
// events the free office shows — or a recorded session (?replay=file.json).
// The main session is the Manager; each sub-agent's tool calls show on its own seat (see team.ts).
import type { AdapterContext, AgentDataAdapter } from '../adapter';
import type { AgentId, Lang, Project, Task } from '../types';
import { uid } from '../types';
import { PROFILES } from '../agents';
import { applyTeam, isVacant, seatFor, type TeamRole } from './team';

interface HookEvent {
  hook: string;
  tool?: string;
  input?: Record<string, unknown>;
  prompt?: string;
  agent_type?: string;
  tool_use_id?: string;
  error?: string;
  team?: TeamRole[];
  project?: string;
  text?: string;
  severity?: string;
  level?: string;
  name?: string;
  state?: string;
  agent?: string;
  ts?: number;
}

const SPAWN = new Set(['Task', 'Agent']);
const short = (s: unknown, n: number) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const base = (p: unknown) => String(p ?? '').split('/').pop();
function describe(tool = '', input: Record<string, unknown> = {}) {
  if (input.file_path) return `${tool} ${base(input.file_path)}`;
  if (input.command) return `${tool} ${short(input.command, 60)}`;
  if (input.pattern) return `${tool} "${short(input.pattern, 30)}"`;
  if (input.url) return `${tool} ${short(input.url, 40)}`;
  return tool || 'action';
}

export const replayUrl = () => { try { return new URLSearchParams(location.search).get('replay'); } catch { return null; } };

export class PluginAdapter implements AgentDataAdapter {
  readonly kind = 'claude-code' as const;
  readonly label = 'Claude Code (Agent Office plugin)';
  readonly isSimulated = false;
  readonly can = { submit: false, assign: false, pause: false, chat: false, speed: false };

  private ctx!: AdapterContext;
  private es: EventSource | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private project: Project | null = null;
  private open = new Map<AgentId, Task & { toolUseId?: string; startedReal: number }>();
  private calm = new Map<AgentId, ReturnType<typeof setTimeout>>();
  onStatus?: (s: 'connecting' | 'open' | 'error') => void;
  onTeam?: () => void;

  connect(ctx: AdapterContext) {
    this.ctx = ctx;
    ctx.emit({ type: 'reset' });
    this.onStatus?.('connecting');
    const replay = replayUrl();
    if (replay) { this.replay(replay); return; }
    fetch('/team').then((r) => r.json()).then((j) => { if (Array.isArray(j.team)) this.team(j.team); }).catch(() => {});
    this.es = new EventSource('/events');
    this.es.onopen = () => this.onStatus?.('open');
    this.es.onerror = () => this.onStatus?.('error');
    this.es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        for (const ev of Array.isArray(data) ? data : [data]) this.handle(ev);
      } catch { /* ignore malformed */ }
    };
  }

  private async replay(file: string) {
    try {
      const rec = await fetch(file).then((r) => r.json());
      this.onStatus?.('open');
      // real gaps can be milliseconds; stretch them so people have time to walk
      let at = 0, prev = 0;
      for (const { t, ev } of rec.events as { t: number; ev: HookEvent }[]) {
        const gap = Math.min(Math.max(t - prev, ev.hook === 'PreToolUse' ? 900 : 300), 6000);
        prev = t; at += gap;
        this.timers.push(setTimeout(() => this.handle(ev), at));
      }
    } catch { this.onStatus?.('error'); }
  }

  disconnect() {
    this.es?.close();
    this.es = null;
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  submitProject() {}
  assignTask() {}
  pauseAgent() {}
  resumeAgent() {}
  async ask(id: AgentId, _text: string, lang: Lang) {
    const a = this.ctx.getState().agents[id];
    const t = a.currentTaskId ? this.ctx.getState().tasks[a.currentTaskId] : null;
    if (lang === 'uz') return t ? `Men ${a.name}. Hozir "${t.title}" ustida ishlayapman. Buyruqlar terminaldagi Claude Code’dan keladi.` : `Men ${a.name}. Hozir bo‘shman: vazifani terminaldagi Claude Code beradi.`;
    return t ? `I'm ${a.name}. I'm working on "${t.title}" right now. My orders come from Claude Code in your terminal.` : `I'm ${a.name}. I'm free right now: Claude Code in your terminal hands out the work.`;
  }

  private team(team: TeamRole[]) {
    const seats = applyTeam(team);
    for (const id of seats) {
      const p = PROFILES[id];
      this.ctx.emit({ type: 'agent.patch', id, patch: { name: p.name, role: p.role, color: p.color, bio: p.bio, vacant: isVacant(id) } });
    }
    this.onTeam?.();
  }

  /** a sub-agent the team file did not list just got a seat: show it */
  private fill(seat: AgentId) {
    const a = this.ctx.getState().agents[seat];
    if (!a.vacant) return;
    const p = PROFILES[seat];
    this.patch(seat, { name: p.name, role: p.role, color: p.color, bio: p.bio, vacant: false });
    this.onTeam?.();
  }

  private log(agentId: AgentId, kind: 'action' | 'task' | 'result' | 'status' | 'error', text: string) {
    this.ctx.emit({ type: 'log', entry: { id: uid('log'), ts: Date.now(), agentId, kind, text } });
  }
  private patch(id: AgentId, patch: Record<string, unknown>) { this.ctx.emit({ type: 'agent.patch', id, patch }); }
  private say(from: AgentId, text: string, to: AgentId | 'all' | 'user' = 'all') {
    this.ctx.emit({ type: 'message', message: { id: uid('msg'), ts: Date.now(), from, to, text, channel: 'team' } });
  }
  private settle(id: AgentId, ms: number, patch: Record<string, unknown>) {
    clearTimeout(this.calm.get(id));
    this.calm.set(id, setTimeout(() => this.patch(id, patch), ms));
  }

  private finish(seat: AgentId, ok = true) {
    const t = this.open.get(seat);
    if (!t) return;
    this.open.delete(seat);
    const { toolUseId: _a, startedReal: _b, ...task } = t;
    this.ctx.emit({ type: 'task.upsert', task: { ...task, status: ok ? 'completed' : 'error', progress: 100, completedAt: Date.now() } });
    this.patch(seat, { status: ok ? 'completed' : 'error', currentTaskId: null, place: 'desk' });
    this.log(seat, ok ? 'result' : 'error', `${ok ? 'Done' : 'Failed'}: ${t.title}`);
    this.say(seat, ok ? `Done: ${t.title} ✅` : `I hit a problem on "${t.title}".`, 'manager');
    // after a finished job: a coffee, then back to the desk
    if (ok) this.settle(seat, 2500, { status: 'idle', place: 'coffee' });
    if (this.project && !this.open.size) {
      this.project.progress = 100;
      this.ctx.emit({ type: 'project.upsert', project: { ...this.project } });
    }
  }

  private handle(ev: HookEvent) {
    const { emit } = this.ctx;
    const tool = ev.tool ?? '';
    switch (ev.hook) {
      case 'Snapshot':
      case 'Team':
        if (Array.isArray(ev.team)) this.team(ev.team);
        return;
      case 'SessionStart':
        this.patch('manager', { status: 'idle', place: 'desk' });
        this.log('manager', 'status', 'Session started');
        return;
      case 'SessionEnd':
        this.patch('manager', { status: 'idle' });
        this.log('manager', 'status', 'Session closed');
        return;
      case 'UserPromptSubmit': {
        const title = short(ev.prompt, 90) || 'New request';
        this.project = { id: uid('prj'), title, status: 'running', progress: 0, createdAt: Date.now(), taskIds: [] };
        emit({ type: 'project.upsert', project: { ...this.project } });
        emit({ type: 'message', message: { id: uid('msg'), ts: Date.now(), from: 'user', to: 'manager', text: title, channel: 'team' } });
        this.patch('manager', { status: 'thinking', place: 'desk' });
        this.log('manager', 'task', `Request: ${title}`);
        return;
      }
      case 'PreToolUse': {
        if (SPAWN.has(tool)) {
          const seat = seatFor(String(ev.input?.subagent_type ?? ''));
          this.fill(seat);
          const title = short(ev.input?.description ?? ev.input?.prompt, 70) || 'Sub-agent task';
          const task: Task & { toolUseId?: string; startedReal: number } = {
            id: uid('task'), projectId: this.project?.id ?? null, title, assignee: seat, status: 'running', progress: 10,
            dependsOn: [], effort: 0, createdAt: Date.now(), startedAt: Date.now(), source: 'plan', toolUseId: ev.tool_use_id, startedReal: Date.now(),
          };
          this.open.set(seat, task);
          if (this.project) { this.project.taskIds.push(task.id); this.project.status = 'running'; emit({ type: 'project.upsert', project: { ...this.project } }); }
          const { toolUseId: _a, startedReal: _b, ...plain } = task;
          emit({ type: 'task.upsert', task: plain });
          clearTimeout(this.calm.get(seat));
          this.patch(seat, { status: 'working', currentTaskId: task.id, place: 'desk' });
          this.patch('manager', { status: 'working' });
          this.say('manager', `${PROFILES[seat].name}, ${title}`, seat);
          this.log('manager', 'task', `→ ${PROFILES[seat].name}: ${title}`);
          return;
        }
        const who = seatFor(ev.agent_type);
        this.fill(who);
        const t = this.open.get(who);
        if (t) {
          t.progress = Math.min(92, t.progress + 9);
          const { toolUseId: _a, startedReal: _b, ...plain } = t;
          emit({ type: 'task.upsert', task: plain });
        }
        clearTimeout(this.calm.get(who));
        this.patch(who, { status: 'working', place: 'desk' });
        this.log(who, 'action', describe(tool, ev.input));
        return;
      }
      case 'PostToolUse': {
        if (SPAWN.has(tool)) {
          // a foreground sub-agent returns here; a background one returns almost at once and ends with SubagentStop
          const seat = seatFor(String(ev.input?.subagent_type ?? ''));
          const t = this.open.get(seat);
          if (t && Date.now() - t.startedReal > 2500) this.finish(seat, true);
        }
        return;
      }
      case 'PostToolUseFailure': {
        const who = seatFor(ev.agent_type);
        const err = short(String(ev.error ?? '').split('\n').find((l) => l.trim()) ?? '', 90);
        this.patch(who, { status: 'error' });
        this.log(who, 'error', `${tool} failed${err ? `: ${err}` : ''}`);
        this.settle(who, 4000, { status: 'working' });
        return;
      }
      case 'SubagentStop':
        this.finish(seatFor(ev.agent_type), true);
        return;
      case 'Stop':
        if (!this.open.size) {
          if (this.project) {
            this.project.status = 'completed'; this.project.progress = 100; this.project.completedAt = Date.now();
            emit({ type: 'project.upsert', project: { ...this.project } });
          }
          this.patch('manager', { status: 'completed' });
          this.log('manager', 'result', 'Answer ready');
          this.settle('manager', 3000, { status: 'idle' });
        }
        return;
      case 'Log':
      case 'Service': {
        const who = seatFor(ev.agent);
        const bad = /major|critical|moderate|error/.test(`${ev.severity ?? ''} ${ev.level ?? ''}`) || (ev.state && ev.state !== 'up');
        const text = ev.hook === 'Service' ? `${ev.name}: ${ev.state}` : short(ev.text, 110);
        this.log(who, bad ? 'error' : 'status', text);
        return;
      }
    }
  }
}
