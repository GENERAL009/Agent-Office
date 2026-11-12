// Ofisdagi qo'shimcha detallar: kreslolar, globus, printer, muzlatgich, arkada,
// monitoring devori, haqiqiy vaqtni ko'rsatadigan soat, logotip va boshqalar.
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { toWorld, props, desks } from './layout.js';
import { useOffice, BAD } from './store.js';

const METAL = '#1f232a';
const OAK = '#c9a27a';
const at = (c) => { const [x, z] = toWorld(c); return [x, 0, z]; };

function textTexture(text, { w = 1024, h = 160, bg = 'rgba(0,0,0,0)', color = '#fff', font = '700 92px Inter, system-ui, sans-serif' } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = color; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Armchairs() {
  return (
    <group>
      {props.armchairs.map((c, i) => (
        <group key={i} position={at(c)} rotation-y={Math.PI / 2}>
          <RoundedBox args={[0.85, 0.36, 0.8]} radius={0.1} position-y={0.3} castShadow><meshStandardMaterial color="#7b5a3d" roughness={0.6} /></RoundedBox>
          <RoundedBox args={[0.85, 0.5, 0.2]} radius={0.08} position={[0, 0.62, -0.32]} castShadow><meshStandardMaterial color="#7b5a3d" roughness={0.6} /></RoundedBox>
          {[-0.4, 0.4].map((ax) => (
            <RoundedBox key={ax} args={[0.12, 0.42, 0.75]} radius={0.05} position={[ax, 0.45, 0]}><meshStandardMaterial color="#6a4c33" roughness={0.6} /></RoundedBox>
          ))}
        </group>
      ))}
      {/* kichik stolcha va gilam */}
      <mesh position={[toWorld([2, 5.5])[0], 0.012, toWorld([2, 5.5])[1]]} rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[1.25, 40]} /><meshStandardMaterial color="#e9e1d4" roughness={1} />
      </mesh>
      <group position={[toWorld([2.15, 5.5])[0], 0, toWorld([2.15, 5.5])[1]]}>
        <mesh position-y={0.45} castShadow><cylinderGeometry args={[0.28, 0.28, 0.04, 28]} /><meshStandardMaterial color={OAK} /></mesh>
        <mesh position-y={0.22}><cylinderGeometry args={[0.03, 0.03, 0.44, 8]} /><meshStandardMaterial color={METAL} /></mesh>
        <mesh position={[0.08, 0.52, 0]}><cylinderGeometry args={[0.035, 0.03, 0.1, 12]} /><meshStandardMaterial color="#fff" /></mesh>
      </group>
    </group>
  );
}

function Globe() {
  const g = useRef();
  useFrame((_, dt) => { if (g.current) g.current.rotation.y += dt * 0.4; });
  return (
    <group position={at(props.globe)}>
      <mesh position-y={0.3}><cylinderGeometry args={[0.04, 0.18, 0.6, 12]} /><meshStandardMaterial color={OAK} /></mesh>
      <mesh ref={g} position-y={0.85} rotation-z={0.4} castShadow>
        <sphereGeometry args={[0.26, 24, 16]} />
        <meshStandardMaterial color="#3d7fc4" roughness={0.5} />
      </mesh>
      <mesh position-y={0.85} rotation-z={0.4}><torusGeometry args={[0.3, 0.012, 6, 32]} /><meshStandardMaterial color="#c9a227" metalness={0.8} roughness={0.3} /></mesh>
    </group>
  );
}

function FloorLamps() {
  const lamps = useOffice((s) => s.sky.lamps);
  return props.floorLamps.map((c, i) => (
    <group key={i} position={at(c)}>
      <mesh position-y={0.02}><cylinderGeometry args={[0.18, 0.18, 0.04, 20]} /><meshStandardMaterial color={METAL} /></mesh>
      <mesh position-y={0.8}><cylinderGeometry args={[0.018, 0.018, 1.6, 8]} /><meshStandardMaterial color={METAL} /></mesh>
      <mesh position-y={1.62} castShadow>
        <cylinderGeometry args={[0.16, 0.24, 0.3, 24, 1, true]} />
        <meshStandardMaterial color="#f3ead9" emissive="#ffd8a0" emissiveIntensity={lamps * 1.4} side={THREE.DoubleSide} />
      </mesh>
    </group>
  ));
}

function Printer() {
  return (
    <group position={at(props.printer)}>
      <RoundedBox args={[0.7, 0.55, 0.55]} radius={0.03} position-y={0.28} castShadow><meshStandardMaterial color="#e9ebee" /></RoundedBox>
      <RoundedBox args={[0.62, 0.22, 0.5]} radius={0.03} position-y={0.66} castShadow><meshStandardMaterial color="#d4d7dc" /></RoundedBox>
      <mesh position={[0, 0.79, 0.05]}><boxGeometry args={[0.4, 0.01, 0.3]} /><meshStandardMaterial color="#ffffff" /></mesh>
      <mesh position={[0.22, 0.7, 0.26]}><planeGeometry args={[0.1, 0.05]} /><meshStandardMaterial color="#4cc38a" emissive="#4cc38a" emissiveIntensity={1} /></mesh>
    </group>
  );
}

function CoatRack() {
  return (
    <group position={at(props.coatRack)}>
      <mesh position-y={0.85}><cylinderGeometry args={[0.025, 0.03, 1.7, 8]} /><meshStandardMaterial color={OAK} /></mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[Math.sin(i * 2.1) * 0.15, 0.06, Math.cos(i * 2.1) * 0.15]} rotation={[Math.cos(i * 2.1) * 0.6, 0, -Math.sin(i * 2.1) * 0.6]}>
          <cylinderGeometry args={[0.015, 0.015, 0.3, 6]} /><meshStandardMaterial color={OAK} />
        </mesh>
      ))}
      <mesh position={[0.12, 1.35, 0]} castShadow><capsuleGeometry args={[0.1, 0.45, 4, 8]} /><meshStandardMaterial color="#3a4252" /></mesh>
      <mesh position={[-0.1, 1.45, 0.05]} castShadow><capsuleGeometry args={[0.08, 0.3, 4, 8]} /><meshStandardMaterial color="#c0574b" /></mesh>
    </group>
  );
}

function LoungeChair() {
  return (
    <group position={at(props.loungeChair)} rotation-y={Math.PI / 2}>
      <RoundedBox args={[0.8, 0.12, 0.85]} radius={0.05} position-y={0.36} castShadow><meshStandardMaterial color="#e8d9c4" /></RoundedBox>
      <RoundedBox args={[0.8, 0.6, 0.12]} radius={0.05} position={[0, 0.66, -0.38]} rotation-x={-0.25} castShadow><meshStandardMaterial color="#e8d9c4" /></RoundedBox>
      {[[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]].map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.15, lz]}><cylinderGeometry args={[0.02, 0.02, 0.3, 6]} /><meshStandardMaterial color={OAK} /></mesh>
      ))}
    </group>
  );
}

function Easel() {
  const art = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 192;
    const g = c.getContext('2d');
    g.fillStyle = '#f7f3ec'; g.fillRect(0, 0, 256, 192);
    const cols = ['#e0a03a', '#3b82c4', '#b05cc2', '#2f9e64', '#e8684a'];
    for (let i = 0; i < 9; i++) {
      g.fillStyle = cols[i % cols.length]; g.globalAlpha = 0.85;
      g.fillRect(20 + (i % 3) * 76, 20 + Math.floor(i / 3) * 54, 60 + (i % 2) * 10, 40);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, []);
  return (
    <group position={at(props.easel)} rotation-y={-Math.PI / 2 + 0.3}>
      {[-0.25, 0.25].map((lx) => (
        <mesh key={lx} position={[lx, 0.8, 0]} rotation-z={lx > 0 ? -0.08 : 0.08}><boxGeometry args={[0.04, 1.6, 0.04]} /><meshStandardMaterial color={OAK} /></mesh>
      ))}
      <mesh position={[0, 0.7, -0.3]} rotation-x={0.35}><boxGeometry args={[0.04, 1.4, 0.04]} /><meshStandardMaterial color={OAK} /></mesh>
      <mesh position={[0, 1.15, 0.04]} castShadow><boxGeometry args={[0.8, 0.6, 0.03]} /><meshStandardMaterial map={art} /></mesh>
    </group>
  );
}

function MonitorWall() {
  const bars = useRef([]);
  const alert = useOffice((s) => Object.values(s.services).some((sv) => BAD.has(sv.state)) || Object.values(s.agents).some((a) => a.state === 'panic'));
  const [x, , z] = at([10.5, props.monitorWall.z]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    bars.current.forEach((b, i) => {
      if (!b) return;
      const v = alert ? 0.2 + Math.abs(Math.sin(t * 9 + i)) * 0.8 : 0.35 + 0.3 * Math.sin(t * 1.3 + i * 0.7) + 0.15 * Math.sin(t * 3.1 + i);
      b.scale.y = Math.max(0.05, v);
      b.position.y = -0.28 + (0.56 * b.scale.y) / 2;
    });
  });
  const barColor = alert ? '#ff3b3b' : '#4cc38a';
  return (
    <group position={[x, 0, z]}>
      <mesh position-y={0.5}><boxGeometry args={[0.1, 1, 0.1]} /><meshStandardMaterial color={METAL} /></mesh>
      <mesh position-y={0.03}><boxGeometry args={[1.2, 0.06, 0.5]} /><meshStandardMaterial color={METAL} /></mesh>
      {[-0.52, 0.52].map((sx, k) => (
        <group key={sx} position={[sx, 1.25, 0.06]} rotation-y={-sx * 0.25}>
          <RoundedBox args={[1.02, 0.66, 0.04]} radius={0.015} castShadow><meshStandardMaterial color={METAL} /></RoundedBox>
          <mesh position-z={0.022}><planeGeometry args={[0.96, 0.6]} /><meshStandardMaterial color="#0c1118" emissive={alert ? '#3a0a0e' : '#0a1a14'} emissiveIntensity={1} /></mesh>
          {Array.from({ length: 8 }).map((_, i) => (
            <mesh key={i} ref={(m) => (bars.current[k * 8 + i] = m)} position={[-0.4 + i * 0.115, 0, 0.025]}>
              <planeGeometry args={[0.07, 0.56]} />
              <meshBasicMaterial color={k === 1 && !alert ? '#5aa9ff' : barColor} toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Ups() {
  return (
    <group position={at(props.ups)}>
      <RoundedBox args={[0.5, 0.7, 0.6]} radius={0.03} position-y={0.35} castShadow><meshStandardMaterial color="#20242b" /></RoundedBox>
      <mesh position={[0, 0.55, 0.305]}><planeGeometry args={[0.2, 0.08]} /><meshStandardMaterial color="#5aa9ff" emissive="#5aa9ff" emissiveIntensity={1} /></mesh>
    </group>
  );
}

function StandBoard() {
  return (
    <group position={at(props.standBoard)} rotation-y={-Math.PI / 2}>
      {[-0.5, 0.5].map((lx) => <mesh key={lx} position={[lx, 0.75, 0]}><boxGeometry args={[0.04, 1.5, 0.04]} /><meshStandardMaterial color="#9aa0a8" metalness={0.6} /></mesh>)}
      <mesh position-y={1.1} castShadow><boxGeometry args={[1.1, 0.7, 0.03]} /><meshStandardMaterial color="#fbfbfb" roughness={0.2} /></mesh>
      {[[-0.3, 1.25, '#3b82c4', 0.3], [0.05, 1.05, '#e8684a', 0.4], [0.3, 1.25, '#2f9e64', 0.2]].map(([px, py, c, w], i) => (
        <mesh key={i} position={[px, py, 0.02]}><planeGeometry args={[w, 0.03]} /><meshBasicMaterial color={c} /></mesh>
      ))}
    </group>
  );
}

function Fridge() {
  return (
    <group position={at(props.fridge)}>
      <RoundedBox args={[0.7, 1.75, 0.65]} radius={0.05} position-y={0.88} castShadow><meshStandardMaterial color="#e6e9ed" metalness={0.3} roughness={0.35} /></RoundedBox>
      <mesh position={[0, 1.2, 0.33]}><boxGeometry args={[0.66, 0.01, 0.01]} /><meshStandardMaterial color="#9aa0a8" /></mesh>
      <mesh position={[0.25, 0.95, 0.34]}><boxGeometry args={[0.03, 0.4, 0.03]} /><meshStandardMaterial color="#9aa0a8" metalness={0.8} /></mesh>
      <mesh position={[-0.1, 1.5, 0.33]}><planeGeometry args={[0.14, 0.14]} /><meshStandardMaterial color="#ffe066" /></mesh>
    </group>
  );
}

function Arcade() {
  const scr = useRef();
  useFrame(({ clock }) => { if (scr.current) scr.current.color.setHSL((clock.elapsedTime * 0.15) % 1, 0.8, 0.55); });
  return (
    <group position={at(props.arcade)}>
      <RoundedBox args={[0.66, 1.7, 0.66]} radius={0.04} position-y={0.85} castShadow><meshStandardMaterial color="#3b2a6e" /></RoundedBox>
      <mesh position={[0, 1.3, 0.335]} rotation-x={-0.15}><planeGeometry args={[0.5, 0.4]} /><meshBasicMaterial ref={scr} toneMapped={false} /></mesh>
      <mesh position={[0, 0.98, 0.38]} rotation-x={-0.6}><boxGeometry args={[0.6, 0.04, 0.2]} /><meshStandardMaterial color="#1b1b1f" /></mesh>
      {[-0.12, 0.05, 0.15].map((bx, i) => (
        <mesh key={i} position={[bx, 1.01, 0.4]}><cylinderGeometry args={[0.025, 0.025, 0.03, 10]} /><meshStandardMaterial color={['#ff3b3b', '#ffe066', '#5aa9ff'][i]} emissive={['#ff3b3b', '#ffe066', '#5aa9ff'][i]} emissiveIntensity={0.6} /></mesh>
      ))}
      <mesh position={[0, 1.62, 0.335]}><planeGeometry args={[0.55, 0.1]} /><meshBasicMaterial color="#ff5ec4" toneMapped={false} /></mesh>
    </group>
  );
}

function WaterCooler() {
  return (
    <group position={at(props.waterCooler)}>
      <RoundedBox args={[0.4, 0.95, 0.4]} radius={0.03} position-y={0.48} castShadow><meshStandardMaterial color="#eef1f4" /></RoundedBox>
      <mesh position-y={1.18} castShadow><cylinderGeometry args={[0.16, 0.16, 0.42, 20]} /><meshPhysicalMaterial color="#9fd3ff" transparent opacity={0.6} roughness={0.1} /></mesh>
      <mesh position={[0, 0.7, 0.21]}><boxGeometry args={[0.06, 0.06, 0.04]} /><meshStandardMaterial color="#3b82c4" /></mesh>
    </group>
  );
}

function Vending() {
  const lamps = useOffice((s) => s.sky.lamps);
  return (
    <group position={at(props.vending)} rotation-y={-Math.PI / 2}>
      <RoundedBox args={[0.85, 1.8, 0.7]} radius={0.04} position-y={0.9} castShadow><meshStandardMaterial color="#d9534f" /></RoundedBox>
      <mesh position={[-0.1, 1.05, 0.355]}><planeGeometry args={[0.55, 1.1]} /><meshStandardMaterial color="#cfe7ff" emissive="#cfe7ff" emissiveIntensity={0.3 + lamps * 0.8} /></mesh>
      {Array.from({ length: 12 }).map((_, i) => (
        <mesh key={i} position={[-0.3 + (i % 4) * 0.13, 1.45 - Math.floor(i / 4) * 0.3, 0.36]}>
          <boxGeometry args={[0.08, 0.14, 0.02]} />
          <meshStandardMaterial color={['#ffe066', '#2f9e64', '#3b82c4', '#e8684a'][i % 4]} />
        </mesh>
      ))}
    </group>
  );
}

function Benches() {
  return props.benches.map((b, i) => {
    const [x, , z] = at([(b.x[0] + b.x[1]) / 2, b.z]);
    return (
      <group key={i} position={[x, 0, z]}>
        <RoundedBox args={[1.8, 0.08, 0.5]} radius={0.03} position-y={0.45} castShadow><meshStandardMaterial color={OAK} /></RoundedBox>
        {[-0.75, 0.75].map((lx) => <mesh key={lx} position={[lx, 0.22, 0]}><boxGeometry args={[0.06, 0.44, 0.44]} /><meshStandardMaterial color={METAL} /></mesh>)}
      </group>
    );
  });
}

// Koridordagi logotip va haqiqiy vaqtni ko'rsatuvchi soat (shisha devorga osilgan)
function SignAndClock() {
  const project = useOffice((s) => s.project);
  const sign = useMemo(() => textTexture(project ? `AGENT OFFICE · ${project.toUpperCase()}` : 'AGENT OFFICE', { color: '#1b1f27' }), [project]);
  const hour = useRef();
  const minute = useRef();
  const second = useRef();
  useFrame(() => {
    const d = new Date();
    const s = d.getSeconds() + d.getMilliseconds() / 1000;
    const m = d.getMinutes() + s / 60;
    const h = (d.getHours() % 12) + m / 60;
    if (second.current) second.current.rotation.z = -(s / 60) * Math.PI * 2;
    if (minute.current) minute.current.rotation.z = -(m / 60) * Math.PI * 2;
    if (hour.current) hour.current.rotation.z = -(h / 12) * Math.PI * 2;
  });
  const [sx, , sz] = at([20.5, 8]);
  const [cx, , cz] = at([10.5, 8]);
  const hand = (ref, len, w, color) => (
    <group ref={ref}><mesh position-y={len / 2}><planeGeometry args={[w, len]} /><meshBasicMaterial color={color} /></mesh></group>
  );
  return (
    <group>
      <group position={[sx, 1.12, sz + 0.07]}>
        <RoundedBox args={[3.4, 0.42, 0.04]} radius={0.02}><meshStandardMaterial color="#f7f5f1" /></RoundedBox>
        <mesh position-z={0.022}><planeGeometry args={[3.3, 0.5]} /><meshBasicMaterial map={sign} transparent toneMapped={false} /></mesh>
        <mesh position={[-1.55, 0, 0.025]}><circleGeometry args={[0.1, 20]} /><meshBasicMaterial color="#f0a548" /></mesh>
      </group>
      <group position={[cx, 1.08, cz + 0.07]}>
        <mesh><cylinderGeometry args={[0.32, 0.32, 0.05, 40]} /><meshStandardMaterial color={METAL} /></mesh>
      </group>
      <group position={[cx, 1.08, cz + 0.1]}>
        <mesh><circleGeometry args={[0.29, 40]} /><meshBasicMaterial color="#fbfbf8" /></mesh>
        {Array.from({ length: 12 }).map((_, i) => (
          <mesh key={i} position={[Math.sin((i / 12) * Math.PI * 2) * 0.24, Math.cos((i / 12) * Math.PI * 2) * 0.24, 0.002]}>
            <circleGeometry args={[i % 3 === 0 ? 0.018 : 0.009, 8]} /><meshBasicMaterial color="#1b1f27" />
          </mesh>
        ))}
        <group position-z={0.004}>{hand(hour, 0.14, 0.022, '#1b1f27')}</group>
        <group position-z={0.006}>{hand(minute, 0.21, 0.014, '#1b1f27')}</group>
        <group position-z={0.008}>{hand(second, 0.23, 0.006, '#e8684a')}</group>
      </group>
    </group>
  );
}

function CorridorRunner() {
  const [x, , z] = at([15.5, 10.5]);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[x, 0.008, z]} receiveShadow>
        <planeGeometry args={[24, 1.1]} /><meshStandardMaterial color="#8a7f73" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[x, 0.009, z]}>
        <planeGeometry args={[23.8, 0.9]} /><meshStandardMaterial color="#a3988b" roughness={1} />
      </mesh>
    </group>
  );
}

// Stollar yonidagi savatchalar va stol ustidagi mayda narsalar
function DeskBits() {
  return Object.entries(desks).map(([id, d], i) => {
    const [x, , z] = at(d.desk);
    return (
      <group key={id} position={[x, 0, z]}>
        <mesh position={[0.95, 0.17, 0.25]} castShadow><cylinderGeometry args={[0.13, 0.11, 0.34, 16, 1, true]} /><meshStandardMaterial color="#9aa0a8" side={THREE.DoubleSide} /></mesh>
        {i % 2 === 0 ? (
          <group position={[0.55, 0.78, -0.25]}>
            <mesh position-y={0.05}><cylinderGeometry args={[0.06, 0.05, 0.1, 12]} /><meshStandardMaterial color="#f2f0ec" /></mesh>
            <mesh position-y={0.16}><icosahedronGeometry args={[0.09, 0]} /><meshStandardMaterial color="#4f9a5b" flatShading /></mesh>
          </group>
        ) : (
          <group position={[-0.45, 0.79, 0.2]} rotation-y={0.3}>
            <mesh><boxGeometry args={[0.32, 0.02, 0.22]} /><meshStandardMaterial color="#c9ccd2" metalness={0.6} roughness={0.3} /></mesh>
          </group>
        )}
      </group>
    );
  });
}

export default function Details() {
  return (
    <group>
      <Armchairs />
      <Globe />
      <FloorLamps />
      <Printer />
      <CoatRack />
      <LoungeChair />
      <Easel />
      <MonitorWall />
      <Ups />
      <StandBoard />
      <Fridge />
      <Arcade />
      <WaterCooler />
      <Vending />
      <Benches />
      <SignAndClock />
      <CorridorRunner />
      <DeskBits />
    </group>
  );
}
