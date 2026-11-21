// Camera moves made for the Ep7 video ("Office 2.0"): fly-ins through doors and windows, agent close-ups,
// the kickoff walk and a calm end-screen orbit. Rendered with ?render=<ids> (see RenderController), not in the 🎬 menu.
import type { Shot } from './shots';

type V3 = [number, number, number];
const ring = (n: number, from: number, to: number, r: [number, number], y: number): V3[] =>
  Array.from({ length: n }, (_, i) => {
    const a = from + ((to - from) * i) / (n - 1);
    return [Math.sin(a) * r[0], y, Math.cos(a) * r[1]];
  });

export const VIDEO_SHOTS: Shot[] = [
  // ---------------------------------------------------------------- hook and overview
  {
    id: 'v-hookdoor', label: 'Street to the front doors, they slide open', seconds: 5, ceiling: true, ease: 'linear', fov: 50,
    pos: [[-15, 1.75, 22.4], [-15, 1.7, 19.0], [-15, 1.65, 15.6], [-15, 1.6, 12.6]],
    look: [[-15, 1.55, 15], [-15, 1.5, 13], [-15, 1.4, 10.5], [-15, 1.3, 8.5]],
  },
  {
    id: 'v-plan', label: 'Straight down on the floor plan', seconds: 9, ease: 'linear', fov: 40,
    pos: [[0, 60, 7], [0, 54, 6.2]],
    look: [[0, 0, 0], [0, 0, 0]],
  },
  {
    id: 'v-staff', label: 'Oblique overview for the staff part', seconds: 10, ease: 'linear',
    pos: [[-30, 30, 30], [-20, 32, 34]],
    look: [[-2, 0, 2], [0, 0, 2]],
  },
  // ---------------------------------------------------------------- the tour: one fly-in per room
  {
    id: 'v-reception', label: 'Through the west window to the reception desk', seconds: 10, ceiling: true, ease: 'out',
    pos: [[-28, 2.7, 12.4], [-22.5, 1.85, 11.6], [-19.4, 1.6, 11.3], [-17.2, 1.45, 11.2], [-15.7, 1.32, 10.9]],
    look: [[-20, 1.4, 11.3], [-17, 1.25, 10.8], [-15.6, 1.1, 10.0], [-15.4, 1.0, 9.7], [-15.4, 1.0, 9.6]],
  },
  {
    id: 'v-workspace', label: 'Glass door into the workspace, down the desk aisle', seconds: 10, ceiling: true, ease: 'out',
    pos: [[-2.5, 2.0, 8.9], [1.0, 1.75, 8.9], [3.8, 1.6, 8.7], [7.0, 1.5, 8.6], [10.5, 1.45, 8.6]],
    look: [[2.5, 1.5, 8.9], [6.0, 1.2, 8.2], [9.0, 0.95, 6.9], [12.0, 0.9, 6.6], [14.0, 0.9, 6.6]],
  },
  {
    id: 'v-meeting', label: 'Corridor through the glass door into the meeting room', seconds: 9, ceiling: true, ease: 'out',
    pos: [[-5.5, 1.85, -3.4], [-10.8, 1.75, -3.8], [-12.5, 1.68, -5.6], [-13.5, 1.6, -7.2]],
    look: [[-12.5, 1.5, -5.0], [-13.6, 1.25, -7.5], [-15, 1.0, -10.3], [-15.1, 1.15, -12.0]],
  },
  {
    id: 'v-manager', label: "Into Olivia's office, over to the mini golf green", seconds: 10, ceiling: true,
    pos: [[-9.4, 1.8, -1.6], [-9.35, 1.7, -4.6], [-8.4, 1.65, -6.8], [-6.2, 1.55, -8.2]],
    look: [[-9.35, 1.5, -7], [-7.6, 1.2, -9.6], [-6.25, 1.05, -11.3], [-3.1, 0.3, -12.1]],
  },
  {
    id: 'v-studio', label: 'Studio: behind the cameras at the interview', seconds: 9, ceiling: true, ease: 'out',
    pos: [[-0.6, 1.85, -2.4], [0, 1.72, -5.0], [1.7, 1.65, -7.0], [2.8, 1.6, -8.3]],
    look: [[0, 1.5, -7], [0.9, 1.2, -10], [1.2, 1.0, -12.5], [1.1, 1.0, -12.6]],
  },
  {
    id: 'v-server', label: 'Server room: over the racks', seconds: 9, ceiling: true, ease: 'out',
    pos: [[6.25, 1.8, -2.6], [6.3, 1.95, -5.2], [7.2, 2.86, -8.4], [8.3, 2.9, -10.25]],
    look: [[6.25, 1.6, -7], [7.0, 1.4, -10], [7.4, 0.9, -11.2], [7.3, 0.9, -11.3]],
  },
  {
    id: 'v-game', label: 'Game room: ping pong, bean bags, the party table', seconds: 10, ceiling: true,
    pos: [[15, 1.8, -2.6], [15, 1.72, -5.0], [15.4, 1.7, -6.6], [14.8, 1.65, -7.4]],
    look: [[15, 1.0, -9.2], [14.6, 0.8, -10.6], [13.2, 0.6, -12.8], [11.8, 1.3, -6.9]],
  },
  {
    id: 'v-kitchen', label: 'Corridor through the kitchen door to the coffee bar', seconds: 9, ceiling: true, ease: 'out',
    pos: [[-15, 1.85, -4.2], [-15, 1.72, -2.5], [-15.6, 1.65, -0.9], [-16.2, 1.6, -0.2]],
    look: [[-15, 1.4, 0], [-16, 1.15, 1.5], [-18, 1.1, 1.4], [-18.6, 1.1, 1.4]],
  },
  {
    id: 'v-lounge', label: 'Lounge: pool table, sofas, arcade', seconds: 10, ceiling: true,
    pos: [[-3.6, 2.2, -4.2], [-3.8, 1.9, -1.4], [-4.6, 1.75, 1.0], [-6.2, 1.65, 3.4]],
    look: [[-4.5, 1.2, 1.0], [-5.6, 0.9, 1.8], [-5.2, 0.9, 9.0], [-9.2, 1.2, 5.3]],
  },
  {
    id: 'v-restrooms', label: "Into the men's room, the out-of-order stall", seconds: 9, ceiling: true, ease: 'out', fov: 38,
    pos: [[-0.2, 1.9, 5.4], [1.2, 1.75, 8.6], [2.05, 1.7, 10.25], [2.15, 1.68, 10.45]],
    look: [[1.25, 1.5, 10], [1.4, 1.4, 12], [1.82, 1.35, 13.1], [1.84, 1.35, 13.28]],
  },
  {
    id: 'v-terrace', label: 'The terrace and its pergola', seconds: 9,
    pos: [[-29.6, 2.7, 4.2], [-28.6, 2.3, 6.4], [-27.6, 2.0, 8.6]],
    look: [[-22, 1.0, 6.0], [-22, 0.9, 7.5], [-21.5, 1.1, 8.5]],
  },
  {
    id: 'v-front', label: 'Along the front: bench, bike racks, the canopy', seconds: 10, ease: 'linear',
    pos: [[4.5, 1.5, 21.8], [-3, 1.55, 21.6], [-9.5, 1.75, 22.2], [-13.5, 2.1, 23.2]],
    look: [[2.6, 0.6, 17.8], [-5.5, 0.6, 17.3], [-11.5, 1.6, 16.8], [-15, 3.0, 17.6]],
  },
  // ---------------------------------------------------------------- the team
  {
    id: 'v-kickoff-walk', label: 'From above: the agents walk to the kickoff', seconds: 14, ease: 'linear',
    pos: [[13, 15, 12], [2, 15.5, 7], [-9, 15, 2]],
    look: [[9, 0, 4], [-2, 0, -2], [-13, 0, -8]],
  },
  {
    id: 'v-kickoff-room', label: 'The kickoff at the meeting table', seconds: 26, ceiling: true, ease: 'linear',
    pos: [[-11.0, 2.6, -6.3], [-12.2, 2.45, -6.8]],
    look: [[-15.2, 0.9, -10.3], [-15.5, 0.9, -10.6]],
  },
  {
    id: 'v-olivia', label: 'Olivia at her desk', seconds: 10, ceiling: true, ease: 'linear',
    pos: [[-4.35, 1.5, -10.6], [-4.55, 1.45, -11.2], [-4.75, 1.42, -11.8]],
    look: [[-6.25, 1.18, -12.0], [-6.25, 1.18, -12.0], [-6.25, 1.18, -12.0]],
  },
  {
    id: 'v-leo', label: 'Leo at his desk', seconds: 10, ceiling: true, ease: 'linear',
    pos: [[9.45, 1.78, 5.45], [9.2, 1.75, 5.38], [8.95, 1.72, 5.32]],
    look: [[8.5, 1.2, 7.0], [8.5, 1.2, 7.0], [8.5, 1.2, 7.0]],
  },
  {
    id: 'v-mia', label: 'Mia at her desk', seconds: 10, ceiling: true, ease: 'linear',
    pos: [[7.55, 1.78, 10.05], [7.8, 1.75, 9.98], [8.05, 1.72, 9.92]],
    look: [[8.5, 1.2, 11.6], [8.5, 1.2, 11.6], [8.5, 1.2, 11.6]],
  },
  {
    id: 'v-max', label: 'Max at his desk', seconds: 10, ceiling: true, ease: 'linear',
    pos: [[11.45, 1.78, 5.45], [11.2, 1.75, 5.38], [10.95, 1.72, 5.32]],
    look: [[10.5, 1.2, 7.0], [10.5, 1.2, 7.0], [10.5, 1.2, 7.0]],
  },
  {
    id: 'v-sam', label: 'Sam at his desk', seconds: 10, ceiling: true, ease: 'linear',
    pos: [[11.45, 1.78, 10.05], [11.2, 1.75, 9.98], [10.95, 1.72, 9.92]],
    look: [[10.5, 1.2, 11.6], [10.5, 1.2, 11.6], [10.5, 1.2, 11.6]],
  },
  {
    id: 'v-receptionist', label: 'The receptionist at her desk', seconds: 6, ceiling: true, ease: 'linear',
    pos: [[-13.9, 1.5, 10.2], [-14.2, 1.45, 10.0]],
    look: [[-14.9, 1.15, 8.3], [-14.9, 1.15, 8.3]],
  },
  // ---------------------------------------------------------------- walk inside, the hardest part, the end screen
  {
    id: 'v-ceiling', label: 'From above down into the lounge: the ceiling comes back', seconds: 7, ceiling: true,
    pos: [[-4, 11, 13], [-4, 6, 9], [-4.2, 2.5, 6.2], [-4.4, 1.7, 5.0]],
    look: [[-4, 0, 6], [-4, 0, 4], [-4.6, 1.6, 1.5], [-5, 2.3, 0]],
  },
  {
    // the whole office in view, camera still: for counting draw calls per frame
    id: 'v-overview', label: 'Overview, camera still', seconds: 4, ease: 'linear',
    pos: [[0, 44, 21], [0, 44, 21.01]],
    look: [[0, 0, -1], [0, 0, -1]],
  },
  {
    id: 'v-perf', label: 'A sweep over the whole office (frame-time test path)', seconds: 10, ease: 'linear',
    pos: [[-26, 14, 24], [-8, 11, 20], [10, 11, 20], [26, 14, 24]],
    look: [[-10, 0, 2], [-3, 0, 2], [3, 0, 2], [10, 0, 2]],
  },
  {
    id: 'v-endscreen', label: 'Slow night orbit for the end screen', seconds: 21, ease: 'linear',
    pos: ring(6, -0.55, 0.15, [46, 40], 21),
    look: Array.from({ length: 6 }, (): V3 => [0, 0, 1]),
  },
];
