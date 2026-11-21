// Camera moves for recording video: each shot is a smooth path through a few keyframes (camera position
// and the point it looks at). Played from the 🎬 menu in Overview; the UI hides while a shot runs.
import * as THREE from 'three';
import { VIDEO_SHOTS } from './shotsVideo';

/**
 * `ceiling`: the shot ends inside a room, so show the Walk-in ceiling once the camera drops below it.
 * `ease`: timing along the path (default 'smooth' = ease in and out; 'out' = fast start, slow landing).
 * `fov`: vertical field of view for this shot (default 45).
 */
export interface Shot {
  id: string; label: string; seconds: number; pos: [number, number, number][]; look: [number, number, number][];
  ceiling?: boolean; ease?: 'smooth' | 'out' | 'in' | 'linear'; fov?: number;
}

export const SHOTS: Shot[] = [
  {
    id: 'arrive', label: 'Arrive and walk in', seconds: 12, ceiling: true,
    pos: [[-4, 7.5, 33], [-11, 4.6, 24.5], [-15, 2.4, 20.5], [-15, 1.9, 17.4], [-15, 1.75, 13.6]],
    look: [[-14, 1.5, 15], [-15, 1.6, 15], [-15, 1.6, 14], [-15, 1.4, 11], [-15, 1.3, 9]],
  },
  {
    id: 'flyover', label: 'Fly over the office', seconds: 14,
    pos: [[-34, 24, 30], [-12, 40, 26], [12, 40, 26], [34, 24, 30]],
    look: [[-8, 0, 0], [-3, 0, -1], [3, 0, -1], [8, 0, 0]],
  },
  {
    id: 'workspace', label: 'Down into the workspace', seconds: 9,
    pos: [[11, 30, 26], [11, 14, 19], [10.5, 4.5, 13.5]],
    look: [[11, 0, 4], [11, 0.5, 6], [10.5, 1.0, 6.5]],
  },
  {
    id: 'meeting', label: 'Meeting room', seconds: 8,
    pos: [[-7, 7.5, 0], [-10.5, 4.2, -4], [-12.5, 3.0, -6]],
    look: [[-14, 0.5, -9], [-15, 0.8, -10], [-15.5, 0.9, -10.3]],
  },
  {
    id: 'manager', label: 'Manager office', seconds: 8,
    pos: [[-3, 6, -2], [-4.2, 3.6, -5.5], [-5.4, 2.4, -7.8]],
    look: [[-6, 0.5, -10], [-6.2, 1.0, -11], [-6.25, 1.1, -11.6]],
  },
  {
    id: 'lounge', label: 'Lounge and restrooms', seconds: 10,
    pos: [[2, 4, 3], [-1.5, 3.3, 4.5], [-2.8, 2.9, 7.2]],
    look: [[-4, 1, 6], [-5, 1, 9], [-6.2, 0.9, 11.8]],
  },
  {
    id: 'orbit', label: 'Night orbit around the building', seconds: 22,
    pos: Array.from({ length: 9 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return [Math.sin(a) * 42, 20, Math.cos(a) * 36] as [number, number, number];
    }),
    look: Array.from({ length: 9 }, () => [0, 0, 0] as [number, number, number]),
  },
  // shorter cut-aways for the edit
  {
    id: 'guards', label: 'Security at the door', seconds: 6,
    pos: [[-12.6, 2.1, 20.6], [-14.6, 2.0, 20.2], [-16.8, 1.9, 19.8]],
    look: [[-15, 1.3, 15.8], [-15, 1.3, 15.8], [-15, 1.3, 15.8]],
  },
  {
    id: 'walk', label: 'Walk through a door (eye level)', seconds: 10, ceiling: true,
    pos: [[-3.5, 1.6, 1.8], [0.6, 1.6, 1.85], [3.4, 1.6, 1.9], [6.0, 1.6, 3.2], [8.5, 1.6, 3.9]],
    look: [[0, 1.5, 1.85], [3, 1.5, 1.85], [6, 1.4, 2.4], [9, 1.3, 4.0], [11.5, 1.1, 4.4]],
  },
  {
    // the cleaner leaves her first stop about 6 s into the simulation: render it after a 6 s shot to catch her walking
    id: 'cleaner', label: 'The cleaner on her rounds', seconds: 6, ceiling: true,
    pos: [[-4.6, 1.75, -3.3], [-6.6, 1.7, -3.35], [-8.6, 1.65, -3.4]],
    look: [[1.5, 0.9, -3.75], [-1.5, 0.9, -3.75], [-5.0, 0.9, -3.75]],
  },
  {
    id: 'kitchen', label: 'Kitchen', seconds: 7,
    pos: [[-11.4, 3.0, 4.6], [-12.0, 2.7, 4.2], [-12.6, 2.4, 3.8]],
    look: [[-15.2, 0.9, 1.4], [-15.2, 0.9, 1.3], [-15.2, 0.9, 1.2]],
  },
  {
    id: 'game', label: 'Game room', seconds: 7,
    pos: [[11.2, 3.4, -5.6], [12.4, 3.1, -5.9], [13.6, 2.8, -6.3]],
    look: [[13.5, 0.8, -10], [13.5, 0.8, -10], [13.5, 0.8, -10]],
  },
  {
    id: 'server', label: 'Server room', seconds: 6,
    pos: [[7.5, 3.6, -5.5], [7.5, 3.3, -6.0], [7.5, 3.0, -6.6]],
    look: [[7.5, 1.0, -11.5], [7.5, 1.0, -11.5], [7.5, 1.0, -11.5]],
  },
  {
    id: 'studio', label: 'Studio', seconds: 6,
    pos: [[3.5, 3.6, -5.6], [2.6, 3.3, -6.3], [1.8, 3.0, -7.0]],
    look: [[1.2, 1.0, -12.8], [1.2, 1.0, -12.8], [1.2, 1.0, -12.8]],
  },
  {
    // down the corridor, through the glass door and up to the video wall
    id: 'security', label: 'Cyber Security', seconds: 11, ceiling: true,
    pos: [[15.5, 1.65, -3.7], [19.5, 1.65, -3.7], [22.5, 1.65, -4.0], [23.15, 1.65, -5.6], [23.8, 1.65, -6.6]],
    look: [[20, 1.5, -3.75], [23, 1.5, -4.4], [23.4, 1.5, -8], [24.4, 1.5, -12], [25, 1.6, -14.5]],
  },
  {
    id: 'restrooms', label: 'Restrooms', seconds: 6,
    pos: [[0, 6.5, 6.8], [0, 5.8, 7.4], [0, 5.2, 8.0]],
    look: [[0, 0, 12.6], [0, 0, 12.6], [0, 0, 12.6]],
  },
  {
    id: 'outro', label: 'Night push-in', seconds: 16,
    pos: [[0, 16, 46], [0, 12.5, 38], [0, 10, 31]],
    look: [[0, 1, 6], [0, 1, 6], [0, 1, 6]],
  },
];

const EASE = {
  smooth: (t: number) => t * t * (3 - 2 * t),
  out: (t: number) => 1 - (1 - t) ** 3,
  in: (t: number) => t * t * t,
  linear: (t: number) => t,
};

/** Camera position and look target at `elapsed` seconds into a shot (clamped to its end). */
export function shotAt(shot: Shot, elapsed: number) {
  const curves = shotCurves(shot);
  const t = EASE[shot.ease ?? 'smooth'](Math.min(1, Math.max(0, elapsed / shot.seconds)));
  return { pos: curves.pos.getPoint(t), look: curves.look.getPoint(t), done: elapsed >= shot.seconds };
}

const cache = new Map<string, { pos: THREE.CatmullRomCurve3; look: THREE.CatmullRomCurve3 }>();
function shotCurves(shot: Shot) {
  let c = cache.get(shot.id);
  if (!c) {
    const v = (p: [number, number, number]) => new THREE.Vector3(...p);
    c = { pos: new THREE.CatmullRomCurve3(shot.pos.map(v)), look: new THREE.CatmullRomCurve3(shot.look.map(v)) };
    cache.set(shot.id, c);
  }
  return c;
}

/** Any shot by id: the 🎬 menu ones above, plus the longer list made for the Ep7 video (shotsVideo.ts). */
export function findShot(id: string): Shot | undefined {
  return SHOTS.find((s) => s.id === id) ?? VIDEO_SHOTS.find((s) => s.id === id);
}
