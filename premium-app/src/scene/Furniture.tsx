import { useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useOffice } from '../store/useOffice';
import type { AgentId } from '../core/types';
import { PROFILES } from '../core/agents';
import { drawScreen } from './screens';
import { Prop } from './assets';

const DESK_TOP = 0.75;
const hover = (on: boolean) => () => { document.body.style.cursor = on ? 'pointer' : ''; };

/** The monitor runs a role-specific app (code editor, design tool, browser, test runner, sprint board). */
function MonitorScreen({ id, w, h }: { id: AgentId; w: number; h: number }) {
  const { canvas, texture } = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return { canvas, texture };
  }, []);
  const acc = useRef(10);
  const clockT = useRef(Math.random() * 5);
  useFrame((_, dt) => {
    clockT.current += dt;
    acc.current += dt;
    if (acc.current < 0.2) return;
    acc.current = 0;
    const s = useOffice.getState();
    const agent = s.agents[id];
    drawScreen(canvas.getContext('2d')!, canvas.width, canvas.height, {
      agent, task: agent.currentTaskId ? s.tasks[agent.currentTaskId] : undefined, tasks: Object.values(s.tasks), t: clockT.current,
    });
    texture.needsUpdate = true;
  });
  return (
    <mesh>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

/** Desk extras that make each workstation look like its owner's: [prop, x, z, rotY]. */
const EXTRAS: Record<AgentId, [string, number, number, number?][]> = {
  developer: [['Computer_Monitor_01', -0.62, -0.12, 0.35], ['Figure_Knight_01', 0.55, -0.3], ['Cup_Coffee_Disposable_Closed_01', 0.8, 0.05], ['Speaker_Computer_01', 0.42, -0.3]],
  designer: [['GraphicsTablet_01', 0.55, 0.12], ['Plant_Flowers_01', -0.8, -0.2], ['PencilCup_01', 0.85, -0.25]],
  research: [['Paper_Pile_01', -0.7, 0.05], ['FolderTray_01', 0.75, -0.18], ['Cup_Coffee_Disposable_Closed_01', 0.5, 0.15]],
  qa: [['Headphones_01', -0.65, 0.1], ['DeskToy_NewtownsCradle_01', 0.72, -0.22], ['Plant_08', -0.85, -0.28]],
  manager: [['Phone_Desk_01', 0.75, -0.05], ['Globe_01', -0.85, -0.22], ['Trophy_01', 0.9, -0.3]],
};

const NOTES = ['Note_01', 'Note_02', 'Note_03', 'Note_04', 'Note_05', 'Note_06', 'Note_07'];
const rnd = (seed: number) => { const x = Math.sin(seed * 9301 + 49297) * 233280; return x - Math.floor(x); };

/** Blue cubicle partitions with a cork board, sticky notes and photos, like a real open office. */
export function Cubicle({ x, z, seed = 1 }: { x: number; z: number; seed?: number }) {
  const notes = useMemo(() => Array.from({ length: 5 + Math.floor(rnd(seed) * 4) }, (_, i) => ({
    name: NOTES[Math.floor(rnd(seed * 7 + i) * NOTES.length)],
    x: -0.85 + rnd(seed * 13 + i) * 1.7,
    y: 0.95 + rnd(seed * 17 + i) * 0.3,
    r: (rnd(seed * 19 + i) - 0.5) * 0.4,
  })), [seed]);
  return (
    <group position={[x, 0, z]}>
      {/* back wall (pivot at its right end) and the two sides */}
      <Prop name="CubicalWall_01" position={[1, 0, -0.5]} />
      <Prop name="CubicalWall_01_Half" position={[-1, 0, 0.5]} rot={Math.PI / 2} />
      <Prop name="CubicalWall_01_Half" position={[1, 0, 0.5]} rot={Math.PI / 2} />
      {[[-1, -0.5], [1, -0.5], [-1, 0.5], [1, 0.5]].map(([px, pz], i) => <Prop key={i} name="CubicalWall_Pillar_01" position={[px, 0, pz]} />)}
      {/* cork board and sticky notes on the inside of the back wall */}
      <Prop name="CorkBoard_03" position={[-0.45, 0.62, -0.46]} scale={0.38} />
      {notes.map((n, i) => (
        <Prop key={i} name={n.name} position={[n.x, n.y, -0.462]} rotation={[0, 0, n.r]} />
      ))}
      <Prop name={rnd(seed * 3) > 0.5 ? 'Photo_01' : 'Photo_03'} position={[-0.75, DESK_TOP, -0.15]} rot={0.3} scale={0.7} />
    </group>
  );
}

export function Workstation({ id, x, z, rot = 0 }: { id: AgentId; x: number; z: number; rot?: number }) {
  const select = useOffice((s) => s.select);
  const [hot, setHot] = useState(false);
  const click = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); select(id, 'tasks'); };
  const isManager = id === 'manager';
  const color = PROFILES[id].color;
  return (
    <group position={[x, 0, z]} rotation-y={rot}>
      {!isManager && <Cubicle x={0} z={0} seed={id.length * 3 + x} />}
      <Prop name={isManager ? 'Desk_03' : 'Desk_04'} scale={isManager ? 1 : [0.93, 1, 1]} />
      {/* The person sits on the +z side and faces -z; the monitor's screen faces +z, toward them and the camera. */}
      <group position={[0.15, DESK_TOP, -0.2]} onClick={click} onPointerOver={() => { hover(true)(); setHot(true); }} onPointerOut={() => { hover(false)(); setHot(false); }}>
        <Prop name="Computer_Monitor_02" />
        <group position={[0, 0.355, 0.075]}>
          <MonitorScreen id={id} w={0.64} h={0.36} />
          {hot && (
            <mesh position={[0, 0, -0.005]}>
              <planeGeometry args={[0.7, 0.42]} />
              <meshBasicMaterial color={color} toneMapped={false} />
            </mesh>
          )}
        </group>
      </group>
      <Prop name="Computer_Keyboard_01" position={[0.15, DESK_TOP, 0.18]} />
      <Prop name="Computer_Mousepad_01" position={[0.62, DESK_TOP, 0.18]} />
      <Prop name="Computer_Mouse_01" position={[0.62, DESK_TOP + 0.01, 0.18]} />
      <Prop name="Desklamp_01" position={[-0.78, DESK_TOP, -0.28]} rot={0.4} />
      <Prop name="Computer_Tower_Modern_01" position={[0.72, 0, -0.12]} />
      {EXTRAS[id].map(([name, ex, ez, r], i) => <Prop key={i} name={name} position={[ex, DESK_TOP, ez]} rot={r ?? 0} />)}
      <Prop name={isManager ? 'Chair_10' : 'Chair_05'} position={[0, 0, 0.82]} rot={Math.PI} />
      {/* name plate in the owner's color */}
      <mesh position={[0.45, DESK_TOP + 0.04, 0.4]} rotation={[-0.6, 0, 0]}>
        <boxGeometry args={[0.3, 0.07, 0.01]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Small things that end up on office desks; each staff desk takes a few, so the whole set shows up somewhere. */
const CLUTTER = [
  'Calculator_02', 'Cellotape_01', 'Eraser_02', 'Flash_Drive_01', 'FloppyDisk_01', 'FolderTray_03', 'Folder_Holder_03', 'Folder_Manila_03',
  'GraphicsTablet_02', 'HDD_USB_02', 'HolePunch_01', 'ID_Card_01', 'NotePad_02', 'Paper_05', 'Pencil_Sharpener_02', 'Ruler_01',
  'Scissors_01', 'SD_Card_01', 'Webcam_02', 'DeskToy_Orbiter_01', 'Cup_Coffee_Disposable_Open_Full_01', 'Can_Soda_01', 'EnergyDrink_01',
  'Bottle_01', 'Sandwich_01', 'Pills_02', 'Inhaler_01', 'Snack_07', 'Snack_09', 'Snack_10', 'Snack_11', 'Snack_12', 'Snack_13', 'Snack_15',
  'Snack_16', 'Snack_17', 'Snack_18', 'Donut_01', 'Donut_Pink_02', 'Eraser_01', 'Eraser_03', 'Flash_Drive_02', 'FolderTray_04',
  'Folder_Holder_04', 'Folder_Manila_04', 'HDD_01', 'HDD_USB_03', 'Pencil_Sharpener_01', 'Scissors_02', 'Cup_Coffee_Disposable_Open_01',
  'Cup_Coffee_Disposable_Open_Mellow_01', 'Book_Phone_Open_01', 'Paper_06', 'Mints_01', 'Calculator_01', 'Stapler_01', 'Cellphone_01',
  'Cellphone_02', 'Headset_01', 'Headset_02', 'Headphones_02', 'Webcam_01', 'Cup_Pens_01', 'Cup_02', 'Folder_Holder_01', 'Folder_Holder_02',
  'FolderTray_02', 'Folder_Manila_01', 'Folder_PVC_01', 'HDD_USB_01', 'Speaker_Bluetooth_01', 'Radio_01', 'Fan_Desk_01', 'Papers_01',
  'Paper_03', 'Snack_01', 'Snack_03', 'Snack_05', 'Pencil_01', 'Photo_02', 'Photo_04', 'Photo_06', 'Pills_01', 'Computer_Mousepad_03',
  'Snack_02', 'Donut_Pink_01',
];
/** Free spots on a staff desk for clutter: [x, z]. */
const CLUTTER_SPOTS: [number, number][] = [[0.86, 0.3], [-0.86, 0.32], [-0.2, 0.36], [0.42, -0.36], [-0.7, -0.12], [0.92, 0.08], [0.28, 0.38], [-0.38, 0.05]];
const UNDER_DESK = ['FootRest_01', 'Cord_Board_01', 'Cord_Desk_02', 'Socket_Floor_01', 'Briefcase_Laptop_01', 'Cord_Desk_01', 'Bucket_01'];
const ON_PARTITION = ['Child_Art_01', 'Calender_01', 'Child_Art_01', 'Calender_01'];

/** A staff cubicle (not an agent): a real-looking desk for the people who work around the agents. */
export function StaffDesk({ x, z, seed, empty }: { x: number; z: number; seed: number; empty?: boolean }) {
  const monitors = ['Computer_Monitor_Double_01', 'Computer_Monitor_Curved_01', 'Computer_Monitor_03', 'Computer_Monitor_04', 'Computer_Monitor_05', 'Computer_Monitor_Triple_01', 'Computer_Setup_01'];
  const screens = ['Sceen_02', 'Sceen_03', 'Sceen_04', 'Sceen_05', 'Sceen_01'] as const;
  // 8 clutter items per desk, walking through the list so every item lands on some desk.
  const clutter = CLUTTER_SPOTS.map((spot, i) => ({ name: CLUTTER[((seed - 2) * CLUTTER_SPOTS.length + i) % CLUTTER.length], spot, r: rnd(seed * 23 + i) * 6.28 }));
  return (
    <group position={[x, 0, z]}>
      <Cubicle x={0} z={0} seed={seed} />
      <Prop name="Desk_04" scale={[0.93, 1, 1]} />
      <Prop name={monitors[seed % monitors.length]} position={[0.1, DESK_TOP, -0.22]} screen={screens[seed % screens.length]} />
      <Prop name={seed % 2 ? 'Computer_Keyboard_02' : 'Computer_Keyboard_01'} position={[0.1, DESK_TOP, 0.18]} />
      <Prop name={['Computer_Mousepad_01', 'Computer_Mousepad_02'][seed % 2]} position={[0.6, DESK_TOP, 0.18]} />
      <Prop name={['Computer_Mouse_01', 'Computer_Mouse_02', 'Computer_Mouse_03'][seed % 3]} position={[0.6, DESK_TOP + 0.01, 0.18]} />
      {clutter.map((c, i) => <Prop key={i} name={c.name} position={[c.spot[0], DESK_TOP, c.spot[1]]} rot={c.r} />)}
      <Prop name={UNDER_DESK[seed % UNDER_DESK.length]} position={[-0.3, 0, -0.1]} rot={seed} />
      <Prop name={ON_PARTITION[seed % ON_PARTITION.length]} position={[0.6, 1.15, -0.46]} />
      <Prop name={seed % 2 ? 'Cup_Coffee_Disposable_Closed_01' : 'Cup_Boss_01'} position={[-0.6, DESK_TOP, 0.1]} />
      <Prop name={seed % 3 ? 'Paper_Pile_02' : 'Book_Group_02'} position={[0.72, DESK_TOP, -0.2]} rot={seed} scale={seed % 3 ? 1 : 0.5} />
      <Prop name={['Figure_Goblin_01', 'Figure_Viking_01', 'Figure_Cowgirl_01', 'PuzzleCube_01'][seed % 4]} position={[-0.45, DESK_TOP, -0.3]} />
      <Prop name={['Computer_Tower_Modern_01', 'Computer_Tower_01', 'Computer_Tower_02', 'Computer_Tower_Flat_01'][seed % 4]} position={[0.72, 0, -0.12]} />
      <Prop name={['DeskLamp_06', 'DeskLamp_07', 'DeskLamp_08', 'Desklamp_04', 'DeskLamp_05', 'Desklamp_02', 'Desklamp_03', 'Plant_11'][seed % 8]} position={[-0.82, DESK_TOP, -0.3]} rot={0.5} />
      {seed % 3 !== 1 && <Prop name="NotePad_01" position={[-0.5, DESK_TOP, 0.3]} rot={seed * 0.7} />}
      {seed % 3 === 0 && <Prop name="Pen_01" position={[-0.38, DESK_TOP + 0.01, 0.3]} rot={seed} />}
      {seed % 4 === 1 && <Prop name={['Snack_02', 'Snack_04', 'Snack_06', 'Donut_Pink_01'][Math.floor(seed / 4) % 4]} position={[0.42, DESK_TOP, 0.32]} rot={seed} />}
      <Prop name={seed % 2 ? 'Bin_01' : 'Bin_Rubbish_01'} position={[-0.75, 0, 0.25]} scale={0.7} />
      {empty ? (
        <>
          <Prop name="Chair_05" position={[-0.3, 0, 1.0]} rot={Math.PI - 0.5} />
          <Prop name="Briefcase_01" position={[0.6, 0, 0.75]} rot={0.3} />
          <Prop name="CardboardBox_02" position={[-0.6, 0, 1.3]} rot={0.5} />
        </>
      ) : (
        <Prop name="Chair_05" position={[0, 0, 0.82]} rot={Math.PI} />
      )}
    </group>
  );
}

/** Shelf surfaces (m) measured from the Synty meshes, with the usable width. */
const SHELVES: Record<string, { w: number; levels: number[]; top: number; cubbies?: number }> = {
  Shelf_01: { w: 1.05, levels: [0.04, 0.45, 0.9, 1.36], top: 1.81 },
  Shelf_02: { w: 2.05, levels: [0.36, 0.78, 1.19], top: 1.6 },
  Shelf_04: { w: 0.95, levels: [0.27, 0.68], top: 1.09 },
  Shelf_05: { w: 1.2, levels: [0.63, 0.93, 1.23], top: 1.52 },
  Shelf_06: { w: 1.25, levels: [0.06, 0.34, 0.62], top: 0.89 },
  Shelf_07: { w: 2.95, levels: [0.04, 0.44, 0.85, 1.25], top: 1.67, cubbies: 6 },
};
/** Things that go on shelves: [prop, min x, max x, height]. */
type Item = [string, number, number, number];
const BOOKS: Item[] = [
  ['Book_Group_01', -0.45, 0.45, 0.29], ['Book_Group_02', -0.49, 0.49, 0.3], ['Book_Group_03', -0.48, 0.48, 0.3],
  ['Book_Group_05', -0.19, 0.19, 0.37], ['Book_Group_06', -0.03, 0.21, 0.38], ['Book_Group_07', -0.18, 0.18, 0.38],
  ['Book_Group_04', -0.2, 0.2, 0.19], ['Book_Group_08', -0.2, 0.2, 0.17],
];
const TRINKETS: Item[] = [
  ['Plant_09', -0.16, 0.16, 0.37], ['Plant_11', -0.1, 0.12, 0.31], ['Photo_05', -0.13, 0.13, 0.28], ['Figure_Knight_01', -0.06, 0.06, 0.22],
  ['Spaceship_01', -0.12, 0.12, 0.25], ['Printer_3D_Toy_01', -0.06, 0.06, 0.22], ['Speaker_Bluetooth_02', -0.2, 0.2, 0.15], ['Folder_Holder_03', -0.05, 0.05, 0.4],
];
const TOPS: Item[] = [
  ['Plant_08', -0.15, 0.17, 0.39], ['Globe_01', -0.19, 0.24, 0.58], ['Plant_03', -0.23, 0.23, 0.3], ['Trophy_01', -0.16, 0.16, 0.47],
  ['Book_Group_04', -0.2, 0.2, 0.19], ['Radio_02', -0.34, 0.34, 0.28], ['Jellybeans_01', -0.11, 0.11, 0.31], ['Box_01', -0.22, 0.22, 0.36],
];

function fillShelf(shelf: string, seed: number) {
  const s = SHELVES[shelf];
  const out: { name: string; x: number; y: number }[] = [];
  if (!s) return out;
  let k = 0;
  const r = () => rnd(seed * 31 + k++);
  const pick = (pool: Item[]) => pool[Math.floor(r() * pool.length)];
  s.levels.forEach((y, li) => {
    const room = (s.levels[li + 1] ?? s.top) - y - 0.03;
    const books = BOOKS.filter((b) => b[3] < room), trinkets = TRINKETS.filter((b) => b[3] < room);
    const choose = (fits: (i: Item) => boolean) => {
      const pool = (r() < 0.75 ? books : trinkets).filter(fits);
      return pool.length ? pick(pool) : undefined;
    };
    if (s.cubbies) {
      const cw = s.w / s.cubbies;
      for (let c = 0; c < s.cubbies; c++) {
        const it = r() < 0.15 ? undefined : choose((i) => i[2] - i[1] < cw - 0.06);
        if (it) out.push({ name: it[0], x: -s.w / 2 + (c + 0.5) * cw - (it[1] + it[2]) / 2, y });
      }
      return;
    }
    let x = -s.w / 2;
    for (let guard = 0; guard < 20; guard++) {
      if (r() < 0.25) x += 0.08 + r() * 0.2;
      const it = choose((i) => x + i[2] - i[1] < s.w / 2);
      if (!it) break;
      out.push({ name: it[0], x: x - it[1], y });
      x += it[2] - it[1] + 0.02;
    }
  });
  const top = pick(TOPS);
  out.push({ name: top[0], x: -s.w / 4, y: s.top });
  if (s.w > 1.5) out.push({ name: pick(TOPS)[0], x: s.w / 4, y: s.top });
  return out;
}

/** A shelf model filled with books, plants and photos. */
export function Bookcase({ name, position, rot = 0, seed = 1 }: { name: string; position: [number, number, number]; rot?: number; seed?: number }) {
  const items = useMemo(() => fillShelf(name, seed), [name, seed]);
  return (
    <group position={position} rotation-y={rot}>
      <Prop name={name} />
      {items.map((it, i) => <Prop key={i} name={it.name} position={[it.x, it.y, 0]} />)}
    </group>
  );
}
