// The office building, made of Synty POLYGON Office pieces placed on the floor plan in world/layout.ts.
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useOffice, selectProject } from '../store/useOffice';
import { AGENT_IDS } from '../core/types';
import { PROFILES } from '../core/agents';
import {
  FLOOR, ROOMS, WALL_RUNS, PIECE, piecePlacement, DESKS, STAFF_DESKS, MEETING_TABLE, MEETING_SEATS, GUEST_SEATS, MEETING_SCREEN,
  WHITEBOARD, SOFA, LOUNGE_TABLE, POOL_TABLES, FOOSBALL, BEANBAGS, KITCHEN_ISLAND, RECEPTION, LOBBY_SOFA, TABLE_TENNIS, PLANTS,
  FLOOR_DECOR, WIDE, DOOR_OPEN, LARGE_DOOR_HALF, DESK_ROT, SOC_DESKS, roomAt, type WallStyle,
} from '../world/layout';
import { Bookcase, StaffDesk, Workstation } from './Furniture';
import { Fitout } from './Fitout';
import { StaticBatch } from './StaticBatch';
import { SecurityLive } from './Security';
import { BEACONS, TV_Z, VIDEO_WALL } from './socScreens';
import { Prop, type Palette } from './assets';
import { useCanvasTexture, roundRect, fitText, FONT, MONO } from './canvasTexture';
import { agentBodies, player, shotCamera, walkers } from '../world/runtime';

const pointer = (on: boolean) => () => { document.body.style.cursor = on ? 'pointer' : ''; };
const click = (fn: () => void) => (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); fn(); };

// ------------------------------------------------------------------ building shell
const STYLE_PREFIX: Record<WallStyle, string> = { blank: 'B:Wall_Blank', trim: 'B:Wall_Trim', baseboard: 'B:Wall_Baseboard', brick: 'B:Wall_Brick' };
const WINDOW_N = ['01', '02', '04'];
const BLIND_STATES = ['Open', 'Up', 'Down', 'Open', 'Closed'];
/** Door leaves by the room they open into. */
const DOOR_LEAF: Record<string, string> = { server: 'B:Door_05', cubicles: 'B:Door_04', lounge: 'B:Door_03', reception: 'B:Door_02', 'wc-women': 'B:Door_01', 'wc-men': 'B:Door_01' };

/** A door leaf: hinge position in the wall piece's frame, which way it swings (+1 / -1), and where the model sits relative to the hinge. */
interface Leaf { model: string; x: number; z: number; swing: number; offset?: [number, number] }
interface Piece {
  key: string; model: string; pos: [number, number, number]; rot: number; palette: Palette; low: boolean;
  blinds?: string; elevator?: boolean; pillar?: string; hide?: string[];
  /** Door leaves, the middle and half width of the opening (piece frame x), and whether there are light switches beside it. */
  door?: { leaves: Leaf[]; mid: number; half: number; switches: boolean };
}
const single = (model: string, back: boolean, z = 0.075): Piece['door'] => ({ mid: 1.25, half: 0.55, switches: true, leaves: [{ model, x: DOOR_OPEN[0] + 0.02, z, swing: back ? 1 : -1 }] });
/** The glass wall's own door (frame x 0.11..1.2), hinged at its left edge. */
const glassDoor = (back: boolean): Piece['door'] => ({ mid: 0.65, half: 0.5, switches: false, leaves: [{ model: 'SM_Bld_Glass_Door_01', x: 0.11, z: 0.12, swing: back ? 1 : -1, offset: [-0.11, -0.12] }] });
const double = (): Piece['door'] => ({
  mid: 2.5, half: LARGE_DOOR_HALF, switches: true,
  leaves: [{ model: 'B:Door_Large_01_L', x: 2.5 - LARGE_DOOR_HALF, z: 0.11, swing: -1 }, { model: 'B:Door_Large_01_R', x: 2.5 + LARGE_DOOR_HALF, z: 0.11, swing: 1 }],
});

function wallPieces(): Piece[] {
  // Cycle through the variants (window frames, blind positions) so every one of them shows up somewhere.
  const counters: Record<string, number> = {};
  const cycle = <T,>(key: string, list: readonly T[]) => list[(counters[key] = (counters[key] ?? -1) + 1) % list.length];
  return WALL_RUNS.flatMap((run, r) => run.pieces.map((kind, i): Piece | null => {
    if (kind === 'open' || kind === 'covered') return null;
    const wide = WIDE.has(kind);
    const p = piecePlacement(run, i, wide ? 2 : 1);
    // The room each side of the piece: the face side picks colour and wall family.
    const mid = (p.lo + p.hi) / 2;
    const n = run.face === '+z' ? [0, 0.6] : run.face === '-z' ? [0, -0.6] : run.face === '+x' ? [0.6, 0] : [-0.6, 0];
    const at = (k: number) => (p.alongX ? roomAt(mid + n[0] * k, p.fixed + n[1] * k) : roomAt(p.fixed + n[0] * k, mid + n[1] * k));
    const front = at(1), back = at(-1);
    const S = STYLE_PREFIX[front?.style ?? 'blank'];
    const glassy = kind.startsWith('glass') || kind.startsWith('low');
    const base = { key: `${r}-${i}`, pos: p.pos, rot: p.rot, palette: (glassy ? '01' : front?.walls ?? '01') as Palette, low: kind === 'low' || kind === 'lowgap' };
    switch (kind) {
      case 'solid': case 'whiteboard': return { ...base, model: `${S}_01` };
      case 'window': {
        const w = cycle(S, WINDOW_N);
        // Cyber Security keeps its blinds shut
        return { ...base, model: `${S}_Window_${w}`, blinds: `B:Wall_Window_Blinds_${front?.id === 'security' ? 'Closed' : cycle(w, BLIND_STATES)}_${w}` };
      }
      case 'window2x': return { ...base, model: `${S}_Window_03`, blinds: `B:Wall_Window_Blinds_${cycle('03', BLIND_STATES)}_03` };
      case 'door': {
        // restroom doors open into the restroom; the rest open into the room they face
        const wc = !!back?.id.startsWith('wc');
        return { ...base, model: `${S}_Door_01`, door: single(DOOR_LEAF[wc ? back!.id : front?.id ?? ''] ?? 'B:Door_02', wc) };
      }
      case 'doorLarge': return { ...base, model: `${S}_Door_Large_01`, door: double() };
      case 'elevator': return { ...base, model: r === 1 ? `${S}_Elevator_01` : 'B:Wall_Brick_Elevator_01', elevator: true };
      // glass next to a restroom keeps its blinds shut; Cyber Security's are rolled up so the corridor sees the video wall
      case 'glass': return { ...base, model: 'B:Wall_Glass_01', blinds: `B:Wall_Glass_Window_Blinds_${back?.id.startsWith('wc') ? 'Closed' : back?.id === 'security' ? 'Up' : cycle('glass', ['Open', 'Down', 'Up'])}_01` };
      // the piece's own all-glass door is invisible; a framed door that swings open reads as a door
      case 'glassdoor': return { ...base, model: 'B:Wall_Glass_Door_01', pillar: 'B:Wall_Glass_Pillar_01', hide: ['SM_Bld_Glass_Door_01'], door: glassDoor(front?.id === 'corridor') };
      case 'glassLarge': return { ...base, model: 'B:Wall_Glass_Large_01', blinds: `B:Wall_Glass_Large_Window_Blinds_${front?.id === 'meeting' || back?.id === 'meeting' ? 'Open' : back?.id === 'security' ? 'Up' : cycle('glassLarge', ['Up', 'Down'])}_01`, pillar: 'B:Wall_Glass_Pillar_02' };
      case 'glassLargeDoor': return { ...base, model: 'B:Wall_Glass_Large_Door_01', pillar: 'B:Wall_Glass_Pillar_02', door: double() };
      // the cut-down front wall: plain and in the room's colour, not squashed brick
      case 'low': return { ...base, model: 'B:Wall_Blank_01', palette: (front?.walls ?? '01') as Palette };
      case 'lowgap': return { ...base, model: 'B:Wall_Brick_Door_01' };
    }
    return null;
  }).filter((x): x is Piece => !!x));
}

/**
 * Should a door open? Only for someone in front of it and heading into it (or already in the doorway),
 * so people walking past along the wall don't set it off. Frame: centre c, along-wall axis a, normal n.
 */
function wantsThrough(c: { x: number; z: number }, a: [number, number], half: number) {
  const n: [number, number] = [-a[1], a[0]];
  const check = (x: number, z: number, rot: number) => {
    const dx = x - c.x, dz = z - c.z;
    const u = dx * a[0] + dz * a[1], v = dx * n[0] + dz * n[1];
    if (Math.abs(u) > half + 0.4 || Math.abs(v) > 1.8) return false;
    if (Math.abs(v) < 0.4) return true;
    const toward = -Math.sign(v) * (Math.sin(rot) * n[0] + Math.cos(rot) * n[1]);
    return toward > 0.35;
  };
  for (const b of Object.values(agentBodies)) if (check(b.x, b.z, b.rot)) return true;
  for (const w of walkers) if (check(w.x, w.z, w.rot)) return true;
  if (shotCamera.active && check(shotCamera.x, shotCamera.z, shotCamera.rot)) return true;
  return useOffice.getState().mode === 'life' && check(player.x, player.z, player.facing);
}

/** Doors stay shut and swing open when someone comes close, then close again behind them. */
function Door({ p }: { p: Piece }) {
  const door = p.door!;
  const hinges = useRef<(THREE.Group | null)[]>([]);
  const angle = useRef(0);
  const frame = useMemo(() => {
    const c = Math.cos(p.rot), s = Math.sin(p.rot);
    return {
      center: { x: p.pos[0] + door.mid * c + 0.075 * s, z: p.pos[2] - door.mid * s + 0.075 * c },
      along: [c, -s] as [number, number],
      half: door.half,
    };
  }, [p, door]);
  useFrame((_, dt) => {
    const open = wantsThrough(frame.center, frame.along, frame.half);
    angle.current = THREE.MathUtils.damp(angle.current, open ? 1.45 : 0, 5, Math.min(dt, 0.05));
    door.leaves.forEach((l, i) => { const g = hinges.current[i]; if (g) g.rotation.y = l.swing * angle.current; });
  });
  return (
    <>
      {door.leaves.map((l, i) => (
        <group key={i} ref={(g) => { hinges.current[i] = g; }} position={[l.x, 0, l.z]} userData={{ noBatch: true }}>
          <Prop name={l.model} position={l.offset ? [l.offset[0], 0, l.offset[1]] : undefined} />
        </group>
      ))}
      {door.switches && (
        <>
          <Prop name="Socket_Switch_01" position={[door.mid - door.half - 0.3, 1.2, 0.17]} />
          <Prop name="Socket_Wall_02" position={[door.mid - door.half - 0.3, 0.3, 0.17]} />
        </>
      )}
    </>
  );
}

function Walls() {
  const pieces = useMemo(wallPieces, []);
  return (
    <>
      {pieces.map((p) => (
        <group key={p.key} position={p.pos} rotation-y={p.rot}>
          <Prop name={p.model} scale={p.low ? [1, 0.36, 1] : 1} palette={p.palette} hide={p.hide} />
          {p.blinds && <Prop name={p.blinds} />}
          {p.pillar && <Prop name={p.pillar} />}
          {p.door && <Door p={p} />}
          {p.elevator && (
            <>
              <Prop name="B:Elevator_01" />
              <Prop name="B:Roof_01" position={[0, 2.95, -2.5]} />
              <Prop name={p.model.includes('Brick') ? 'Elevator_Button_02' : 'Elevator_Button_01'} position={[2.3, 1.25, 0.24]} />
            </>
          )}
        </group>
      ))}
    </>
  );
}

function Floors() {
  const tiles = useMemo(() => ROOMS.flatMap((r) => {
    const out: { key: string; name: string; palette: typeof r.palette; x: number; z: number }[] = [];
    // a tile belongs to the first room that contains it (the restrooms sit inside the lounge's box)
    for (let x = r.minX; x < r.maxX - 0.01; x += PIECE) for (let z = r.minZ; z < r.maxZ - 0.01; z += PIECE) if (roomAt(x + PIECE / 2, z + PIECE / 2) === r) out.push({ key: `${r.id}${x},${z}`, name: r.floor, palette: r.palette, x, z });
    return out;
  }), []);
  return <>{tiles.map((t) => <Prop key={t.key} name={t.name} palette={t.palette} position={[t.x, 0, t.z]} />)}</>;
}

/** Lawn, sidewalk, trees and lamps around the building. */
/** Low-poly fir trees (three stacked cones), one instanced mesh for the whole ring around the building. */
const PINES = (() => {
  const out: [number, number, number][] = [];
  const rnd = (i: number) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  let i = 0;
  const band = (x0: number, x1: number, z0: number, z1: number, step: number) => {
    for (let x = x0; x <= x1; x += step) for (let z = z0; z <= z1; z += step) {
      i++;
      out.push([x + (rnd(i) - 0.5) * step * 0.7, z + (rnd(i + 99) - 0.5) * step * 0.7, 0.75 + rnd(i + 7) * 0.6]);
    }
  };
  band(-35, 39, -29, -19, 3.4); // behind
  band(-35, 39, 22.5, 30, 3.4); // in front, past the street
  band(-35, -27, -16, 20, 3.4); // west
  band(35, 41, -16, 20, 3.4); // east, clear of the east wing and its elevator
  return out;
})();

function Pines() {
  const crown = useRef<THREE.InstancedMesh>(null!);
  const trunk = useRef<THREE.InstancedMesh>(null!);
  const geo = useMemo(() => ({
    crown: mergeGeometries([
      new THREE.ConeGeometry(1.3, 2.0, 7).translate(0, 1.7, 0),
      new THREE.ConeGeometry(1.0, 1.8, 7).translate(0, 2.65, 0),
      new THREE.ConeGeometry(0.68, 1.5, 7).translate(0, 3.5, 0),
    ])!,
    trunk: new THREE.CylinderGeometry(0.14, 0.2, 1.0, 6).translate(0, 0.5, 0),
  }), []);
  useEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    PINES.forEach(([x, z, s], i) => {
      m.compose(new THREE.Vector3(x, 0, z), q.setFromEuler(e.set(0, i * 1.7, 0)), new THREE.Vector3(s, s * (0.9 + (i % 3) * 0.12), s));
      crown.current.setMatrixAt(i, m);
      trunk.current.setMatrixAt(i, m);
    });
    crown.current.instanceMatrix.needsUpdate = true;
    trunk.current.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <>
      <instancedMesh ref={crown} args={[geo.crown, undefined, PINES.length]} castShadow receiveShadow>
        <meshStandardMaterial color="#2d5a3c" roughness={0.9} flatShading />
      </instancedMesh>
      <instancedMesh ref={trunk} args={[geo.trunk, undefined, PINES.length]} castShadow>
        <meshStandardMaterial color="#5a3d28" roughness={1} flatShading />
      </instancedMesh>
    </>
  );
}

const LAMPS = [-13, -5, 3, 11];
function Outside() {
  const walk = useMemo(() => Array.from({ length: 18 }, (_, i) => FLOOR.minX - 2.5 + i * PIECE), []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow>
        <planeGeometry args={[220, 220]} />
        <meshStandardMaterial color="#2c4a2c" roughness={1} />
      </mesh>
      {walk.map((x) => <Prop key={x} name="B:Floor_Concrete_01" position={[x, -0.01, FLOOR.maxZ + 1.0]} />)}
      {[-17, -9, -1, 7, 15].map((x, i) => <Prop key={x} name="Tree_Round_01" position={[x, 0, FLOOR.maxZ + 6]} scale={1.4 + (i % 2) * 0.3} />)}
      <Pines />
      {/* street lamps, lit for the evening */}
      {LAMPS.map((x) => (
        <group key={x} position={[x, 0, FLOOR.maxZ + 3.4]}>
          <Prop name="LampPost_01" rot={Math.PI} />
          <mesh position={[0, 3.32, -0.55]}>
            <sphereGeometry args={[0.12, 10, 8]} />
            <meshBasicMaterial color={[6, 4.2, 2.2]} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <pointLight position={[-15, 2.75, 16.3]} intensity={8} distance={7} decay={2} color="#ffd9a8" />
      {[-21.5, 21.5].map((x) => [-0.5, 3].map((z) => <Prop key={`${x}${z}`} name="Small_Hedge_01" position={[x, 0, z]} rot={Math.PI / 2} />))}
      <Prop name="Outdoor_Seat_01" position={[-2, 0, FLOOR.maxZ + 4.4]} rot={Math.PI} />
    </group>
  );
}

// ------------------------------------------------------------------ live screens
function Whiteboard() {
  const project = useOffice(selectProject);
  const tasks = useOffice((s) => s.tasks);
  const openModal = useOffice((s) => s.openModal);
  const list = project ? project.taskIds.map((i) => tasks[i]).filter(Boolean) : [];
  const done = list.filter((t) => t.status === 'completed').length;
  const running = list.filter((t) => t.status === 'running');
  const pct = Math.round(project?.progress ?? 0);
  const tex = useCanvasTexture(1024, 600, (ctx, w) => {
    ctx.fillStyle = '#f7f8fb';
    ctx.fillRect(0, 0, w, 600);
    ctx.fillStyle = '#1d2433';
    ctx.font = `800 46px ${FONT}`;
    ctx.fillText('PROJECT BOARD', 44, 78);
    ctx.font = `500 28px ${FONT}`;
    ctx.fillStyle = '#5b6478';
    ctx.fillText(fitText(ctx, project ? project.title : 'No project yet', w - 88), 44, 124);
    roundRect(ctx, 44, 156, w - 88, 36, 18);
    ctx.fillStyle = '#e4e7ef';
    ctx.fill();
    roundRect(ctx, 44, 156, Math.max(36, ((w - 88) * pct) / 100), 36, 18);
    ctx.fillStyle = pct >= 100 ? '#16a34a' : '#3b82f6';
    ctx.fill();
    ctx.fillStyle = '#1d2433';
    ctx.font = `700 32px ${FONT}`;
    ctx.fillText(`${pct}%`, w - 140, 236);
    ctx.font = `600 26px ${FONT}`;
    ctx.fillText(`Done ${done}/${list.length}`, 44, 236);
    ctx.font = `500 24px ${MONO}`;
    running.slice(0, 6).forEach((t, i) => {
      ctx.fillStyle = PROFILES[t.assignee].color;
      ctx.beginPath();
      ctx.arc(58, 290 + i * 46, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2b3345';
      ctx.fillText(fitText(ctx, `${PROFILES[t.assignee].name}: ${t.title}`, w - 280), 80, 298 + i * 46);
      ctx.fillStyle = '#5b6478';
      ctx.fillText(`${Math.round(t.progress)}%`, w - 130, 298 + i * 46);
    });
    ctx.font = `600 24px ${FONT}`;
    ctx.fillStyle = '#9aa1b2';
    if (!running.length) ctx.fillText(project?.status === 'completed' ? 'All tasks completed ✓' : 'Waiting for the next brief…', 44, 300);
  }, [project?.title, pct, done, list.length, running.map((t) => t.id + Math.round(t.progress / 5)).join()]);

  return (
    <group position={[WHITEBOARD.x, 0, WHITEBOARD.z + 0.02]}>
      <group position={[0, 1.65, 0]} scale={[WHITEBOARD.w / 1.5, WHITEBOARD.h / 1.02, 1]}>
        <Prop name="Whiteboard_01" />
      </group>
      <mesh position={[0, 1.65, 0.075]} onClick={click(() => openModal('whiteboard'))} onPointerOver={pointer(true)} onPointerOut={pointer(false)}>
        <planeGeometry args={[WHITEBOARD.w - 0.22, WHITEBOARD.h - 0.2]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  );
}

function MeetingScreen() {
  const project = useOffice(selectProject);
  const inMeeting = useOffice((s) => AGENT_IDS.filter((id) => s.agents[id].place === 'meeting' && s.agents[id].arrived).length);
  const last = useOffice((s) => [...s.messages].reverse().find((m) => m.inMeeting));
  const tex = useCanvasTexture(1024, 600, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#0b1222');
    g.addColorStop(1, '#16213d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#7c9cff';
    ctx.font = `700 30px ${MONO}`;
    ctx.fillText(inMeeting ? `● KICKOFF · ${inMeeting} in the room` : 'MEETING ROOM', 48, 70);
    ctx.fillStyle = '#e9edf5';
    ctx.font = `800 52px ${FONT}`;
    ctx.fillText(fitText(ctx, project ? project.title : 'Free', w - 96), 48, 150);
    if (last && last.from !== 'user' && last.from !== 'system') {
      ctx.fillStyle = PROFILES[last.from].color;
      ctx.font = `700 30px ${FONT}`;
      ctx.fillText(PROFILES[last.from].name, 48, 250);
      ctx.fillStyle = '#c9d1e3';
      ctx.font = `500 30px ${FONT}`;
      let line = '', y = 300;
      for (const word of last.text.split(' ')) {
        if (ctx.measureText(line + word).width > w - 96) { ctx.fillText(line, 48, y); line = ''; y += 42; if (y > h - 40) break; }
        line += word + ' ';
      }
      if (y <= h - 40) ctx.fillText(line, 48, y);
    }
  }, [project?.title, inMeeting, last?.id]);
  return (
    <group position={[MEETING_SCREEN.x, MEETING_SCREEN.y, MEETING_SCREEN.z]}>
      <group scale={1.75}><Prop name="TV_Wall_01" /></group>
      <mesh position={[0, 0.0, 0.4]}>
        <planeGeometry args={[2.5, 1.46]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  );
}

function WallSign({ position, light = false, width = 2.9 }: { position: [number, number, number]; light?: boolean; width?: number }) {
  const tex = useCanvasTexture(1024, 200, (ctx) => {
    ctx.font = `800 92px ${FONT}`;
    ctx.fillStyle = light ? '#fff6ea' : '#1d2433';
    ctx.fillText('AGENT', 30, 130);
    ctx.fillStyle = light ? '#ffc477' : '#4f6bff';
    ctx.fillText('OFFICE', 30 + ctx.measureText('AGENT ').width, 130);
    ctx.font = `600 26px ${MONO}`;
    ctx.fillStyle = light ? '#f1dcc4' : '#5b6478';
    ctx.fillText('AI TEAM · ALWAYS ON', 34, 180);
  }, [light]);
  return (
    <mesh position={position}>
      <planeGeometry args={[width, width * 0.195]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} />
    </mesh>
  );
}

// ------------------------------------------------------------------ rooms
function MeetingRoom() {
  const openModal = useOffice((s) => s.openModal);
  const t = MEETING_TABLE;
  return (
    <group>
      <group onClick={click(() => openModal('meeting'))} onPointerOver={pointer(true)} onPointerOut={pointer(false)}>
        <Prop name="Table_Conference_01" position={[t.x, 0, t.z]} />
      </group>
      {[...MEETING_SEATS, ...GUEST_SEATS].map((s, i) => <Prop key={i} name="Chair_06" position={[s.x, 0, s.z]} rot={s.rot} />)}
      <Prop name="Phone_Conference_01" position={[t.x, 0.75, t.z]} />
      <Prop name="Laptop_01" position={[t.x - 1.25, 0.75, t.z - 0.55]} />
      <Prop name="Laptop_02" position={[t.x + 0.1, 0.75, t.z + 0.6]} rot={Math.PI} />
      <Prop name="Cup_Coffee_Disposable_Closed_01" position={[t.x + 0.6, 0.75, t.z + 0.55]} />
      <Prop name="Cup_Red_01" position={[t.x - 0.6, 0.75, t.z - 0.5]} />
      <Prop name="Papers_02" position={[t.x + 1.1, 0.755, t.z - 0.3]} scale={0.4} />
      <Prop name="Clipboard_01" position={[t.x - 1.3, 0.755, t.z + 0.4]} rot={0.4} />
      <Prop name="Coffee_Tray_01_Full" position={[t.x + 1.6, 0.75, t.z + 0.1]} />
      <MeetingScreen />
      <Prop name="Whiteboard_02" position={[-11.0, 0, -13.2]} rot={-Math.PI / 2} />
      <Prop name="Presentation_Chart_01" position={[-10.8, 0, -6.3]} rot={-0.8} />
      <Prop name="Clock_02" position={[-10.06, 2.4, -10.2]} rot={-Math.PI / 2} />
      <Prop name="Poster_Stocks_01" position={[-17.0, 2.0, -14.83]} />
      <Prop name="Rug_01" position={[t.x, 0.005, t.z]} rot={Math.PI / 2} scale={[1.3, 1, 1.6]} palette="04" />
    </group>
  );
}

function ManagerOffice() {
  const openModal = useOffice((s) => s.openModal);
  const d = DESKS.manager;
  return (
    <group>
      <Workstation id="manager" x={d.x} z={d.z} rot={DESK_ROT.manager} />
      <Prop name="Rug_05" position={[d.x, 0.005, d.z - 0.5]} />
      <Prop name="Certificate_01" position={[-9.83, 1.7, -12.4]} rot={Math.PI / 2} />
      <Prop name="Certificate_01" position={[-9.83, 1.7, -11.7]} rot={Math.PI / 2} />
      <Prop name="Certificate_01" position={[-4.3, 1.7, -14.82]} />
      <Prop name="Couch_02" position={[-3.6, 0, -7.0]} rot={-Math.PI / 2} />
      <Prop name="CoffeeTable_03" position={[-4.75, 0, -7.0]} />
      <Prop name="Book_Magazine_01" position={[-4.75, 0.53, -7.0]} rot={0.4} />
      <Prop name="CoatRack_01" position={[-9.45, 0, -13.3]} />
      {/* putting green along the east wall, away from the door; it runs 2.7 m toward -z with the hole at the far end */}
      <Prop name="Minigolf_Green_01" position={[-3.05, 0, -10.95]} />
      <Prop name="Minigolf_Flag_01" position={[-3.05, 0.09, -13.35]} />
      <Prop name="Minigolf_Ball_01" position={[-3.0, 0.13, -12.1]} />
      <Prop name="Minigolf_Club_01" position={[-3.35, 0.71, -11.25]} rot={0.4} />
      <Prop name="Sign_Manager_01" position={[-9.35, 2.6, -4.84]} />
      <group onClick={click(() => openModal('manager'))} onPointerOver={pointer(true)} onPointerOut={pointer(false)}>
        <Prop name="Presentation_Chart_01" position={[d.x + 2.2, 0, d.z + 1.0]} rot={-0.6} />
      </group>
    </group>
  );
}

function Studio() {
  return (
    <group>
      <Prop name="GreenScreen_01" position={[1.25, 0, -14.3]} />
      <Prop name="Chair_07" position={[0.6, 0, -12.6]} rot={0.15} />
      <Prop name="Chair_07" position={[1.9, 0, -12.6]} rot={-0.15} />
      <Prop name="Camera_Tripod_01" position={[0.5, 0, -9.6]} rot={Math.PI - 0.1} />
      <Prop name="Camera_Tripod_02" position={[2.3, 0, -9.9]} rot={Math.PI + 0.25} />
      <Prop name="Microphone_01" position={[1.25, 0, -11.5]} rot={Math.PI} />
      <Prop name="Divider_Folding_01" position={[4.6, 0, -11.0]} rot={Math.PI / 2} />
      <Prop name="Desk_04" position={[-0.9, 0, -6.7]} rot={Math.PI} />
      <Prop name="Computer_Monitor_Double_01" position={[-0.9, 0.75, -6.55]} rot={Math.PI} screen="Sceen_03" />
      <Prop name="Computer_Keyboard_01" position={[-0.9, 0.75, -6.95]} rot={Math.PI} />
      <Prop name="Chair_05" position={[-0.9, 0, -7.55]} />
      <Prop name="Headphones_01" position={[-0.3, 0.75, -6.75]} rot={Math.PI + 0.4} />
      <Prop name="Rug_05" position={[1.25, 0.005, -11.4]} palette="02" />
      <Prop name="Table_Drafting_01" position={[3.7, 0, -6.4]} rot={Math.PI} />
      <Prop name="CardboardBox_04" position={[-2.0, 0, -13.8]} rot={0.4} />
      <Prop name="Cord_Pile_01" position={[0.9, 0, -10.6]} rot={0.2} />
      <Prop name="Poster_02" position={[-2.33, 2.0, -9.5]} rot={Math.PI / 2} />
    </group>
  );
}

function ServerRoom() {
  return (
    <group>
      {[5.9, 6.9, 7.9, 8.9].map((x, i) => <Prop key={`a${x}`} name={i === 3 ? 'Server_Cabinet_02' : i % 2 ? 'Server_Cabinet_02_Full' : 'Server_Cabinet_01_Full'} position={[x, 0, -12.5]} />)}
      {[5.9, 6.9, 7.9, 8.9].map((x, i) => <Prop key={`b${x}`} name={i === 1 ? 'Server_Cabinet_01' : i % 2 ? 'Server_Cabinet_01_Full' : 'Server_Cabinet_03_Full'} position={[x, 0, -9.5]} rot={Math.PI} />)}
      <Prop name="CardboardBox_Stack_01" position={[9.2, 0, -14.3]} />
      <Prop name="Pallet_01" position={[6.0, 0, -14.3]} />
      <Prop name="CardboardBox_02" position={[6.0, 0.23, -14.3]} rot={0.3} />
      <Prop name="Cabinets_01" position={[9.6, 0, -6.2]} rot={-Math.PI / 2} />
      <Prop name="Cord_Pile_01" position={[7.5, 0, -11.0]} rot={1.3} />
    </group>
  );
}

function GameRoom() {
  return (
    <group>
      <Prop name="TableTennis_01" position={[TABLE_TENNIS.x, 0, TABLE_TENNIS.z]} />
      <Prop name="TableTennis_Paddle_01" position={[TABLE_TENNIS.x - 1.2, 0.77, TABLE_TENNIS.z + 0.4]} rotation={[-Math.PI / 2, 0, 0.6]} />
      <Prop name="ArcadeMachine_01" position={[19.3, 0, -8.6]} rot={-Math.PI / 2} screen="Sceen_Arcade_01" />
      <Prop name="Jukebox_01" position={[19.3, 0, -6.6]} rot={-Math.PI / 2} />
      <Prop name="Neon_Cactus_01" position={[19.4, 1.63, -6.6]} rot={-Math.PI / 2} />
      <Prop name="Chair_BeanBag_02" position={[13.0, 0, -12.6]} rot={0.6} />
      <Prop name="Chair_BeanBag_04" position={[13.4, 0, -13.9]} rot={-0.3} />
      <Prop name="Couch_06" position={[17.6, 0, -14.2]} />
      <Prop name="CoffeeTable_01" position={[15.6, 0, -13.2]} />
      <Prop name="Console_PlayBox_01" position={[15.6, 0.42, -13.2]} />
      <Prop name="B:FeatureWall_Wood_01" position={[12.5, 0, -14.98]} />
      <Prop name="Rug_04" position={[15.6, 0.005, -13.0]} rot={Math.PI / 2} palette="02" />
      <Prop name="VendingMachine_01" position={[19.4, 0, -11.3]} rot={-Math.PI / 2} />
      <Prop name="Table_Round_02" position={[11.7, 0, -6.7]} />
      <Prop name="Chair_04" position={[11.7, 0, -7.6]} />
      <Prop name="Chair_04" position={[12.6, 0, -6.6]} rot={-Math.PI / 2} />
      <Prop name="Snack_04" position={[11.3, 0.75, -6.4]} rot={0.6} />
      <Prop name="Cup_Paper_01" position={[12.1, 0.75, -6.95]} />
    </group>
  );
}

/** Small things on the consoles: [prop, x, z, rotY]; each desk takes its own few. */
const SOC_CLUTTER: [string, number, number, number][][] = [
  [['EnergyDrink_01', -0.85, 0.25, 0], ['NotePad_02', -0.55, 0.3, 0.3], ['Pen_03', -0.42, 0.3, 1.2]],
  [['Cup_Coffee_Disposable_Closed_01', -0.8, 0.22, 0], ['Phone_Desk_01', 0.88, -0.12, -0.3], ['Flash_Drive_01', -0.5, 0.32, 0.8]],
  [['Donut_Box_01', -0.7, 0.1, 0.25], ['Can_Soda_01', 0.9, 0.3, 0]],
  [['Cup_Boss_01', -0.82, 0.25, 0], ['Clipboard_01', -0.5, 0.18, 0.2]],
  [['Laptop_Folding_01', -0.62, 0.08, 0.35], ['Book_Phone_01', 0.85, 0.28, -0.2]],
  [['EnergyDrink_01', 0.88, 0.3, 0], ['EnergyDrink_01', 0.8, 0.12, 0.6], ['HDD_USB_02', -0.6, 0.3, 0.4]],
];

/** An analyst console: a cubicle desk with no partitions, a bank of monitors on the shared SIEM screen, a headset. */
function SocConsole({ x, z, i }: { x: number; z: number; i: number }) {
  const front = i < 3, free = i === 4;
  return (
    <group position={[x, 0, z]}>
      <Prop name="Desk_04" scale={[0.93, 1, 1]} palette="04" />
      {front
        ? <Prop name="Computer_Monitor_Triple_01" position={[0, 0.75, -0.27]} screen="Live_Soc" />
        : <Prop name="Computer_Monitor_Double_01" position={[0.1, 0.75, -0.22]} screen="Live_Soc" />}
      <Prop name="Computer_Keyboard_02" position={[0, 0.75, 0.2]} />
      <Prop name="Computer_Mousepad_02" position={[0.5, 0.75, 0.2]} />
      <Prop name="Computer_Mouse_03" position={[0.5, 0.76, 0.2]} />
      {!free && <Prop name={i % 2 ? 'Headset_02' : 'Headset_01'} position={[0.78, 0.75, -0.05]} rot={-0.4} />}
      <Prop name={i % 2 ? 'Computer_Tower_Modern_01' : 'Computer_Tower_02'} position={[0.72, 0, -0.12]} />
      {SOC_CLUTTER[i].map(([name, cx, cz, r], k) => <Prop key={k} name={name} position={[cx, 0.75, cz]} rot={r} />)}
      <Prop name={front ? 'Chair_10' : 'Chair_05'} position={free ? [0.25, 0, 0.95] : [0, 0, 0.82]} rot={free ? Math.PI - 0.35 : Math.PI} />
    </group>
  );
}

function SecurityRoom() {
  return (
    <group>
      {SOC_DESKS.map((d, i) => <SocConsole key={i} x={d.x} z={d.z} i={i} />)}
      {VIDEO_WALL.map((s, i) => <Prop key={i} name="TV_Wall_01" position={[s.x, s.y, TV_Z]} scale={s.s} />)}
      {BEACONS.map(([x, y, z], i) => <Prop key={i} name="Fire_Detector_01" position={[x, y, z]} />)}
      <SecurityLive />
      <Prop name="Rug_04" position={[25, 0.005, -12.9]} rot={Math.PI / 2} palette="04" scale={[0.9, 1, 1.5]} />
      <Prop name="Security_Camera_01" position={[20.3, 2.75, -14.6]} rot={Math.PI / 4} />
      <Prop name="Card_Scanner_02" position={[22.43, 1.2, -4.83]} />
      <Prop name="Keypad_01" position={[22.43, 1.2, -5.0]} rot={Math.PI} />
      <Prop name="Clock_02" position={[20.17, 2.45, -11.4]} rot={Math.PI / 2} />
      <Prop name="Wall_Electronics_01" position={[29.84, 0.3, -11.6]} rot={-Math.PI / 2} />
    </group>
  );
}

function Corridor() {
  return (
    <group>
      <Prop name="Employee_Wall_01" position={[3.75, 2.0, -5.2]} rot={Math.PI} />
      <Prop name="Poster_01" position={[-1.9, 2.1, -5.2]} rot={Math.PI} />
      <Prop name="Poster_04" position={[11.25, 2.0, -5.2]} rot={Math.PI} />
      <Prop name="Sign_Exit_01" position={[-18.75, 2.6, -2.66]} rot={Math.PI} />
      <Prop name="Fire_Extinguisher_01" position={[11.0, 0, -4.8]} rot={Math.PI} />
      <Prop name="Fire_Extinguisher_01" position={[-10.4, 0, -4.8]} rot={Math.PI} />
      <Prop name="Janitor_Cart_01" position={[6.4, 0, -4.4]} rot={0.15} />
      <Prop name="Sign_Wetfloor_01" position={[4.6, 0, -3.6]} rot={0.6} />
      <Prop name="Mop_01" position={[7.6, 0, -4.4]} rot={-0.4} />
      <Prop name="Security_Camera_01" position={[0, 2.8, -4.95]} rot={Math.PI} />
      {[-15, -4, 8, 16, 25].map((x) => <Prop key={x} name="Rug_02" position={[x, 0.005, -3.75]} rot={Math.PI / 2} />)}
      {/* the east end, past Cyber Security: the elevator moved here when the wing was built */}
      <Prop name="Fire_Extinguisher_01" position={[28.9, 0, -2.76]} rot={Math.PI} />
      <Prop name="Security_Camera_01" position={[29.8, 2.8, -2.7]} rot={-2.4} />
    </group>
  );
}

function Kitchen() {
  const k = KITCHEN_ISLAND;
  return (
    <group>
      {['Kitchen_Counter_01', 'Kitchen_CounterSink_01', 'Kitchen_Counter_01', 'Kitchen_Counter_01'].map((n, i) => (
        <Prop key={i} name={n} position={[FLOOR.minX + 0.05, 0, -1.0 + i]} rot={Math.PI / 2} />
      ))}
      <Prop name="Microwave_01" position={[-19.45, 0.95, -0.5]} rot={Math.PI / 2} />
      <Prop name="Kettle_01" position={[-19.45, 0.95, 0.9]} rot={Math.PI / 2} />
      <Prop name="CoffeeMachine_01" position={[-19.5, 0.95, 2.5]} rot={Math.PI / 2} scale={0.75} />
      <Prop name="Fridge_01" position={[-19.4, 0, 3.9]} rot={Math.PI / 2} />
      <Prop name="B:FeatureWall_Wood_01" position={[FLOOR.minX + 0.02, 0, 2.5]} rot={Math.PI / 2} />
      {[0, 1].map((z) => <Prop key={z} name="Kitchen_Cabinet_01" position={[-19.76, 1.55, z]} rot={Math.PI / 2} />)}
      <Prop name="Plant_09" position={[-19.45, 0.95, 1.7]} />
      <Prop name="Cup_03" position={[-19.4, 0.95, 0.4]} />
      <Prop name="Plant_Flowers_01" position={[k.x - 0.75, 0.95, k.z - 0.35]} />
      {/* island: two counters facing +z, two facing -z */}
      <Prop name="Kitchen_Counter_01" position={[k.x, 0, k.z]} />
      <Prop name="Kitchen_Counter_01" position={[k.x + 1, 0, k.z]} />
      <Prop name="Kitchen_Counter_01" position={[k.x - 1, 0, k.z]} rot={Math.PI} />
      <Prop name="Kitchen_Counter_01" position={[k.x, 0, k.z]} rot={Math.PI} />
      <Prop name="FruitBowl_01" position={[k.x - 0.4, 0.95, k.z + 0.3]} />
      <Prop name="Donut_Box_01" position={[k.x + 0.5, 0.95, k.z - 0.3]} rot={0.4} />
      <Prop name="Toaster_01" position={[k.x + 0.6, 0.95, k.z + 0.5]} />
      <Prop name="Cup_01" position={[k.x - 0.2, 0.95, k.z - 0.4]} />
      {[[-0.5, 1.45, Math.PI], [0.5, 1.45, Math.PI], [-0.5, -1.45, 0], [0.5, -1.45, 0]].map(([dx, dz, r], i) => (
        <Prop key={i} name="Chair_11" position={[k.x + dx, 0, k.z + dz]} rot={r} />
      ))}
      <Prop name="VendingMachine_01" position={[-11.0, 0, -1.8]} />
      <Prop name="WaterCooler_01" position={[-12.6, 0, -1.9]} />
      <Prop name="Sign_Kitchen_01" position={[-15.0, 2.75, -2.32]} />
      <Prop name="Clock_01" position={[-11.25, 2.4, -2.32]} />
      <Prop name="Bin_02" position={[-17.8, 0, -2.1]} />
    </group>
  );
}

function Reception() {
  const r = RECEPTION;
  return (
    <group>
      <Prop name="Desk_06" position={[r.x, 0, r.z]} />
      <Prop name="B:FeatureWall_Wood_01" position={[-17.5, 0, 5.02]} />
      <Prop name="B:FeatureWall_Wood_01" position={[-15, 0, 5.02]} />
      <WallSign position={[-14.6, 2.15, 5.26]} light width={4.2} />
      <WallSign position={[-15, 3.23, 17.73]} light width={2.6} />
      {/* Desk_06 is L-shaped: work surface (0.75) along z -0.2..0.5 and a left wing; a narrow raised counter (0.93) on the visitor side */}
      <Prop name="Plant_Flowers_01" position={[r.x + 1.5, 0.75, r.z - 0.05]} />
      <Prop name="Rug_05" position={[-18.2, 0.005, 11.0]} rot={Math.PI / 2} />
      <Prop name="Computer_Monitor_01" position={[r.x + 0.3, 0.75, r.z + 0.3]} rot={Math.PI} />
      <Prop name="Computer_Keyboard_02" position={[r.x + 0.3, 0.75, r.z - 0.02]} rot={Math.PI} />
      <Prop name="Computer_Mouse_02" position={[r.x - 0.05, 0.75, r.z - 0.02]} rot={Math.PI} />
      <Prop name="Plant_Flowers_02" position={[r.x - 1.35, 0.93, r.z - 0.1]} />
      <Prop name="Coffee_Tray_01_Full" position={[r.x + 1.35, 0.93, r.z + 0.6]} />
      <Prop name="Sign_Receptionist_01" position={[r.x - 0.2, 1.005, r.z + 0.58]} />
      <Prop name="Chair_05" position={[r.x + 0.3, 0, r.z - 0.7]} />
      <Prop name="Couch_04" position={[LOBBY_SOFA.x, 0, LOBBY_SOFA.z]} rot={Math.PI / 2} />
      <Prop name="CoffeeTable_02" position={[LOBBY_SOFA.x + 1.3, 0, LOBBY_SOFA.z]} rot={Math.PI / 2} />
      <Prop name="Book_Magazine_02" position={[LOBBY_SOFA.x + 1.3, 0.51, LOBBY_SOFA.z]} rot={0.8} />
      <Prop name="Rug_03" position={[-15.0, 0.005, 12.8]} rot={Math.PI / 2} palette="04" scale={[1.3, 1, 1.6]} />
      <Prop name="WaterCooler_01" position={[-19.5, 0, 8.05]} rot={Math.PI / 2} />
      <Prop name="Sign_Exit_01" position={[-15, 2.75, 14.8]} rot={Math.PI} />
      <Prop name="Rug_03" position={[-15, 0.006, 14.0]} rot={Math.PI / 2} palette="02" />
      <Prop name="Certificate_01" position={[-19.82, 1.8, 8.6]} rot={Math.PI / 2} />
    </group>
  );
}

function Lounge() {
  return (
    <group>
      <Prop name="Rug_01" position={[POOL_TABLES[0].x, 0.005, POOL_TABLES[0].z]} rot={Math.PI / 2} scale={[1, 1, 1.15]} palette="02" />
      <Prop name="Rug_01" position={[POOL_TABLES[1].x, 0.005, POOL_TABLES[1].z]} rot={Math.PI / 2} scale={[1, 1, 1.15]} palette="04" />
      <Prop name="PoolTable_01" position={[POOL_TABLES[0].x, 0, POOL_TABLES[0].z]} />
      <Prop name="PoolTriangle_01" position={[POOL_TABLES[0].x + 0.9, 0.89, POOL_TABLES[0].z]} />
      <Prop name="PoolCue_01" position={[POOL_TABLES[0].x - 1.2, 0.9, POOL_TABLES[0].z + 0.3]} rot={1.3} />
      <Prop name="PoolTable_02" position={[POOL_TABLES[1].x, 0, POOL_TABLES[1].z]} />
      <Prop name="PoolBall_01" position={[POOL_TABLES[1].x + 0.4, 0.93, POOL_TABLES[1].z - 0.2]} />
      <Prop name="TableFootball_01" position={[FOOSBALL.x, 0, FOOSBALL.z]} rot={Math.PI / 2} />
      <Prop name="Rug_01" position={[SOFA.x, 0.005, LOUNGE_TABLE.z - 0.3]} rot={Math.PI / 2} />
      <Prop name="Couch_03" position={[SOFA.x, 0, SOFA.z]} rot={Math.PI} />
      <Prop name="CoffeeTable_02" position={[LOUNGE_TABLE.x, 0, LOUNGE_TABLE.z]} />
      <Prop name="Book_Magazine_02" position={[LOUNGE_TABLE.x - 0.2, 0.51, LOUNGE_TABLE.z]} rot={0.5} />
      <Prop name="Console_PlayBox_01" position={[LOUNGE_TABLE.x + 0.25, 0.51, LOUNGE_TABLE.z + 0.05]} />
      {BEANBAGS.map(([x, z, name, r], i) => <Prop key={i} name={name} position={[x, 0, z]} rot={r} />)}
      <Prop name="Fishtank_01" position={[-9.35, 0, 3.6]} rot={Math.PI / 2} />
      <Prop name="Fan_Pedistal_01" position={[1.0, 0, 6.5]} rot={-2.4} />
      <Prop name="Sign_Director_01" position={[-6.25, 2.6, -2.36]} />
      {/* second seating corner by the fish tank */}
      <Prop name="Rug_02" position={[-8.0, 0.005, 10.4]} palette="02" />
      <Prop name="Couch_05" position={[-9.3, 0, 9.4]} rot={Math.PI / 2} />
      <Prop name="Couch_06" position={[-8.1, 0, 8.2]} />
      <Prop name="CoffeeTable_03" position={[-8.1, 0, 9.4]} />
      <Prop name="Cup_Red_01" position={[-8.0, 0.53, 9.3]} />
      <Prop name="ArcadeMachine_01" position={[-9.33, 0, 5.2]} rot={Math.PI / 2} screen="Sceen_Arcade_01" />
      <Prop name="Shelf_06" position={[-6.0, 0, -2.28]} />
      <Prop name="Book_Group_04" position={[-5.6, 0.89, -2.28]} />
      <Prop name="Radio_02" position={[-6.4, 0.89, -2.28]} />
      <Prop name="Plant_14" position={[-9.2, 0, 6.6]} />
      <Prop name="Plant_06" position={[1.4, 0, 5.4]} />
    </group>
  );
}

function Workspace() {
  return (
    <group>
      {AGENT_IDS.filter((id) => id !== 'manager').map((id) => <Workstation key={id} id={id} x={DESKS[id].x} z={DESKS[id].z} />)}
      {STAFF_DESKS.map((d, i) => <StaffDesk key={i} x={d.x} z={d.z} seed={i + 2} empty={i % 4 === 3} />)}
      <Whiteboard />
      <WallSign position={[WHITEBOARD.x, 2.84, WHITEBOARD.z + 0.05]} />
      {[2.2, 2.9, 3.6, 4.3].map((z, i) => <Prop key={z} name={i % 2 ? 'Cabinets_03' : 'Cabinets_01'} position={[19.62, 0, z]} rot={-Math.PI / 2} />)}
      <Prop name="PaperTray_01_Full_01" position={[19.62, 1.51, 2.2]} rot={-Math.PI / 2} />
      <Prop name="Photocopier_01" position={[16.5, 0, 12.8]} rot={Math.PI} />
      <Prop name="PaperShredder_01" position={[18.0, 0, 12.9]} rot={Math.PI} />
      <Prop name="WaterCooler_01" position={[19.5, 0, 8.4]} rot={-Math.PI / 2} />
      <Prop name="Sign_Sales_01" position={[8.75, 2.55, -2.36]} />
      <Prop name="CardboardBox_01" position={[17.6, 0, 3.5]} rot={0.6} />
      <Prop name="CardboardBox_03" position={[17.9, 0, 3.9]} rot={-0.2} />
      <Prop name="Briefcase_02" position={[5.0, 0, 4.0]} rot={1.2} />
      {[[7.4, 3.9, 0.4], [12.0, 8.6, 1.2], [15.6, 4.1, 2.0], [4.4, 9.0, 0.7]].map(([x, z, r], i) => <Prop key={i} name={i % 2 ? 'Paper_02' : 'Paper_01'} position={[x, 0.005, z]} rot={r} />)}
    </group>
  );
}

// ------------------------------------------------------------------ cozy details
/** Posters, boards and frames on the walls: [model, x, y, z, rotY]. Wall faces are 0.15 m off the wall line. */
const WALL_DECOR: [string, number, number, number, number][] = [
  // corridor, north side
  ['Poster_03', -1.9, 1.9, -4.97, 0], ['WallDressing_01', 3.75, 1.0, -4.97, 0], ['Poster_04', 8.75, 1.95, -4.97, 0],
  ['Poster_02', 11.25, 1.9, -4.97, 0], ['WallDressing_03', 18.75, 1.0, -4.97, 0],
  // corridor, south side
  ['Poster_02', -18.75, 1.7, -2.53, Math.PI], ['WallDressing_02', -11.25, 1.0, -2.53, Math.PI], ['Poster_Stocks_01', 3.75, 1.9, -2.53, Math.PI],
  ['Poster_03', 8.75, 1.9, -2.53, Math.PI], ['WallDressing_01', 12.5, 1.0, -2.53, Math.PI], ['Poster_04', 16.25, 1.95, -2.53, Math.PI],
  // workspace side of the corridor wall, and its east wall
  ['WallDressing_01', 3.75, 1.0, -2.34, 0], ['Poster_02', 8.75, 1.75, -2.34, 0], ['WallDressing_04', 16.25, 1.0, -2.34, 0],
  ['Poster_Stocks_01', 19.84, 2.0, 11.25, -Math.PI / 2],
  // kitchen
  ['WallDressing_04', -16.25, 1.0, 4.98, Math.PI], ['Poster_04', -13.75, 1.95, 4.98, Math.PI],
  // studio and game room
  ['WallDressing_04', 4.98, 1.15, -6.3, -Math.PI / 2], ['Poster_03', 10.16, 2.0, -8.5, Math.PI / 2], ['WallDressing_02', 10.16, 1.1, -6.6, Math.PI / 2],
  // manager office: a picture over the couch
  ['Poster_03', -2.6, 1.95, -7.0, -Math.PI / 2],
  // the corridor's east end
  ['Poster_01', 21.25, 1.9, -2.66, Math.PI], ['WallDressing_02', 28.75, 1.0, -2.66, Math.PI],
];

function Decor() {
  return (
    <group>
      {FLOOR_DECOR.map(([name, x, z, r], i) => name.startsWith('Shelf_')
        ? <Bookcase key={i} name={name} position={[x, 0, z]} rot={r} seed={i + 3} />
        : <Prop key={i} name={name} position={[x, 0, z]} rot={r} />)}
      {WALL_DECOR.map(([name, x, y, z, r], i) => <Prop key={i} name={name} position={[x, y, z]} rot={r} />)}
    </group>
  );
}

export function Office() {
  return (
    <Suspense fallback={null}>
      <StaticBatch>
        <Outside />
        <Floors />
        <Walls />
        <MeetingRoom />
        <ManagerOffice />
        <Studio />
        <ServerRoom />
        <GameRoom />
        <SecurityRoom />
        <Corridor />
        <Kitchen />
        <Reception />
        <Lounge />
        <Workspace />
        <Decor />
        <Fitout />
        {PLANTS.map(([x, z, model], i) => <Prop key={i} name={model} position={[x, 0, z]} rot={i * 1.3} />)}
      </StaticBatch>
    </Suspense>
  );
}
