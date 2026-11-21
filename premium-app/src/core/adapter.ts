import type { Agent, AgentId, Lang, LogEntry, Message, OfficeEvent, Project, Task } from './types';

/** Read-only view of the office that adapters can use to make decisions. */
export interface OfficeSnapshot {
  agents: Record<AgentId, Agent>;
  tasks: Record<string, Task>;
  projects: Record<string, Project>;
  messages: Message[];
  logs: LogEntry[];
  activeProjectId: string | null;
  lang: Lang;
}

export interface AdapterContext {
  emit(event: OfficeEvent): void;
  getState(): OfficeSnapshot;
}

/**
 * A source of agent activity. The UI and the 3D world only ever talk to this
 * interface, so the demo simulation can be swapped for real Claude Code agents.
 */
export interface AgentDataAdapter {
  readonly kind: 'demo' | 'claude-code';
  readonly label: string;
  /** True when the data is simulated. The UI must show Demo Mode in that case. */
  readonly isSimulated: boolean;
  /** What this adapter can do, so the UI can hide controls it doesn't support. */
  readonly can: { submit: boolean; assign: boolean; pause: boolean; chat: boolean; speed: boolean };

  connect(ctx: AdapterContext): void;
  disconnect(): void;

  submitProject(title: string): void;
  assignTask(agent: AgentId, title: string): void;
  pauseAgent(agent: AgentId): void;
  resumeAgent(agent: AgentId): void;
  /** A user's direct question to one agent. Resolves with the agent's answer. */
  ask(agent: AgentId, text: string, lang: Lang): Promise<string>;

  setSpeed?(multiplier: number): void;
  setRunning?(running: boolean): void;
}
