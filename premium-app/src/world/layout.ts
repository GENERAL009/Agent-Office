// The office floor plan: a 40 × 30 m floor split into rooms, like a real office building, plus an east wing
// (the corridor runs on into it) for the Cyber Security department.
// One source of truth for the 3D scene, collisions, agent navigation and interactive objects.
// Units are meters, y is up. Synty props face +z, so rot 0 = front toward +z, rot π = toward -z.
//
//   z=-15 ┌──────────┬────────┬─────────┬───────┬──────────┬──────────┐
//         │ Meeting  │Manager │ Studio  │Server │ Game room│  Cyber   │
//         │          │        │         │       │          │ Security │
//   z=-5  ├──────────┴────────┴─────────┴───────┴──────────┴──glass───┤
//         │                  Corridor                                 elevator
//   z=-2.5├──────────┬──────────────┬───────────────────────┬──────────┘
//         │ Kitchen  │              │                       │
//   z=5   ├──────────┤    Lounge    │     Cubicle farm      │
//         │Reception │       ┌──┬───┤                       │
//         │          │       │WC│WC │                       │
//   z=15  └──entrance┴───────┴──┴───┴───────────────────────┘
//        x=-20     x=-10          x=2.5                   x=20       x=30
import type { AgentId } from '../core/types';

export interface Box { minX: number; minZ: number; maxX: number; maxZ: number; }
export interface Spot { x: number; z: number; rot: number; }

/** What the building covers: the main block and the east wing. */
export const FOOTPRINT: Box[] = [{ minX: -20, maxX: 20, minZ: -15, maxZ: 15 }, { minX: 20, maxX: 30, minZ: -15, maxZ: -2.5 }];
/** The box around the whole floor (the navigation grid covers it). */
export const FLOOR = { minX: -20, maxX: 30, minZ: -15, maxZ: 15 };
export const WALL_H = 3;
export const PIECE = 2.5;

export const box = (cx: number, cz: number, w: number, d: number): Box => ({ minX: cx - w / 2, minZ: cz - d / 2, maxX: cx + w / 2, maxZ: cz + d / 2 });

// ------------------------------------------------------------------ rooms
type Pal = '01' | '02' | '03' | '04';
/** Synty wall families: plain, with skirting and cornice, with skirting only, or exposed brick. */
export type WallStyle = 'blank' | 'trim' | 'baseboard' | 'brick';
/**
 * `palette` colors the floor; `walls` colors the walls seen from inside the room (03 = warm brown, 01 = cream);
 * `style` picks the wall family for the walls that face the room.
 */
export interface Room { id: string; name: string; minX: number; maxX: number; minZ: number; maxZ: number; floor: string; palette: Pal; walls: Pal; style: WallStyle; }
export const ROOMS: Room[] = [
  { id: 'meeting', name: 'Meeting room', minX: -20, maxX: -10, minZ: -15, maxZ: -5, floor: 'B:Floor_Wood_01', palette: '03', walls: '01', style: 'trim' },
  { id: 'manager', name: 'Manager office', minX: -10, maxX: -2.5, minZ: -15, maxZ: -5, floor: 'B:Floor_Carpet_01', palette: '02', walls: '03', style: 'trim' },
  { id: 'studio', name: 'Studio', minX: -2.5, maxX: 5, minZ: -15, maxZ: -5, floor: 'B:Floor_Carpet_01', palette: '04', walls: '04', style: 'blank' },
  { id: 'server', name: 'Server room', minX: 5, maxX: 10, minZ: -15, maxZ: -5, floor: 'B:Floor_Panel_01', palette: '02', walls: '02', style: 'blank' },
  { id: 'game', name: 'Game room', minX: 10, maxX: 20, minZ: -15, maxZ: -5, floor: 'B:Floor_Wood_01', palette: '01', walls: '01', style: 'brick' },
  { id: 'security', name: 'Cyber Security', minX: 20, maxX: 30, minZ: -15, maxZ: -5, floor: 'B:Floor_Carpet_01', palette: '04', walls: '04', style: 'blank' },
  { id: 'corridor', name: 'Corridor', minX: -20, maxX: 30, minZ: -5, maxZ: -2.5, floor: 'B:Floor_Wood_01', palette: '04', walls: '01', style: 'baseboard' },
  { id: 'kitchen', name: 'Kitchen', minX: -20, maxX: -10, minZ: -2.5, maxZ: 5, floor: 'B:Floor_Tiles_01', palette: '02', walls: '01', style: 'trim' },
  { id: 'reception', name: 'Reception', minX: -20, maxX: -10, minZ: 5, maxZ: 15, floor: 'B:Floor_Wood_01', palette: '03', walls: '01', style: 'trim' },
  { id: 'wc-women', name: 'Restroom', minX: -2.5, maxX: 0, minZ: 10, maxZ: 15, floor: 'B:Floor_Tiles_01', palette: '01', walls: '02', style: 'blank' },
  { id: 'wc-men', name: 'Restroom', minX: 0, maxX: 2.5, minZ: 10, maxZ: 15, floor: 'B:Floor_Tiles_01', palette: '01', walls: '02', style: 'blank' },
  { id: 'lounge', name: 'Lounge', minX: -10, maxX: 2.5, minZ: -2.5, maxZ: 15, floor: 'B:Floor_Wood_01', palette: '01', walls: '01', style: 'baseboard' },
  { id: 'cubicles', name: 'Workspace', minX: 2.5, maxX: 20, minZ: -2.5, maxZ: 15, floor: 'B:Floor_Carpet_01', palette: '02', walls: '03', style: 'baseboard' },
];
export const room = (id: string) => ROOMS.find((r) => r.id === id)!;
export const roomAt = (x: number, z: number) => ROOMS.find((r) => x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ);

// ------------------------------------------------------------------ walls
/**
 * A straight wall made of 2.5 m Synty pieces. `pieces` gives each piece's kind, in order from `a` to `b`.
 * Wide kinds (window2x, glassLarge, glassLargeDoor, doorLarge) are 5 m pieces: the next slot must be 'covered'.
 */
export type PieceKind = 'window' | 'solid' | 'door' | 'glass' | 'glassdoor' | 'open' | 'low' | 'lowgap' | 'whiteboard'
  | 'window2x' | 'glassLarge' | 'glassLargeDoor' | 'doorLarge' | 'covered' | 'elevator';
export const WIDE = new Set<PieceKind>(['window2x', 'glassLarge', 'glassLargeDoor', 'doorLarge']);
export interface WallRun { a: [number, number]; b: [number, number]; pieces: PieceKind[]; /** which side the pieces' faces point to */ face: '+x' | '-x' | '+z' | '-z'; }

const repeat = (k: PieceKind, n: number): PieceKind[] => Array(n).fill(k);
export const WALL_RUNS: WallRun[] = [
  // outer walls
  { a: [-20, -15], b: [30, -15], face: '+z', pieces: ['window', 'solid', 'solid', 'window', 'window2x', 'covered', 'solid', 'window', 'window', 'window', 'window2x', 'covered', 'window', 'solid', 'window', 'window', ...repeat('solid', 4)] },
  { a: [-20, -15], b: [-20, 15], face: '+x', pieces: ['window2x', 'covered', 'window2x', 'covered', 'elevator', 'window', 'solid', 'window', 'glassdoor', 'solid', 'window', 'window'] },
  // the old east wall: the game room's side of the Cyber Security wall, then open where the corridor runs on into the wing
  { a: [20, -15], b: [20, 15], face: '-x', pieces: ['solid', 'solid', 'solid', 'solid', 'open', 'window', 'window', 'solid', 'window2x', 'covered', 'solid', 'window'] },
  { a: [-20, 15], b: [20, 15], face: '-z', pieces: ['window', 'glassLargeDoor', 'covered', 'window', 'window', 'window', 'window', 'solid', 'solid', 'window2x', 'covered', 'window', 'window2x', 'covered', 'window', 'window'] },
  // back rooms ↔ corridor (z = -5)
  { a: [-20, -5], b: [-10, -5], face: '-z', pieces: ['glassLarge', 'covered', 'glassLargeDoor', 'covered'] },
  // the manager's glass front faces the corridor so its door sits at the west end, clear of her meeting table
  { a: [-10, -5], b: [-2.5, -5], face: '+z', pieces: ['glassdoor', 'glass', 'glass'] },
  { a: [-2.5, -5], b: [20, -5], face: '-z', pieces: ['doorLarge', 'covered', 'solid', 'door', 'solid', 'solid', 'doorLarge', 'covered', 'solid'] },
  // corridor ↔ front zones (z = -2.5)
  { a: [-20, -2.5], b: [20, -2.5], face: '+z', pieces: ['solid', 'doorLarge', 'covered', 'solid', ...repeat('open', 5), 'solid', 'door', 'solid', 'whiteboard', 'whiteboard', 'solid', 'door'] },
  // back-room dividers
  { a: [-10, -15], b: [-10, -5], face: '+x', pieces: repeat('solid', 4) },
  { a: [-2.5, -15], b: [-2.5, -5], face: '+x', pieces: repeat('solid', 4) },
  { a: [5, -15], b: [5, -5], face: '+x', pieces: repeat('solid', 4) },
  { a: [10, -15], b: [10, -5], face: '+x', pieces: repeat('solid', 4) },
  // kitchen ↔ reception (z = 5)
  { a: [-20, 5], b: [-10, 5], face: '+z', pieces: ['solid', 'solid', 'solid', 'door'] },
  // kitchen / reception ↔ lounge (x = -10)
  { a: [-10, -2.5], b: [-10, 15], face: '+x', pieces: ['solid', 'door', 'solid', 'glassLarge', 'covered', 'doorLarge', 'covered'] },
  // lounge ↔ workspace (x = 2.5), glass so you can see the team; solid behind the restrooms
  { a: [2.5, -2.5], b: [2.5, 15], face: '+x', pieces: ['glass', 'glassdoor', 'glassLarge', 'covered', 'glassdoor', 'solid', 'glass'] },
  // restrooms in the lounge's south-east corner: women's (x -2.5..0) and men's (x 0..2.5), doors toward the lounge
  { a: [-2.5, 10], b: [2.5, 10], face: '-z', pieces: ['door', 'door'] },
  { a: [-2.5, 10], b: [-2.5, 15], face: '-x', pieces: ['solid', 'solid'] },
  { a: [0, 10], b: [0, 15], face: '+x', pieces: ['solid', 'solid'] },
  // east wing: Cyber Security behind a glass front with its door near the west end, the corridor on to the moved elevator
  { a: [20, -5], b: [30, -5], face: '+z', pieces: ['glass', 'glassdoor', 'glassLarge', 'covered'] },
  { a: [20, -15], b: [20, -5], face: '+x', pieces: repeat('solid', 4) },
  { a: [30, -15], b: [30, -2.5], face: '-x', pieces: ['solid', 'window', 'window', 'solid', 'elevator'] },
  { a: [20, -2.5], b: [30, -2.5], face: '-z', pieces: ['solid', 'window', 'window', 'solid'] },
];

/** Door opening inside a Synty door piece (local x), and the half width of the double door in the middle of a 5 m piece. */
export const DOOR_OPEN = [0.7, 1.8] as const;
/** A glass wall's door sits at one end of the piece, not in the middle. */
export const GLASS_DOOR_OPEN = [0.15, 1.15] as const;
export const LARGE_DOOR_HALF = 0.95;

/** Local → world for piece i of a run (spanning `span` slots): origin, rotation and which world span it covers. */
export function piecePlacement(run: WallRun, i: number, span = 1) {
  const alongX = run.a[1] === run.b[1];
  const sign = alongX ? Math.sign(run.b[0] - run.a[0]) : Math.sign(run.b[1] - run.a[1]);
  const s0 = (alongX ? run.a[0] : run.a[1]) + sign * PIECE * i;
  const s1 = s0 + sign * PIECE * span;
  const lo = Math.min(s0, s1), hi = Math.max(s0, s1);
  // Synty pieces span local x 0..2.5 with their face toward local +z.
  let pos: [number, number, number], rot: number;
  if (alongX) {
    const z = run.a[1];
    if (run.face === '+z') { pos = [lo, 0, z]; rot = 0; } else { pos = [hi, 0, z]; rot = Math.PI; }
  } else {
    const x = run.a[0];
    if (run.face === '+x') { pos = [x, 0, hi]; rot = Math.PI / 2; } else { pos = [x, 0, lo]; rot = -Math.PI / 2; }
  }
  return { pos, rot, alongX, lo, hi, fixed: alongX ? run.a[1] : run.a[0] };
}

/** Collision boxes for every wall piece (door pieces leave their opening free). */
function wallBoxes(): Box[] {
  const out: Box[] = [];
  const t = 0.1;
  for (const run of WALL_RUNS) {
    run.pieces.forEach((k, i) => {
      if (k === 'open' || k === 'covered') return;
      const p = piecePlacement(run, i, WIDE.has(k) ? 2 : 1);
      const mid = (p.lo + p.hi) / 2;
      // local x runs with the world axis for '+z' and '-x' runs, against it for '-z' and '+x'
      const forward = run.face === '+z' || run.face === '-x';
      const hole = (a: number, b: number): [number, number] => (forward ? [p.lo + a, p.lo + b] : [p.hi - b, p.hi - a]);
      const gap = k === 'glassdoor' ? hole(...GLASS_DOOR_OPEN) : hole(...DOOR_OPEN);
      const spans: [number, number][] = k === 'door' || k === 'glassdoor' || k === 'lowgap'
        ? [[p.lo, gap[0]], [gap[1], p.hi]]
        : k === 'doorLarge' || k === 'glassLargeDoor'
          ? [[p.lo, mid - LARGE_DOOR_HALF], [mid + LARGE_DOOR_HALF, p.hi]]
          : [[p.lo, p.hi]];
      for (const [a, b] of spans) out.push(p.alongX ? { minX: a, maxX: b, minZ: p.fixed - t, maxZ: p.fixed + t } : { minX: p.fixed - t, maxX: p.fixed + t, minZ: a, maxZ: b });
    });
  }
  return out;
}

// Kept for older code paths (the 3rd-person camera keeps clear of these).
export type WallKind = 'solid' | 'glass' | 'low';
export interface Wall { box: Box; kind: WallKind; }
export const WALLS: Wall[] = wallBoxes().map((b) => ({ box: b, kind: 'solid' as const }));

// ------------------------------------------------------------------ workspace
export const DESK_SIZE = { w: 1.92, d: 0.89 };
/** Cubicles are 2 m wide, open toward +z; the person sits on the +z side facing -z (rot π). */
export const CUBICLE = { w: 2.0, back: -0.5, front: 0.5 };
const CUBE_X = [6.5, 8.5, 10.5, 12.5, 14.5];
const CUBE_Z = [1.6, 6.2, 10.8];
export const DESKS: Record<AgentId, { x: number; z: number }> = {
  research: { x: 8.5, z: 6.2 },
  developer: { x: 10.5, z: 6.2 },
  designer: { x: 8.5, z: 10.8 },
  qa: { x: 10.5, z: 10.8 },
  manager: { x: -6.25, z: -11.2 },
};
const isAgentDesk = (x: number, z: number) => Object.values(DESKS).some((d) => d.x === x && d.z === z);
export const CUBICLE_DESKS = CUBE_Z.flatMap((z) => CUBE_X.map((x) => ({ x, z })));
/** Cubicles of the rest of the staff (not agents). */
export const STAFF_DESKS = CUBICLE_DESKS.filter((d) => !isAgentDesk(d.x, d.z));
/** The manager's desk is turned round so she faces her door; everyone else sits on the +z side facing -z. */
export const DESK_ROT: Partial<Record<AgentId, number>> = { manager: Math.PI };
export const deskSeat = (id: AgentId): Spot => (DESK_ROT[id]
  ? { x: DESKS[id].x, z: DESKS[id].z - 0.82, rot: 0 }
  : { x: DESKS[id].x, z: DESKS[id].z + 0.82, rot: Math.PI });

// ------------------------------------------------------------------ meeting room
export const MEETING_TABLE = { x: -15, z: -10.3, w: 4.06, d: 2.22 };
/** Seats 0–4 are the agents' (0 = head of the table), the rest are free for the player. */
export const MEETING_SEATS: Spot[] = [
  { x: -17.5, z: -10.3, rot: Math.PI / 2 },
  { x: -16.25, z: -11.9, rot: 0 },
  { x: -15, z: -11.9, rot: 0 },
  { x: -16.25, z: -8.7, rot: Math.PI },
  { x: -15, z: -8.7, rot: Math.PI },
];
export const GUEST_SEATS: Spot[] = [
  { x: -13.75, z: -11.9, rot: 0 },
  { x: -13.75, z: -8.7, rot: Math.PI },
];
export const MEETING_SCREEN = { x: -15, y: 1.75, z: -14.82 };

// ------------------------------------------------------------------ whiteboard (corridor wall, facing the workspace)
export const WHITEBOARD = { x: 12.5, z: -2.38, w: 3.6, h: 2.0 };
export const WHITEBOARD_SPOT: Spot = { x: 12.5, z: -1.1, rot: Math.PI };

// ------------------------------------------------------------------ kitchen
export const COFFEE_BAR = { x: -19.45, z: 1.0, w: 1.05, d: 4.2 }; // counter run along the left wall, fronts face +x
export const KITCHEN_ISLAND = { x: -15.2, z: 1.2, w: 2.06, d: 2.0 };
export const COFFEE_SPOTS: Spot[] = [
  { x: -18.3, z: -0.2, rot: -Math.PI / 2 },
  { x: -18.3, z: 2.0, rot: -Math.PI / 2 },
  { x: -13.6, z: 3.4, rot: -2.3 },
  { x: -16.8, z: 3.5, rot: 2.6 },
];

// ------------------------------------------------------------------ lounge
export const POOL_TABLES = [{ x: -5.6, z: 1.8 }, { x: -1.6, z: 7.2 }];
export const FOOSBALL = { x: -7.5, z: 7.4 };
export const SOFA = { x: -5.0, z: 13.6, w: 2.3, d: 0.85 };
export const LOUNGE_TABLE = { x: -5.0, z: 12.2, w: 1.0, d: 0.7 };
export const BEANBAGS: [number, number, string, number][] = [[-7.6, 11.6, 'Chair_BeanBag_01', 0.8], [-3.4, 11.0, 'Chair_BeanBag_02', -0.8], [-8.6, -0.6, 'Chair_BeanBag_03', 0.5], [0.8, 0.2, 'Chair_BeanBag_04', -0.6]];

// ------------------------------------------------------------------ reception
export const RECEPTION = { x: -15.2, z: 9.0 };
export const LOBBY_SOFA = { x: -18.9, z: 11.0 };

// ------------------------------------------------------------------ game room
export const TABLE_TENNIS = { x: 15, z: -9.2 };

// ------------------------------------------------------------------ cyber security (east wing)
/** Two rows of three analyst consoles (cubicle desks without partitions) facing the video wall; analysts sit on the +z side. */
export const SOC_DESKS = [-11.2, -8.3].flatMap((z) => [23.08, 25.0, 26.92].map((x) => ({ x, z })));
/** Middle of the video wall on the north wall (the wall's face). */
export const SOC_WALL = { x: 25, y: 1.72, z: -14.85 };
/** Where visitors stand behind the back row to watch the video wall. */
export const SOC_SPOTS: Spot[] = [{ x: 24.0, z: -6.15, rot: Math.PI }, { x: 25.9, z: -6.2, rot: Math.PI }, { x: 21.3, z: -9.7, rot: 2.6 }, { x: 28.7, z: -9.6, rot: -2.6 }];
/** The back row's middle console is free: the player can sit there. */
export const SOC_FREE_SEAT: Spot = { x: SOC_DESKS[4].x, z: SOC_DESKS[4].z + 0.82, rot: Math.PI };

/** Big plants: [x, z, model]. */
export const PLANTS: [number, number, string][] = [
  [-19.2, -14.2, 'Plant_13'], [-10.8, -14.2, 'Plant_12'], [-3.3, -14.2, 'Plant_06'], [19.2, -14.2, 'Plant_14'],
  [-19.2, 14.2, 'Plant_14'], [-10.8, 14.2, 'Plant_12'], [19.2, 14.2, 'Plant_14'], [3.3, 14.2, 'Plant_12'],
  [-9.35, -2.05, 'Plant_05'], [1.7, -1.7, 'Plant_04'], [19.35, -0.4, 'Plant_06'],
];
/**
 * Floor-standing decor people walk around: [model, x, z, rotY, w, d], where w × d is the world footprint.
 * Shelf_* models get filled with books and plants.
 */
export const FLOOR_DECOR: [string, number, number, number, number, number][] = [
  ['Shelf_06', -19.62, -8.0, Math.PI / 2, 0.45, 1.45], // meeting room sideboard under the windows
  ['Plant_02', -19.3, -5.7, 0.4, 0.6, 0.6],
  ['Shelf_07', -6.25, -14.6, 0, 3.1, 0.5], // manager's bookcase
  ['Plant_01', -9.45, -14.4, 0.8, 0.7, 0.7],
  ['Shelf_01', -2.07, -12.0, Math.PI / 2, 0.5, 1.25], // studio
  ['Plant_02', 4.4, -14.4, 1.1, 0.6, 0.6],
  ['Shelf_04', 10.52, -11.5, Math.PI / 2, 0.7, 1.15], // game room trophies
  ['Plant_02', 10.7, -5.7, 2.0, 0.6, 0.6],
  ['Plant_02', -19.5, -4.5, 0.3, 0.6, 0.6], // corridor ends
  ['Plant_02', 19.5, -4.5, 2.4, 0.6, 0.6],
  ['Plant_10', -18.4, 4.55, 0.5, 0.5, 0.5], // kitchen
  ['CoatRack_01', -18.3, 14.3, 0.3, 0.5, 0.5], // reception
  ['Shelf_05', -19.6, 9.2, Math.PI / 2, 0.45, 1.4],
  ['Shelf_02', -9.57, -0.55, Math.PI / 2, 0.5, 2.2], // lounge library wall
  ['Plant_13', -9.3, 14.3, 0.6, 0.8, 0.8],
  ['Plant_12', -3.3, 14.35, 1.7, 0.8, 0.8],
  ['Plant_04', 4.95, 6.0, 0.2, 0.7, 0.7], // ends of the cubicle rows
  ['Plant_05', 4.95, 10.6, 1.4, 0.7, 0.7],
  ['Plant_05', 16.3, 1.4, 0.9, 0.7, 0.7],
  ['Plant_04', 16.3, 6.0, 2.2, 0.7, 0.7],
  ['Plant_02', 16.3, 10.6, 0.7, 0.7, 0.7],
  // meeting room side table, manager's small meeting table and vintage cabinet
  ['Table_02', -11.2, -9.6, 0, 1.35, 1.3],
  ['Table_Conference_03', -6.6, -7.6, Math.PI / 2, 2.9, 4.1],
  ['Cabinets_02', -9.4, -11.5, Math.PI / 2, 0.9, 0.7],
  // studio second desk
  ['Desk_02', 3.3, -8.0, 0, 2.0, 2.0],
  // server room: supply rack, small rack, power, cart, utility sink
  ['Shelf_03', 9.7, -11.0, -Math.PI / 2, 0.5, 1.2],
  ['Server_Cabinet_03', 5.55, -11.0, Math.PI / 2, 0.8, 0.6],
  ['Powerbox_01', 9.45, -7.6, -Math.PI / 2, 0.8, 1.0],
  ['PowerBox_02', 5.35, -7.0, Math.PI / 2, 0.3, 0.4],
  ['AirVent_02', 7.5, -14.55, 0, 1.25, 0.55],
  ['Cart_02', 8.8, -6.6, Math.PI / 2, 1.1, 0.7],
  ['Sink_01', 9.5, -5.6, -Math.PI / 2, 0.8, 0.8],
  ['Janitor_Bucket_01', 8.6, -5.65, 0, 0.5, 0.5],
  // game room: retro gaming table, TV on wheels, mini fridge
  ['Table_01', 10.85, -13.6, Math.PI / 2, 1.35, 2.15],
  ['Rolling_TV_01', 16.8, -11.6, Math.PI, 1.3, 0.9],
  ['MiniFridge_01', 19.45, -12.6, -Math.PI / 2, 0.8, 0.8],
  // kitchen second fridge
  ['Fridge_02', -19.4, -1.9, Math.PI / 2, 0.85, 0.95],
  // reception: sculpture, armchair, visitor chairs, mail cart
  ['Sculpture_Base_01', -12.0, 12.6, 0, 1.7, 1.7],
  ['Couch_01', -16.6, 11.0, -Math.PI / 2, 0.95, 1.2],
  ['Chair_08', -15.2, 10.5, Math.PI, 0.75, 0.75],
  ['Chair_08', -14.0, 10.5, Math.PI, 0.75, 0.75],
  ['Cart_01', -17.0, 14.2, Math.PI / 2, 1.2, 0.6],
  // workspace: supply rack, coffee point, standing desk, print station, corridor vacuum
  ['Shelf_03', 19.55, 5.8, -Math.PI / 2, 0.5, 1.2],
  ['Table_03', 9.5, 14.3, Math.PI, 1.9, 0.9],
  ['Desk_Standing_01', 6.4, 14.1, Math.PI, 1.6, 0.85],
  ['Desk_05', 13.4, 13.8, Math.PI, 2.75, 2.1],
  ['Vacuum_01', 5.0, -4.5, 0.3, 0.9, 0.7],
  // lounge: a laptop desk against the restroom wall
  ['Desk_01', -3.1, 12.9, -Math.PI / 2, 0.9, 2.0],
  // cyber security: racks in the north-east corner, a supply rack and the incident board on the west wall, files, shredder
  ['Server_Cabinet_01_Full', 29.35, -14.3, -Math.PI / 2, 1.0, 0.93],
  ['Server_Cabinet_02_Full', 29.35, -13.35, -Math.PI / 2, 1.0, 0.93],
  ['Shelf_03', 20.42, -13.3, Math.PI / 2, 0.5, 1.2],
  ['Whiteboard_02', 20.55, -9.7, Math.PI / 2, 0.71, 1.63],
  ['Cabinets_01', 29.58, -9.4, -Math.PI / 2, 0.56, 0.48],
  ['Cabinets_03', 29.58, -8.9, -Math.PI / 2, 0.56, 0.48],
  ['PaperShredder_01', 20.32, -6.3, Math.PI / 2, 0.25, 0.35],
  ['Plant_05', 29.45, -5.55, -0.6, 0.8, 0.8],
];

export const PLAYER_SPAWN: Spot = { x: -13.75, z: 13.6, rot: Math.PI };

/** Cubicle partitions as thin boxes. */
function cubicleWalls(): Box[] {
  const out: Box[] = [];
  const w = (x1: number, z1: number, x2: number, z2: number): Box => ({ minX: Math.min(x1, x2) - 0.04, minZ: Math.min(z1, z2) - 0.04, maxX: Math.max(x1, x2) + 0.04, maxZ: Math.max(z1, z2) + 0.04 });
  for (const d of CUBICLE_DESKS) {
    out.push(w(d.x - 1, d.z + CUBICLE.back, d.x + 1, d.z + CUBICLE.back));
    out.push(w(d.x - 1, d.z + CUBICLE.back, d.x - 1, d.z + CUBICLE.front));
    out.push(w(d.x + 1, d.z + CUBICLE.back, d.x + 1, d.z + CUBICLE.front));
  }
  return out;
}

export const OBSTACLES: Box[] = [
  ...wallBoxes(),
  ...cubicleWalls(),
  ...CUBICLE_DESKS.map((d) => box(d.x, d.z, DESK_SIZE.w, DESK_SIZE.d)),
  ...SOC_DESKS.map((d) => box(d.x, d.z, DESK_SIZE.w, DESK_SIZE.d)),
  box(DESKS.manager.x, DESKS.manager.z, 2.18, 0.95),
  box(MEETING_TABLE.x, MEETING_TABLE.z, MEETING_TABLE.w, MEETING_TABLE.d),
  box(COFFEE_BAR.x, COFFEE_BAR.z, COFFEE_BAR.w, COFFEE_BAR.d),
  box(KITCHEN_ISLAND.x, KITCHEN_ISLAND.z, KITCHEN_ISLAND.w, KITCHEN_ISLAND.d),
  box(-19.4, 3.9, 0.8, 1.3), // fridge
  box(-11.0, -1.8, 1.25, 0.85), // vending machine
  box(-12.6, -1.9, 0.6, 0.5), // water cooler
  ...POOL_TABLES.map((p) => box(p.x, p.z, 3.4, 1.95)),
  box(FOOSBALL.x, FOOSBALL.z, 1.5, 1.45),
  box(SOFA.x, SOFA.z, SOFA.w, SOFA.d),
  box(LOUNGE_TABLE.x, LOUNGE_TABLE.z, LOUNGE_TABLE.w, LOUNGE_TABLE.d),
  ...BEANBAGS.map(([x, z]) => box(x, z, 0.9, 0.9)),
  box(RECEPTION.x + 0.04, RECEPTION.z + 0.25, 3.2, 0.9), box(RECEPTION.x - 1.15, RECEPTION.z - 0.6, 0.8, 1.0), // L-shaped desk; the receptionist sits in its corner
  box(LOBBY_SOFA.x, LOBBY_SOFA.z, 0.95, 2.3),
  box(TABLE_TENNIS.x, TABLE_TENNIS.z, 4.1, 2.05),
  box(19.3, -8.6, 1.0, 0.9), // arcade
  box(19.3, -6.6, 0.8, 1.2), // jukebox
  box(19.4, -11.3, 0.85, 1.25), // vending machine
  box(11.9, -6.9, 1.9, 1.9), // snack table
  box(-3.6, -7.0, 0.92, 1.94), // manager couch
  box(1.25, -13.4, 3.6, 2.0), // green screen
  box(7.5, -12.5, 4.2, 1.0), // server racks
  box(7.5, -9.5, 4.2, 1.0),
  box(16.5, 12.8, 1.5, 0.65), // photocopier
  box(-8.4, 9.0, 2.2, 2.2), // lounge corner seating
  box(-9.33, 5.2, 1.0, 0.9), // lounge arcade
  // restrooms: stalls, vanities, urinals
  box(-1.245, 14.075, 2.15, 1.55), box(1.305, 14.075, 2.15, 1.55),
  box(-2.095, 11.65, 0.81, 2.5), box(0.555, 11.65, 0.81, 2.5), box(2.29, 11.7, 0.42, 2.32),
  // manager meeting chairs, studio desk chair, game room chair, workspace extras
  box(6.4, 13.6, 0.9, 1.8), // treadmill under the standing desk
  box(13.4, 12.3, 0.7, 0.7), // print station chair
  box(11.42, 13.6, 0.1, 2.5), box(7.72, 14.2, 0.1, 1.25), box(4.9, 13.85, 0.1, 2.0), // dividers
  box(18.6, -13.3, 0.7, 0.7), // gym ball
  box(-6.0, -2.1, 1.4, 0.4), // shelf
  box(1.4, 5.4, 0.8, 0.8),
  box(1.0, 6.5, 0.6, 0.6), // fan
  ...PLANTS.map(([x, z]) => box(x, z, 0.8, 0.8)),
  ...FLOOR_DECOR.map(([, x, z, , w, d]) => box(x, z, w, d)),
];

export function visitSpot(of: AgentId): Spot {
  const d = DESKS[of];
  return of === 'manager' ? { x: d.x + 0.35, z: d.z + 1.25, rot: Math.PI } : { x: d.x + 0.55, z: d.z + 1.35, rot: Math.PI };
}

/** Extra places the player can sit. */
export const SOFA_SEATS: Spot[] = [{ x: -5.6, z: 13.25, rot: Math.PI }];

export type InteractableKind = 'computer' | 'whiteboard' | 'meeting' | 'manager' | 'desk' | 'seat';
export interface Interactable { id: string; kind: InteractableKind; x: number; z: number; label: string; agent?: AgentId; seat?: Spot; }

export const INTERACTABLES: Interactable[] = [
  ...(Object.keys(DESKS) as AgentId[]).map((id) => ({ id: `pc-${id}`, kind: 'computer' as const, x: DESKS[id].x, z: DESKS[id].z + 0.2, label: 'Open task panel', agent: id })),
  { id: 'whiteboard', kind: 'whiteboard', x: WHITEBOARD.x, z: WHITEBOARD.z + 0.9, label: 'View project whiteboard' },
  { id: 'meeting', kind: 'meeting', x: MEETING_TABLE.x, z: MEETING_TABLE.z, label: 'Watch the team discussion' },
  { id: 'manager-office', kind: 'manager', x: DESKS.manager.x + 2.2, z: DESKS.manager.z + 1.0, label: 'Open task management' },
  ...GUEST_SEATS.map((s, i) => ({ id: `guest-seat-${i}`, kind: 'seat' as const, x: s.x, z: s.z, label: 'Sit at the meeting table', seat: s })),
  ...SOFA_SEATS.map((s, i) => ({ id: `sofa-${i}`, kind: 'seat' as const, x: s.x, z: s.z - 0.6, label: 'Sit on the sofa', seat: s })),
  { id: 'soc-seat', kind: 'seat', x: SOC_FREE_SEAT.x, z: SOC_FREE_SEAT.z + 0.6, label: 'Sit at the free security console', seat: SOC_FREE_SEAT },
];
