import type { Agent, AgentId, AgentProfile } from './types';

export const PROFILES: Record<AgentId, AgentProfile> = {
  manager: {
    id: 'manager',
    name: 'Olivia',
    role: 'Manager Agent',
    color: '#f59e0b',
    bio: 'Takes the brief, splits it into tasks, assigns them and keeps the project moving.',
  },
  research: {
    id: 'research',
    name: 'Leo',
    role: 'Research Agent',
    color: '#22c55e',
    bio: 'Finds information, studies competitors and turns it into clear requirements.',
  },
  developer: {
    id: 'developer',
    name: 'Max',
    role: 'Developer Agent',
    color: '#3b82f6',
    bio: 'Writes the code: pages, components, APIs and integrations.',
  },
  designer: {
    id: 'designer',
    name: 'Mia',
    role: 'Designer Agent',
    color: '#ec4899',
    bio: 'Designs the interface: layouts, components, colors and states.',
  },
  qa: {
    id: 'qa',
    name: 'Sam',
    role: 'QA Agent',
    color: '#a855f7',
    bio: 'Tests every feature, finds bugs and sends them back with clear steps.',
  },
};

// Inside the Agent Office plugin seats stay empty until the team (from /agent-office:setup) fills them.
const PLUGIN = (() => { try { return location.pathname.startsWith('/premium') || new URLSearchParams(location.search).has('replay'); } catch { return false; } })();

export function initialAgents(): Record<AgentId, Agent> {
  const out = {} as Record<AgentId, Agent>;
  for (const p of Object.values(PROFILES)) {
    out[p.id] = { ...p, status: 'idle', currentTaskId: null, place: 'desk', speaking: false, arrived: true, vacant: PLUGIN && p.id !== 'manager' };
  }
  return out;
}

export const STATUS_LABEL: Record<Agent['status'], string> = {
  idle: 'Idle',
  thinking: 'Thinking',
  working: 'Working',
  completed: 'Completed',
  error: 'Error',
  paused: 'Paused',
};

export const STATUS_COLOR: Record<Agent['status'], string> = {
  idle: '#8b93a7',
  thinking: '#fbbf24',
  working: '#22c55e',
  completed: '#38bdf8',
  error: '#ef4444',
  paused: '#a78bfa',
};
