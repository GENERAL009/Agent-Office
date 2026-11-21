// First-person walks for the Ep7 video: the player's position, heading and head tilt over time, plus the
// moments where they press E, type to an agent or sit down. Played by RenderController (?render=pov1,…&ext=1&ui=life).
// yaw: 0 faces +z (south), π/2 faces +x (east), π faces -z (north). pitch > 0 looks up.
import type { AgentId } from '../core/types';
import type { Spot } from '../world/layout';

export interface PovKey { t: number; x: number; z: number; yaw: number; pitch: number }
export type PovEvent =
  | { t: number; kind: 'chat'; agent: AgentId }
  | { t: number; kind: 'type'; text: string; seconds: number }
  | { t: number; kind: 'send' }
  | { t: number; kind: 'close' }
  | { t: number; kind: 'sit'; seat: Spot }
  | { t: number; kind: 'stand' };
export interface PovSegment { id: string; seconds: number; keys: PovKey[]; events: PovEvent[] }

const N = Math.PI, E = Math.PI / 2;
const k = (t: number, x: number, z: number, yaw: number, pitch = -0.04): PovKey => ({ t, x, z, yaw, pitch });

export const POV: PovSegment[] = [
  {
    // Along the street past the entrance (the doors stay shut), then turn and walk in (they open).
    id: 'pov1', seconds: 19,
    keys: [
      k(0, -23.5, 18.7, E), k(4.6, -16.6, 18.7, E), k(5.6, -15.7, 18.6, E + 0.5), k(6.6, -15.1, 18.3, N),
      k(9.2, -15.0, 15.4, N), k(11.4, -15.0, 12.9, N, 0.0), k(13.4, -15.0, 11.9, N, 0.42), k(14.6, -15.0, 11.7, N, 0.4),
      k(16.2, -15.0, 11.4, N, -0.14), k(19, -14.95, 11.2, N + 0.08, -0.16),
    ],
    events: [],
  },
  {
    // The corridor, west to east: meeting room and Olivia's office behind glass on the left.
    id: 'pov2', seconds: 10,
    keys: [k(0, -18.0, -3.7, E + 0.5), k(2.5, -14.6, -3.75, E + 0.75), k(5, -11.0, -3.8, E + 0.85), k(7.5, -7.4, -3.8, E + 0.55), k(10, -4.0, -3.75, E + 0.1)],
    events: [],
  },
  {
    // Lounge glass door into the workspace, down the aisle to Leo's desk: the Press E prompt pops up.
    id: 'pov3', seconds: 12,
    keys: [
      k(0, -1.2, 9.4, E), k(2.6, 2.5, 9.35, E), k(5.0, 5.4, 8.95, E - 0.15), k(7.6, 8.1, 8.75, E + 0.6, -0.1),
      k(8.8, 8.5, 8.7, N, -0.18), k(12, 8.5, 8.68, N, -0.2),
    ],
    events: [],
  },
  {
    // Into Olivia's office and round to the side of her desk (so she, not her computer, is what's in reach),
    // then open the chat and ask what she's doing. Looking down a little keeps her face above the chat window.
    id: 'pov4', seconds: 17,
    keys: [
      k(0, -9.35, -2.6, N), k(2.2, -9.35, -5.4, N), k(4.4, -7.2, -8.6, N + 0.5), k(6.0, -5.3, -10.9, N + 1.2, -0.12),
      k(6.8, -5.1, -11.75, 1.5 * Math.PI, -0.2), k(8.4, -5.1, -11.75, 1.5 * Math.PI, -0.3), k(17, -5.1, -11.75, 1.5 * Math.PI, -0.3),
    ],
    events: [
      { t: 8.0, kind: 'chat', agent: 'manager' },
      { t: 9.0, kind: 'type', text: 'What are you doing now?', seconds: 2.2 },
      { t: 11.6, kind: 'send' },
    ],
  },
  {
    // Lounge glass door, down the workspace aisle to the developer seat, then ask its agent what it is doing
    // (in the plugin the answer comes from the live task).
    id: 'pov7', seconds: 19,
    keys: [
      k(0, -1.2, 9.4, E), k(2.6, 2.5, 9.35, E), k(5.0, 5.4, 8.95, E - 0.15), k(7.6, 8.1, 8.75, E + 0.25, -0.08),
      k(9.4, 9.9, 8.6, E + 0.6, -0.14), k(10.8, 10.45, 8.45, N, -0.26), k(19, 10.45, 8.45, N, -0.28),
    ],
    events: [
      { t: 11.4, kind: 'chat', agent: 'developer' },
      { t: 12.3, kind: 'type', text: 'What are you working on?', seconds: 2.2 },
      { t: 14.9, kind: 'send' },
    ],
  },
  {
    // The meeting room: walk to a guest seat, sit, then stand up again.
    id: 'pov5', seconds: 10,
    keys: [
      k(0, -12.5, -5.6, N + 0.3), k(2.6, -13.4, -7.6, N + 0.1, -0.1), k(3.6, -13.7, -8.0, N, -0.12), k(10, -13.7, -8.0, N, -0.12),
    ],
    events: [
      { t: 4.4, kind: 'sit', seat: { x: -13.75, z: -8.7, rot: Math.PI } },
      { t: 7.6, kind: 'stand' },
    ],
  },
  {
    // A slow walk down the corridor at night, past the lit rooms.
    id: 'pov6', seconds: 12,
    keys: [k(0, -1.0, -3.75, E - 0.15, -0.02), k(6, 6.0, -3.7, E + 0.2, 0.0), k(12, 13.0, -3.75, E - 0.1, -0.02)],
    events: [],
  },
];

const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpAngle = (a: number, b: number, t: number) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

/** Velocity at key i (Catmull-Rom on the time axis), zero at the first and last key so walks start and stop softly. */
function vel(ks: PovKey[], i: number, axis: 'x' | 'z') {
  if (i === 0 || i === ks.length - 1) return 0;
  return (ks[i + 1][axis] - ks[i - 1][axis]) / (ks[i + 1].t - ks[i - 1].t);
}
const hermite = (p0: number, v0: number, p1: number, v1: number, dt: number, u: number) => {
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * v0 * dt + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * v1 * dt;
};

/** Player pose at `t` seconds into a segment: a smooth walk through the keys, turns ease in and out. */
export function povAt(seg: PovSegment, t: number): PovKey {
  const ks = seg.keys;
  if (t <= ks[0].t) return ks[0];
  for (let i = 1; i < ks.length; i++) {
    const a = ks[i - 1], b = ks[i];
    if (t <= b.t) {
      const dt = b.t - a.t, u = (t - a.t) / dt;
      return {
        t,
        x: hermite(a.x, vel(ks, i - 1, 'x'), b.x, vel(ks, i, 'x'), dt, u),
        z: hermite(a.z, vel(ks, i - 1, 'z'), b.z, vel(ks, i, 'z'), dt, u),
        yaw: lerpAngle(a.yaw, b.yaw, smooth(u)),
        pitch: lerp(a.pitch, b.pitch, smooth(u)),
      };
    }
  }
  return ks[ks.length - 1];
}
