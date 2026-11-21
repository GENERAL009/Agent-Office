// The rest of the staff: people who work in the office but are not agents.
// They sit at their cubicles, chat in the kitchen and the lounge, and a few walk around.
import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SyntyAvatar, type Wearable } from './SyntyAvatar';
import type { Gesture, Pose, PoseMode } from './Avatar';
import type { Palette } from './assets';
import { STAFF_DESKS, RECEPTION, LOBBY_SOFA, KITCHEN_ISLAND, POOL_TABLES, FOOSBALL, SOFA, BEANBAGS, TABLE_TENNIS, SOC_DESKS, type Spot } from '../world/layout';
import { findPath, type P } from '../world/nav';
import { walkers } from '../world/runtime';

interface Still { kind: 'still'; model: string; palette?: Palette; at: Spot; mode: PoseMode; talking?: boolean; gesture?: Gesture; wear?: Wearable[] }
interface Walker { kind: 'walk'; model: string; palette?: Palette; wear?: Wearable[]; stops: { at: Spot; wait: number; gesture?: Gesture; talking?: boolean }[] }
type Npc = Still | Walker;

const seat = (d: { x: number; z: number }): Spot => ({ x: d.x, z: d.z + 0.82, rot: Math.PI });

const DESK_STAFF: [string, Palette][] = [
  ['SK_Chr_Business_Male_04', '01'], ['SK_Chr_Developer_Female_02', '01'], ['SK_Chr_Business_Male_03', '03'],
  ['SK_Chr_Business_Female_03', '01'], ['SK_Chr_Business_Female_04', '02'], ['SK_Chr_Business_Male_01', '04'],
  ['SK_Chr_Developer_Male_02', '03'], ['SK_Chr_Business_Female_01', '04'], ['SK_Chr_Boss_Male_01', '02'],
];
const atDesks: Npc[] = STAFF_DESKS
  .filter((_, i) => i % 4 !== 3) // the 4th, 8th… cubicles are empty (see Workspace)
  .map((d, i) => ({ kind: 'still', model: DESK_STAFF[i % DESK_STAFF.length][0], palette: DESK_STAFF[i % DESK_STAFF.length][1], at: seat(d), mode: 'type', wear: ([['Identity'], ['Pens'], [], ['Identity', 'Pens']] as Wearable[][])[i % 4] }));

/** Cyber Security analysts: front row and the back row's west console (the back middle one is free, the east one's owner walks about). */
const SOC_STAFF: [number, string, Palette][] = [
  [0, 'SK_Chr_Developer_Female_02', '02'], [1, 'SK_Chr_Business_Male_03', '04'], [2, 'SK_Chr_Developer_Male_02', '03'], [3, 'SK_Chr_Business_Female_04', '03'],
];
// No wearables here: each one is a draw call of its own (the headsets lie on the desks instead).
const atSoc: Npc[] = SOC_STAFF.map(([desk, model, palette]) => ({ kind: 'still', model, palette, at: seat(SOC_DESKS[desk]), mode: 'type' }));

const P0 = POOL_TABLES[0];
const STAFF: Npc[] = [
  ...atDesks,
  // reception
  { kind: 'still', model: 'SK_Chr_Business_Female_02', at: { x: RECEPTION.x + 0.3, z: RECEPTION.z - 0.7, rot: 0 }, mode: 'type', wear: ['Earpiece', 'Nametag'] },
  { kind: 'still', model: 'SK_Chr_Business_Male_04', palette: '02', at: { x: LOBBY_SOFA.x + 0.3, z: LOBBY_SOFA.z - 0.5, rot: Math.PI / 2 }, mode: 'sit' },
  // kitchen
  { kind: 'still', model: 'SK_Chr_Business_Female_03', palette: '03', at: { x: -17.8, z: 3.2, rot: 2.5 }, mode: 'stand', gesture: 'drink' },
  { kind: 'still', model: 'SK_Chr_Developer_Female_02', palette: '04', at: { x: KITCHEN_ISLAND.x - 0.5, z: KITCHEN_ISLAND.z + 1.45, rot: Math.PI }, mode: 'sit', talking: true },
  { kind: 'still', model: 'SK_Chr_Boss_Male_01', palette: '03', at: { x: KITCHEN_ISLAND.x + 1.3, z: KITCHEN_ISLAND.z + 1.7, rot: -2.2 }, mode: 'stand', talking: true },
  // lounge
  { kind: 'still', model: 'SK_Chr_Business_Male_03', palette: '02', at: { x: P0.x - 2.1, z: P0.z + 0.3, rot: Math.PI / 2 }, mode: 'stand' },
  { kind: 'still', model: 'SK_Chr_Business_Female_01', palette: '03', at: { x: P0.x + 0.4, z: P0.z - 1.45, rot: 0 }, mode: 'stand', talking: true },
  { kind: 'still', model: 'SK_Chr_Business_Female_04', at: { x: SOFA.x + 0.6, z: SOFA.z - 0.35, rot: Math.PI }, mode: 'sit', talking: true },
  { kind: 'still', model: 'SK_Chr_Developer_Male_02', palette: '04', at: { x: BEANBAGS[0][0], z: BEANBAGS[0][1], rot: BEANBAGS[0][3] }, mode: 'sit' },
  { kind: 'still', model: 'SK_Chr_Business_Male_01', palette: '02', at: { x: FOOSBALL.x - 1.0, z: FOOSBALL.z, rot: Math.PI / 2 }, mode: 'stand' },
  { kind: 'still', model: 'SK_Chr_Business_Male_02', palette: '02', at: { x: FOOSBALL.x + 1.0, z: FOOSBALL.z, rot: -Math.PI / 2 }, mode: 'stand', talking: true },
  // game room
  { kind: 'still', model: 'SK_Chr_Business_Male_02', palette: '04', at: { x: TABLE_TENNIS.x - 2.6, z: TABLE_TENNIS.z, rot: Math.PI / 2 }, mode: 'stand' },
  { kind: 'still', model: 'SK_Chr_Business_Female_02', palette: '02', at: { x: TABLE_TENNIS.x + 2.6, z: TABLE_TENNIS.z, rot: -Math.PI / 2 }, mode: 'stand', talking: true },
  { kind: 'still', model: 'SK_Chr_Business_Male_04', palette: '03', at: { x: 18.3, z: -8.6, rot: Math.PI / 2 }, mode: 'stand', wear: ['Antlers'] },
  // studio: someone is recording a video
  { kind: 'still', model: 'SK_Chr_Business_Female_03', at: { x: 1.3, z: -9.0, rot: Math.PI }, mode: 'stand' },
  { kind: 'still', model: 'SK_Chr_Boss_Male_01', at: { x: 0.6, z: -12.6, rot: 0.15 }, mode: 'sit', talking: true },
  { kind: 'still', model: 'SK_Chr_Business_Female_04', palette: '03', at: { x: 1.9, z: -12.6, rot: -0.15 }, mode: 'sit' },
  { kind: 'still', model: 'SK_Chr_Developer_Male_02', at: { x: -0.9, z: -7.55, rot: 0 }, mode: 'type' },
  // restroom visitors: a while at the mirror, then back out to the lounge, coffee or their desk
  {
    kind: 'walk', model: 'SK_Chr_Business_Female_03', palette: '02', stops: [
      { at: { x: -1.35, z: 11.4, rot: -Math.PI / 2 }, wait: 8 },
      { at: { x: -6.5, z: 11.0, rot: Math.PI }, wait: 14, talking: true },
      { at: { x: -13.0, z: 10.8, rot: -Math.PI / 2 }, wait: 10 },
    ],
  },
  {
    kind: 'walk', model: 'SK_Chr_Business_Male_01', palette: '03', stops: [
      { at: { x: 1.35, z: 11.9, rot: -Math.PI / 2 }, wait: 8 },
      { at: { x: -17.8, z: 2.4, rot: -Math.PI / 2 }, wait: 12, gesture: 'drink' },
      { at: { x: 6.4, z: 12.3, rot: 0 }, wait: 16 },
    ],
  },
  // server room and corridor
  { kind: 'still', model: 'SK_Chr_Security_Female_01', at: { x: 7.4, z: -11.0, rot: 0 }, mode: 'stand' },
  // cyber security: the shift lead briefs the analysts in front of the video wall; one analyst checks the racks and the server room
  ...atSoc,
  { kind: 'still', model: 'SK_Chr_Boss_Male_01', palette: '04', at: { x: 22.2, z: -12.7, rot: 0.55 }, mode: 'stand', talking: true },
  {
    kind: 'walk', model: 'SK_Chr_Business_Female_01', palette: '02', stops: [
      { at: { x: 28.3, z: -13.8, rot: Math.PI / 2 }, wait: 9 },
      { at: { x: 6.4, z: -7.6, rot: Math.PI }, wait: 8 },
      { at: { x: 27.6, z: -6.4, rot: Math.PI }, wait: 12, talking: true },
    ],
  },
  // security at the main entrance, one each side of the doors, facing the street
  { kind: 'still', model: 'SK_Chr_Security_Male_01', palette: '02', at: { x: -16.65, z: 16.0, rot: 0 }, mode: 'stand', wear: ['Earpiece'] },
  { kind: 'still', model: 'SK_Chr_Security_Female_01', at: { x: -13.35, z: 16.0, rot: 0 }, mode: 'stand', wear: ['Earpiece'] },
  // the cleaner makes her rounds with a mop: corridor, restrooms, kitchen, reception, workspace
  {
    kind: 'walk', model: 'SK_Chr_Cleaner_Female_01', wear: ['Mop'], stops: [
      { at: { x: 5.6, z: -3.7, rot: -0.5 }, wait: 6 },
      { at: { x: -6.0, z: -3.75, rot: Math.PI / 2 }, wait: 7 },
      { at: { x: -1.0, z: 9.2, rot: Math.PI }, wait: 7 },
      { at: { x: -12.4, z: 3.6, rot: -Math.PI / 2 }, wait: 7 },
      { at: { x: -13.7, z: 12.6, rot: Math.PI }, wait: 6 },
      { at: { x: 10.5, z: 12.6, rot: Math.PI }, wait: 6 },
    ],
  },
  {
    kind: 'walk', model: 'SK_Chr_Security_Male_01', stops: [
      { at: { x: -18.4, z: -3.75, rot: Math.PI / 2 }, wait: 3 },
      { at: { x: 28.4, z: -3.75, rot: -Math.PI / 2 }, wait: 3 },
      { at: { x: 18.4, z: 8.0, rot: Math.PI }, wait: 2 },
      { at: { x: 4.2, z: 13.0, rot: 0 }, wait: 2 },
    ],
  },
  {
    kind: 'walk', model: 'SK_Chr_Cleaner_Male_01', stops: [
      { at: { x: -18.0, z: 2.0, rot: -Math.PI / 2 }, wait: 7, gesture: 'drink' },
      { at: { x: 16.5, z: 11.9, rot: Math.PI }, wait: 5 },
      { at: { x: -3.0, z: 4.6, rot: 0 }, wait: 4, talking: true },
    ],
  },
];

const angleLerp = (a: number, b: number, k: number) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
};

function StillNpc({ npc }: { npc: Still }) {
  const pose = useRef<Pose>({ mode: npc.mode, talking: !!npc.talking, gesture: npc.gesture ?? null });
  return (
    <group position={[npc.at.x, 0, npc.at.z]} rotation={[0, npc.at.rot, 0]}>
      <SyntyAvatar model={npc.model} palette={npc.palette} pose={pose} wear={npc.wear} />
    </group>
  );
}

function WalkingNpc({ npc }: { npc: Walker }) {
  const group = useRef<THREE.Group>(null!);
  const pose = useRef<Pose>({ mode: 'stand', talking: false, gesture: null });
  const st = useRef({ x: npc.stops[0].at.x, z: npc.stops[0].at.z, rot: npc.stops[0].at.rot, leg: 0, path: [] as P[], wait: npc.stops[0].wait });
  useEffect(() => {
    group.current.position.set(st.current.x, 0, st.current.z);
    const me = st.current;
    walkers.add(me);
    return () => { walkers.delete(me); };
  }, []);
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const s = st.current;
    if (s.wait > 0) {
      s.wait -= dt;
      const stop = npc.stops[s.leg];
      s.rot = angleLerp(s.rot, stop.at.rot, 1 - Math.exp(-dt * 6));
      pose.current = { mode: 'stand', talking: !!stop.talking, gesture: stop.gesture ?? null };
      if (s.wait <= 0) {
        s.leg = (s.leg + 1) % npc.stops.length;
        s.path = findPath({ x: s.x, z: s.z }, npc.stops[s.leg].at);
      }
    } else if (s.path.length) {
      const next = s.path[0];
      const dx = next.x - s.x, dz = next.z - s.z, dist = Math.hypot(dx, dz), step = 1.25 * dt;
      if (dist <= step) {
        s.x = next.x; s.z = next.z;
        s.path.shift();
        if (!s.path.length) s.wait = npc.stops[s.leg].wait;
      } else {
        s.x += (dx / dist) * step;
        s.z += (dz / dist) * step;
        s.rot = angleLerp(s.rot, Math.atan2(dx, dz), 1 - Math.exp(-dt * 10));
      }
      pose.current = { mode: 'walk', talking: false, gesture: null };
    } else {
      s.wait = npc.stops[s.leg].wait;
    }
    group.current.position.set(s.x, 0, s.z);
    group.current.rotation.y = s.rot;
  });
  return (
    <group ref={group}>
      <SyntyAvatar model={npc.model} palette={npc.palette} pose={pose} wear={npc.wear} />
    </group>
  );
}

export function Npcs() {
  return (
    <>
      {STAFF.map((n, i) => (n.kind === 'still' ? <StillNpc key={i} npc={n} /> : <WalkingNpc key={i} npc={n} />))}
    </>
  );
}
