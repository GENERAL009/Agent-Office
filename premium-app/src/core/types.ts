// Domain model shared by the store, the adapters and the 3D world.
// Nothing here knows about React or Three.js.

export type AgentId = 'manager' | 'research' | 'developer' | 'designer' | 'qa';
export const AGENT_IDS: AgentId[] = ['manager', 'research', 'developer', 'designer', 'qa'];

export type AgentStatus = 'idle' | 'thinking' | 'working' | 'completed' | 'error' | 'paused';

/** Named places in the office an agent can be sent to. */
export type PlaceId = 'desk' | 'meeting' | 'whiteboard' | 'coffee' | 'visit' | 'security';

export type Lang = 'en' | 'uz';

export interface AgentProfile {
  id: AgentId;
  name: string;
  role: string;
  color: string;
  /** Short description shown in the agent panel. */
  bio: string;
}

export interface Agent extends AgentProfile {
  status: AgentStatus;
  /** Status before a pause, restored on resume. */
  resumeStatus?: AgentStatus;
  currentTaskId: string | null;
  /** Where the agent wants to be; the 3D layer walks it there. */
  place: PlaceId;
  /** For place === 'visit': whose desk the agent is visiting. */
  visiting?: AgentId;
  /** For place === 'meeting': seat index around the table. */
  seat?: number;
  speaking: boolean;
  /** Set by the 3D world: true once the agent has reached `place` (and sat down, if it is a seat). */
  arrived?: boolean;
  /** Plugin mode: no role of the team sits here, so the seat is empty (not shown as an agent). */
  vacant?: boolean;
}

export type TaskStatus = 'queued' | 'running' | 'completed' | 'error' | 'paused';

export interface Task {
  id: string;
  projectId: string | null;
  title: string;
  assignee: AgentId;
  status: TaskStatus;
  progress: number; // 0..100
  dependsOn: string[];
  /** Simulated effort in seconds at 1x speed (demo only). */
  effort: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: string;
  source: 'plan' | 'user' | 'qa';
}

export type ProjectStatus = 'planning' | 'meeting' | 'running' | 'completed';

export interface Project {
  id: string;
  title: string;
  status: ProjectStatus;
  progress: number;
  createdAt: number;
  completedAt?: number;
  taskIds: string[];
}

export type Speaker = AgentId | 'user' | 'system';

export interface Message {
  id: string;
  ts: number;
  from: Speaker;
  to?: AgentId | 'all' | 'user';
  text: string;
  /** team = agent-to-agent channel, direct = a user's private chat with one agent */
  channel: 'team' | 'direct';
  inMeeting?: boolean;
}

export type LogKind = 'status' | 'task' | 'action' | 'result' | 'error' | 'chat';

export interface LogEntry {
  id: string;
  ts: number;
  agentId: AgentId;
  kind: LogKind;
  text: string;
}

/** Everything an adapter can tell the office. The store reduces these. */
export type OfficeEvent =
  | { type: 'agent.patch'; id: AgentId; patch: Partial<Agent> }
  | { type: 'task.upsert'; task: Task }
  | { type: 'project.upsert'; project: Project }
  | { type: 'message'; message: Message }
  | { type: 'log'; entry: LogEntry }
  | { type: 'reset' };

let seq = 0;
export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}`;
