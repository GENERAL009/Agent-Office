// Demo data source: a small, deterministic-enough office simulation.
// It only talks to the app through OfficeEvents, exactly like a real adapter would.
import type { AdapterContext, AgentDataAdapter } from '../adapter';
import type { Agent, AgentId, AgentStatus, Lang, LogKind, Project, Task } from '../types';
import { AGENT_IDS, uid } from '../types';
import { planProject, BUGS, type PlannedTask } from './planner';
import { LINES, pick } from './lines';
import { replyTo } from './dialogue';

interface TaskMeta {
  kind: PlannedTask['kind'] | 'fix' | 'retest' | 'user';
  feature?: string;
  milestones: Set<number>;
  thinkingUntil: number;
}

const TICK_MS = 200;

export class SimulationAdapter implements AgentDataAdapter {
  readonly kind = 'demo' as const;
  readonly label = 'Built-in team';
  readonly isSimulated = true;
  readonly can = { submit: true, assign: true, pause: true, chat: true, speed: true };

  private ctx!: AdapterContext;
  private timer: ReturnType<typeof setInterval> | null = null;
  private speed = 1;
  private running = true;
  private now = 0; // simulated seconds
  private queue: { at: number; fn: () => void }[] = [];
  private tasks = new Map<string, Task>();
  private meta = new Map<string, TaskMeta>();
  private lockedUntil: Record<AgentId, number> = { manager: 0, research: 0, developer: 0, designer: 0, qa: 0 };
  private idleSince: Record<AgentId, number> = { manager: 0, research: 0, developer: 0, designer: 0, qa: 0 };
  private paused = new Set<AgentId>();
  private project: Project | null = null;
  private nextManagerRound = 0;
  private bugsFound = 0;
  private meeting: { attendees: AgentId[]; since: number; start: () => void } | null = null;

  connect(ctx: AdapterContext) {
    this.ctx = ctx;
    this.ctx.emit({ type: 'reset' });
    // In video render mode (?render=…) the renderer steps the simulation on its fixed clock instead, see tick().
    if (!new URLSearchParams(location.search).has('render')) this.timer = setInterval(() => this.step(), TICK_MS);
  }

  /** Seconds of simulated time per tick(). */
  static readonly TICK = TICK_MS / 1000;
  /** One simulation step, driven by the video renderer's clock. */
  tick() { this.step(); }
  /** Video staging: send an agent to their desk and keep them there for `seconds` (no breaks, no new tasks meanwhile). */
  stageDesk(id: AgentId, seconds: number) {
    this.go(id, 'desk');
    this.lockedUntil[id] = this.now + seconds;
  }
  /** Video staging: send an agent on a coffee break now, back to the desk after `seconds`. */
  stageCoffee(id: AgentId, seconds: number) {
    this.go(id, 'coffee');
    this.lockedUntil[id] = this.now + seconds;
    this.log(id, 'action', 'Coffee break');
    this.at(seconds, () => { if (!this.paused.has(id)) this.go(id, 'desk'); this.idleSince[id] = this.now; });
  }

  disconnect() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.queue = [];
  }

  setSpeed(x: number) { this.speed = x; }
  setRunning(r: boolean) { this.running = r; }

  // ------------------------------------------------------------------ helpers
  private get lang(): Lang { return this.ctx.getState().lang; }
  private get L() { return LINES[this.lang]; }
  private agent(id: AgentId): Agent { return this.ctx.getState().agents[id]; }

  private at(delay: number, fn: () => void) { this.queue.push({ at: this.now + delay, fn }); }

  private patch(id: AgentId, patch: Partial<Agent>) { this.ctx.emit({ type: 'agent.patch', id, patch }); }

  private setStatus(id: AgentId, status: AgentStatus) {
    if (this.paused.has(id)) return;
    if (this.agent(id).status !== status) {
      this.patch(id, { status });
      this.log(id, 'status', `Status → ${status}`);
    }
  }

  private log(agentId: AgentId, kind: LogKind, text: string) {
    this.ctx.emit({ type: 'log', entry: { id: uid('log'), ts: Date.now(), agentId, kind, text } });
  }

  private say(from: AgentId, text: string, to: AgentId | 'all' | 'user' = 'all', inMeeting = false) {
    this.ctx.emit({ type: 'message', message: { id: uid('msg'), ts: Date.now(), from, to, text, channel: 'team', inMeeting } });
    this.patch(from, { speaking: true });
    this.at(1.6, () => this.patch(from, { speaking: false }));
  }

  private upsert(task: Task) {
    this.tasks.set(task.id, task);
    this.ctx.emit({ type: 'task.upsert', task: { ...task } });
  }

  private emitProject() {
    if (this.project) this.ctx.emit({ type: 'project.upsert', project: { ...this.project, taskIds: [...this.project.taskIds] } });
  }

  /** Send an agent somewhere. The 3D world sets `arrived` back to true when they get there. */
  private go(id: AgentId, place: Agent['place'], extra: Partial<Agent> = {}) {
    this.patch(id, { place, visiting: undefined, seat: undefined, arrived: false, ...extra });
  }

  // ------------------------------------------------------------------ commands
  submitProject(title: string) {
    if (this.project && this.project.status !== 'completed') return;
    const L = this.L;
    const project: Project = { id: uid('prj'), title, status: 'planning', progress: 0, createdAt: Date.now(), taskIds: [] };
    this.project = project;
    this.bugsFound = 0;
    this.emitProject();
    this.ctx.emit({ type: 'message', message: { id: uid('msg'), ts: Date.now(), from: 'user', to: 'manager', text: title, channel: 'team' } });

    this.lockedUntil.manager = this.now + 4;
    this.setStatus('manager', 'thinking');
    this.go('manager', 'desk');
    this.log('manager', 'action', `Received project: ${title}`);
    this.at(0.8, () => this.say('manager', L.received(title)));

    this.at(3.5, () => {
      const plan = planProject(title, this.lang);
      const byKey = new Map<string, string>();
      for (const p of plan) byKey.set(p.key, uid('task'));
      for (const p of plan) {
        const id = byKey.get(p.key)!;
        project.taskIds.push(id);
        this.meta.set(id, { kind: p.kind, feature: p.feature, milestones: new Set(), thinkingUntil: 0 });
        this.upsert({
          id, projectId: project.id, title: p.title, assignee: p.assignee, status: 'queued', progress: 0,
          dependsOn: p.after.map((k) => byKey.get(k)!), effort: p.effort, createdAt: Date.now(), source: 'plan',
        });
      }
      this.log('manager', 'task', `Split the project into ${plan.length} tasks`);
      this.say('manager', this.L.planReady(plan.length));
      this.kickoff(plan);
    });
  }

  private kickoff(plan: PlannedTask[]) {
    const L = this.L;
    const p = this.project!;
    p.status = 'meeting';
    this.emitProject();
    const seats: Record<AgentId, number> = { manager: 0, research: 1, designer: 2, developer: 3, qa: 4 };
    const attendees = AGENT_IDS.filter((id) => !this.paused.has(id));
    for (const id of attendees) {
      this.lockedUntil[id] = Infinity;
      this.go(id, 'meeting', { seat: seats[id] });
      this.setStatus(id, 'thinking');
      this.log(id, 'action', 'Walking to the meeting room');
    }
    const first = (who: AgentId) => plan.find((t) => t.assignee === who)?.title ?? '';
    const script: [number, AgentId, string][] = [
      [0.6, 'manager', L.meetingCall],
      [2.2, 'manager', L.assign.research(first('research'))],
      [3.8, 'research', L.ack.research],
      [5.2, 'manager', L.assign.designer(first('designer'))],
      [6.8, 'designer', L.ack.designer],
      [8.2, 'manager', L.assign.developer(first('developer'))],
      [10.0, 'developer', L.ack.developer],
      [11.4, 'manager', L.assign.qa(first('qa'))],
      [12.8, 'qa', L.ack.qa],
      [14.2, 'manager', L.kickoffEnd],
    ];
    // The discussion starts only when everyone is seated (or after 30 s, if someone is stuck).
    this.meeting = {
      attendees,
      since: this.now,
      start: () => {
        for (const [t, who, text] of script) this.at(t, () => this.say(who, text, who === 'manager' ? 'all' : 'manager', true));
        const end = script[script.length - 1][0] + 1.6;
        for (const id of attendees) this.lockedUntil[id] = this.now + end;
        this.at(end, () => {
          p.status = 'running';
          this.emitProject();
          for (const id of AGENT_IDS) if (!this.paused.has(id)) { this.go(id, 'desk'); this.idleSince[id] = this.now; }
          this.nextManagerRound = this.now + 14;
        });
      },
    };
  }

  assignTask(agentId: AgentId, title: string) {
    const L = this.L;
    const task: Task = {
      id: uid('task'), projectId: this.project && this.project.status !== 'completed' ? this.project.id : null,
      title, assignee: agentId, status: 'queued', progress: 0, dependsOn: [], effort: 10 + Math.round(Math.random() * 5),
      createdAt: Date.now(), source: 'user',
    };
    this.meta.set(task.id, { kind: 'user', milestones: new Set(), thinkingUntil: 0 });
    if (task.projectId && this.project) { this.project.taskIds.push(task.id); this.emitProject(); }
    this.upsert(task);
    this.log(agentId, 'task', `New task from user: ${title}`);
    if (agentId !== 'manager') this.say('manager', L.userAssigned(agentId, title));
    this.at(1.2, () => this.say(agentId, L.userAck(title), 'user'));
  }

  pauseAgent(id: AgentId) {
    if (this.paused.has(id)) return;
    const a = this.agent(id);
    this.patch(id, { status: 'paused', resumeStatus: a.status });
    this.paused.add(id);
    const t = a.currentTaskId ? this.tasks.get(a.currentTaskId) : null;
    if (t && t.status === 'running') this.upsert({ ...t, status: 'paused' });
    this.log(id, 'status', 'Paused by user');
    this.ctx.emit({ type: 'message', message: { id: uid('msg'), ts: Date.now(), from: id, to: 'user', text: this.L.paused, channel: 'team' } });
  }

  resumeAgent(id: AgentId) {
    if (!this.paused.has(id)) return;
    this.paused.delete(id);
    const a = this.agent(id);
    const t = a.currentTaskId ? this.tasks.get(a.currentTaskId) : null;
    if (t && t.status === 'paused') this.upsert({ ...t, status: 'running' });
    this.patch(id, { status: a.resumeStatus && a.resumeStatus !== 'paused' ? a.resumeStatus : 'idle', resumeStatus: undefined, place: 'desk' });
    this.log(id, 'status', 'Resumed by user');
    this.ctx.emit({ type: 'message', message: { id: uid('msg'), ts: Date.now(), from: id, to: 'user', text: this.L.resumed, channel: 'team' } });
  }

  async ask(id: AgentId, text: string, lang: Lang): Promise<string> {
    const r = replyTo(id, text, lang, this.ctx.getState(), [...this.tasks.values()]);
    if (r.action?.type === 'assign') this.assignTask(id, r.action.title);
    if (r.action?.type === 'pause') this.pauseAgent(id);
    if (r.action?.type === 'resume') this.resumeAgent(id);
    this.log(id, 'chat', `User asked: ${text}`);
    await new Promise((res) => setTimeout(res, 450 + Math.random() * 600));
    return r.text;
  }

  // ------------------------------------------------------------------ engine
  private step() {
    if (!this.running) return;
    const dt = (TICK_MS / 1000) * this.speed;
    this.now += dt;

    const due = this.queue.filter((q) => q.at <= this.now);
    this.queue = this.queue.filter((q) => q.at > this.now);
    for (const q of due) q.fn();

    if (this.meeting) {
      const m = this.meeting;
      const seated = m.attendees.every((id) => this.paused.has(id) || (this.agent(id).place === 'meeting' && this.agent(id).arrived));
      if (seated || this.now - m.since > 30) {
        this.meeting = null;
        m.start();
      }
    }

    for (const id of AGENT_IDS) this.stepAgent(id, dt);
    if (this.project?.status === 'running') this.stepManager();
    this.updateProject();
  }

  private runnable(id: AgentId): Task | undefined {
    const ready = [...this.tasks.values()].filter((t) =>
      t.assignee === id && t.status === 'queued' && t.dependsOn.every((d) => this.tasks.get(d)?.status === 'completed'));
    const rank = (t: Task) => (t.source === 'qa' ? 0 : t.source === 'user' ? 1 : 2);
    return ready.sort((a, b) => rank(a) - rank(b) || a.createdAt - b.createdAt)[0];
  }

  private stepAgent(id: AgentId, dt: number) {
    if (this.paused.has(id) || this.now < this.lockedUntil[id]) return;
    const a = this.agent(id);
    const current = a.currentTaskId ? this.tasks.get(a.currentTaskId) : undefined;

    if (current && current.status === 'running') {
      const m = this.meta.get(current.id)!;
      if (this.now < m.thinkingUntil) return;
      if (a.status !== 'working' && a.status !== 'error') this.setStatus(id, 'working');
      const progress = Math.min(100, current.progress + (100 / current.effort) * dt * (0.7 + Math.random() * 0.6));
      for (const mark of [30, 60, 85]) {
        if (progress >= mark && !m.milestones.has(mark)) {
          m.milestones.add(mark);
          this.log(id, 'action', pick(this.L.activity[id]));
        }
      }
      if (progress >= 100) this.finish(current);
      else this.upsert({ ...current, progress });
      return;
    }

    const next = this.runnable(id);
    if (next) {
      const m = this.meta.get(next.id)!;
      m.thinkingUntil = this.now + 1.5;
      this.upsert({ ...next, status: 'running', startedAt: Date.now() });
      this.patch(id, { currentTaskId: next.id });
      this.go(id, 'desk');
      this.setStatus(id, 'thinking');
      this.log(id, 'task', `Started: ${next.title}`);
      if (next.source !== 'plan' || m.kind === 'research' || m.kind === 'review' || Math.random() < 0.35) this.say(id, this.L.start[id](next.title));
      return;
    }

    // Nothing to do.
    if (a.status === 'working' || a.status === 'thinking') {
      this.setStatus(id, 'idle');
      this.idleSince[id] = this.now;
    }
    if (a.place === 'desk' && a.status === 'idle' && id !== 'manager' && this.now - this.idleSince[id] > 9 && Math.random() < 0.02) {
      // Now and then the break is a look at the Cyber Security video wall instead; it is a longer walk.
      const soc = Math.random() < 0.3, secs = soc ? 26 : 9;
      this.go(id, soc ? 'security' : 'coffee');
      this.lockedUntil[id] = this.now + secs;
      this.log(id, 'action', soc ? 'Visiting Cyber Security' : 'Coffee break');
      if (Math.random() < 0.6) this.say(id, pick(soc ? this.L.security : this.L.coffee));
      this.at(secs, () => { if (!this.paused.has(id)) this.go(id, 'desk'); this.idleSince[id] = this.now; });
    }
  }

  private finish(task: Task) {
    const L = this.L;
    const m = this.meta.get(task.id)!;
    const f = m.feature ?? '';
    const id = task.assignee;
    let result = L.result[m.kind === 'retest' ? 'test' : m.kind]?.(f) ?? L.result.user();

    if (m.kind === 'test' || m.kind === 'retest') {
      const findsBug = m.kind === 'test' && (this.bugsFound === 0 || Math.random() < 0.25);
      if (findsBug) {
        this.bugsFound++;
        const bug = pick(BUGS[this.lang]);
        result = this.lang === 'uz' ? `1 ta xatolik topildi: ${bug}` : `1 bug found: ${bug}`;
        this.log(id, 'error', `Bug found in ${f}: ${bug}`);
        this.say('qa', L.handoff.bug(f, bug), 'developer');
        const fix: Task = {
          id: uid('task'), projectId: task.projectId, title: (this.lang === 'uz' ? 'Tuzatish: ' : 'Fix: ') + bug, assignee: 'developer',
          status: 'queued', progress: 0, dependsOn: [], effort: 8, createdAt: Date.now(), source: 'qa',
        };
        const retest: Task = {
          id: uid('task'), projectId: task.projectId, title: (this.lang === 'uz' ? 'Qayta test: ' : 'Re-test: ') + f, assignee: 'qa',
          status: 'queued', progress: 0, dependsOn: [fix.id], effort: 5, createdAt: Date.now(), source: 'plan',
        };
        this.meta.set(fix.id, { kind: 'fix', feature: f, milestones: new Set(), thinkingUntil: 0 });
        this.meta.set(retest.id, { kind: 'retest', feature: f, milestones: new Set(), thinkingUntil: 0 });
        this.upsert(fix);
        this.upsert(retest);
        // The final review must wait for the re-test too.
        for (const t of this.tasks.values()) if (this.meta.get(t.id)?.kind === 'review' && t.projectId === task.projectId) this.upsert({ ...t, dependsOn: [...t.dependsOn, retest.id] });
        if (this.project && task.projectId === this.project.id) { this.project.taskIds.push(fix.id, retest.id); this.emitProject(); }
        this.at(1.4, () => {
          if (this.paused.has('developer')) return;
          this.patch('developer', { status: 'error' });
          this.log('developer', 'error', L.devError(bug));
          this.say('developer', L.devError(bug), 'qa');
          this.at(3, () => { if (this.agent('developer').status === 'error') this.setStatus('developer', this.agent('developer').currentTaskId ? 'working' : 'idle'); });
        });
      } else {
        this.say('qa', L.handoff.testOk(f));
      }
    } else if (m.kind === 'research') this.say(id, L.handoff.research, 'designer');
    else if (m.kind === 'system') this.say(id, L.handoff.system);
    else if (m.kind === 'design') this.say(id, L.handoff.design(f), 'developer');
    else if (m.kind === 'build') this.say(id, L.handoff.build(f), 'qa');
    else if (m.kind === 'fix') this.say(id, L.handoff.fixed(f), 'qa');

    this.upsert({ ...task, status: 'completed', progress: 100, completedAt: Date.now(), result });
    this.log(id, 'result', `Completed: ${task.title}`);
    this.patch(id, { currentTaskId: null });
    this.idleSince[id] = this.now;
  }

  private stepManager() {
    const id: AgentId = 'manager';
    if (this.now < this.nextManagerRound || this.paused.has(id) || this.now < this.lockedUntil[id]) return;
    const a = this.agent(id);
    if (a.currentTaskId) return; // busy with the final review
    this.nextManagerRound = this.now + 16 + Math.random() * 8;
    const working = AGENT_IDS.filter((x) => {
      const t = this.tasks.get(this.agent(x).currentTaskId ?? '');
      return x !== 'manager' && this.agent(x).status === 'working' && this.agent(x).place === 'desk' && !this.paused.has(x) && !!t && t.progress < 70;
    });

    if (working.length && Math.random() < 0.6) {
      const who = pick(working);
      const task = this.tasks.get(this.agent(who).currentTaskId ?? '');
      if (!task) return;
      this.lockedUntil[id] = this.now + 9;
      this.go(id, 'visit', { visiting: who });
      this.setStatus(id, 'thinking');
      this.log(id, 'action', `Checking in on ${who}`);
      this.at(3.5, () => this.say(id, this.L.checkIn(who, task.title), who));
      this.at(5.3, () => {
        const live = this.tasks.get(task.id);
        if (live?.status === 'completed') this.say(who, this.L.checkDone(task.title), 'manager');
        else this.say(who, this.L.checkReply(Math.round(live?.progress ?? task.progress), task.title), 'manager');
      });
      this.at(8.5, () => { this.go(id, 'desk'); this.setStatus(id, 'idle'); });
    } else {
      this.lockedUntil[id] = this.now + 8;
      this.go(id, 'whiteboard');
      this.setStatus(id, 'working');
      this.log(id, 'action', 'Updating the whiteboard');
      this.at(5, () => this.say(id, this.L.board));
      this.at(7.5, () => { this.go(id, 'desk'); this.setStatus(id, 'idle'); });
    }
  }

  private updateProject() {
    const p = this.project;
    if (!p || p.status === 'completed' || p.status === 'planning') return;
    const list = p.taskIds.map((i) => this.tasks.get(i)).filter(Boolean) as Task[];
    if (!list.length) return;
    const progress = list.reduce((s, t) => s + (t.status === 'completed' ? 100 : t.progress), 0) / list.length;
    if (Math.abs(progress - p.progress) >= 0.5) { p.progress = progress; this.emitProject(); }
    if (p.status === 'running' && list.every((t) => t.status === 'completed')) {
      p.status = 'completed';
      p.progress = 100;
      p.completedAt = Date.now();
      this.emitProject();
      this.say('manager', this.L.done(p.title, list.length));
      for (const id of AGENT_IDS) {
        if (this.paused.has(id)) continue;
        this.setStatus(id, 'completed');
        this.log(id, 'result', `Project completed: ${p.title}`);
        this.at(7, () => { if (this.agent(id).status === 'completed') { this.setStatus(id, 'idle'); this.idleSince[id] = this.now; } });
      }
    }
  }
}
