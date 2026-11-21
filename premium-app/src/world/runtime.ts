// Per-frame shared state between 3D components (kept out of React state on purpose).
import type { AgentId } from '../core/types';
import { PLAYER_SPAWN, deskSeat } from './layout';
import { AGENT_IDS } from '../core/types';

export interface Body { x: number; z: number; rot: number; }

export const agentBodies = Object.fromEntries(AGENT_IDS.map((id) => {
  const s = deskSeat(id);
  return [id, { x: s.x, z: s.z, rot: s.rot }];
})) as Record<AgentId, Body>;

export const player = {
  x: PLAYER_SPAWN.x,
  y: 0,
  z: PLAYER_SPAWN.z,
  vy: 0,
  yaw: PLAYER_SPAWN.rot,
  pitch: -0.12,
  facing: PLAYER_SPAWN.rot,
  moving: false,
  running: false,
  /** Where the player is sitting, if anywhere. */
  seat: null as null | { x: number; z: number; rot: number },
};

/** Staff who walk around (agents are in agentBodies); doors open for them. */
export const walkers = new Set<{ x: number; z: number; rot: number }>();
/** The camera during a recorded shot, so doors open as it flies through them. */
export const shotCamera = { active: false, x: 0, z: 0, rot: 0 };

export const keys = new Set<string>();
export const look = { locked: false };
/** What the player would interact with by pressing E. */
export const nearby: { kind: 'agent' | 'object' | null; id: string | null } = { kind: null, id: null };
