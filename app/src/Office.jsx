import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Html, RoundedBox } from '@react-three/drei';
import { useOffice } from './store.js';
import Decor from './Details.jsx';
import Windows from './Windows.jsx';

export const C = {
  wall: '#f5f3ef', glass: '#cfe6f5', frame: '#2b2f36', deskTop: '#f7f7f5', metal: '#1f232a',
  screenOff: '#0f1218', chair: '#2a2e36', oak: '#c9a27a',
};
const center = (a, b) => (a + b) / 2;

// ---------- Teksturalar ----------
function useWoodTexture(W, H) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const g = c.getContext('2d');
    const rows = 16, plankW = 512 / rows;
    for (let r = 0; r < rows; r++) {
      let x = -Math.random() * 300;
      while (x < 512) {
        const len = 160 + Math.random() * 220;
        g.fillStyle = `hsl(${28 + Math.random() * 7}, ${34 + Math.random() * 10}%, ${64 + Math.random() * 12}%)`;
        g.fillRect(x, r * plankW, len, plankW);
        g.globalAlpha = 0.07;
        for (let i = 0; i < 6; i++) { g.fillStyle = '#5a3a1e'; g.fillRect(x, r * plankW + Math.random() * plankW, len, 1); }
        g.globalAlpha = 1;
        g.fillStyle = 'rgba(70,45,20,0.35)';
        g.fillRect(x, r * plankW, 1.5, plankW);
        x += len;
      }
      g.fillStyle = 'rgba(70,45,20,0.3)';
      g.fillRect(0, r * plankW, 512, 1.5);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, []);
  tex.repeat.set(W / 4, H / 4);
  return tex;
}

// Monitor ekranidagi terminal: agentning oxirgi loglari
function useTerminal(agent, enabled) {
  const canvas = useMemo(() => { const c = document.createElement('canvas'); c.width = 512; c.height = 300; return c; }, []);
  const tex = useMemo(() => { const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }, [canvas]);
  const log = agent?.log;
  const panic = agent?.state === 'panic';
  useEffect(() => {
    if (!enabled) return;
    const g = canvas.getContext('2d');
    g.fillStyle = panic ? '#2a0507' : '#0b1017';
    g.fillRect(0, 0, 512, 300);
    g.fillStyle = panic ? '#ff3b47' : agent?.color ?? '#4cc38a';
    g.fillRect(0, 0, 512, 26);
    g.fillStyle = '#0b1017';
    g.font = '600 17px "JetBrains Mono", ui-monospace, monospace';
    g.fillText(`${agent?.name ?? ''} — ${panic ? 'XATO!' : 'terminal'}`, 10, 19);
    g.font = '15px "JetBrains Mono", ui-monospace, monospace';
    const lines = (log ?? []).slice(0, 13).reverse();
    lines.forEach((l, i) => {
      g.fillStyle = l.level === 'error' ? '#ff6b74' : l.level === 'warn' ? '#f6bd73' : '#9fe2bf';
      const txt = `${l.time.slice(0, 5)} ${l.source ? `[${l.source}] ` : ''}${l.text}`;
      g.fillText(txt.length > 54 ? txt.slice(0, 53) + '…' : txt, 10, 46 + i * 19);
    });
    if (!lines.length) { g.fillStyle = '#5f6778'; g.fillText('$ _', 10, 50); }
    tex.needsUpdate = true;
  }, [log, panic, enabled, agent?.color, agent?.name, canvas, tex]);
  return tex;
}

// ---------- Devorlar ----------
function Walls({ L }) {
  return L.wallSegments.map((s, i) => {
    const len = s.b - s.a + 1;
    const [x, z] = s.dir === 'h' ? L.toWorld([center(s.a, s.b), s.at]) : L.toWorld([s.at, center(s.a, s.b)]);
    const h = s.outer ? 1.15 : 1.5;
    const t = s.outer ? 0.28 : 0.08;
    const size = s.dir === 'h' ? [len, t] : [t, len];
    if (s.outer) {
      return (
        <group key={i} position={[x, 0, z]}>
          <mesh position-y={h / 2} castShadow receiveShadow><boxGeometry args={[size[0], h, size[1]]} /><meshStandardMaterial color={C.wall} roughness={0.9} /></mesh>
          <mesh position-y={h + 0.02}><boxGeometry args={[size[0] + 0.01, 0.04, size[1] + 0.01]} /><meshStandardMaterial color={C.oak} roughness={0.6} /></mesh>
        </group>
      );
    }
    return (
      <group key={i} position={[x, 0, z]}>
        <mesh position-y={h / 2} renderOrder={2}>
          <boxGeometry args={[size[0], h, size[1]]} />
          <meshStandardMaterial color={C.glass} transparent opacity={0.3} roughness={0.05} metalness={0.1} depthWrite={false} />
        </mesh>
        <mesh position-y={h}><boxGeometry args={[size[0] + 0.02, 0.05, size[1] + 0.02]} /><meshStandardMaterial color={C.frame} /></mesh>
        <mesh position-y={0.03}><boxGeometry args={[size[0] + 0.02, 0.06, size[1] + 0.02]} /><meshStandardMaterial color={C.frame} /></mesh>
        <mesh position-y={0.85}><boxGeometry args={[size[0], 0.12, size[1] + 0.005]} /><meshStandardMaterial color="#ffffff" transparent opacity={0.45} depthWrite={false} /></mesh>
        {Array.from({ length: Math.floor(len / 2) + 1 }).map((_, k) => {
          const off = -len / 2 + Math.min(k * 2, len);
          return <mesh key={k} position={s.dir === 'h' ? [off, h / 2, 0] : [0, h / 2, off]}><boxGeometry args={[0.06, h, 0.1]} /><meshStandardMaterial color={C.frame} /></mesh>;
        })}
      </group>
    );
  });
}

// ---------- Pollar ----------
function Floors({ L }) {
  const wood = useWoodTexture(L.W, L.H);
  const theme = useOffice((s) => (s.sky.lamps > 0.5 ? 'night' : 'day'));
  const boss = useOffice((s) => s.boss);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={0.001} receiveShadow>
        <planeGeometry args={[L.W, L.H]} />
        <meshStandardMaterial map={wood} roughness={0.55} />
      </mesh>
      {L.rooms.map((r) => {
        const w = r.x[1] - r.x[0] + 1, d = r.z[1] - r.z[0] + 1;
        const [cx, cz] = L.toWorld([center(r.x[0], r.x[1]), center(r.z[0], r.z[1])]);
        if (r.kind === 'corridor') {
          return (
            <mesh key={r.id} rotation-x={-Math.PI / 2} position={[cx, 0.003, cz]} receiveShadow>
              <planeGeometry args={[w, d - 2]} /><meshStandardMaterial color="#c8ccd1" roughness={0.35} metalness={0.05} />
            </mesh>
          );
        }
        return (
          <group key={r.id}>
            <RoundedBox args={[w - 2.4, 0.02, d - 2.4]} radius={0.01} position={[cx, 0.012, cz]} receiveShadow>
              <meshStandardMaterial color={r.rug} roughness={1} />
            </RoundedBox>
            {r.name && (
              <Html position={[cx, 0.05, L.toWorld([0, r.z[1]])[1] + 0.25]} center distanceFactor={boss ? 7 : 16} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
                <div className={`room-label ${theme}`}>{r.name}</div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}

// ---------- Ish stoli ----------
function Monitor({ x, rotY = 0, on, color, night, map }) {
  return (
    <group position={[x, 0, -0.22]} rotation-y={rotY}>
      <RoundedBox args={[0.66, 0.4, 0.03]} radius={0.012} position-y={1.12} castShadow><meshStandardMaterial color={C.metal} roughness={0.4} /></RoundedBox>
      <mesh position={[0, 1.13, 0.017]}>
        <planeGeometry args={[0.62, 0.35]} />
        {map ? (
          <meshBasicMaterial map={map} toneMapped={false} />
        ) : (
          <meshStandardMaterial
            color={on ? color : night ? '#1a2a44' : C.screenOff}
            emissive={on ? color : night ? '#1a2a44' : '#000'}
            emissiveIntensity={on ? 1.1 : night ? 0.4 : 0}
            roughness={0.2}
          />
        )}
      </mesh>
      <mesh position={[0, 0.88, -0.02]}><boxGeometry args={[0.04, 0.24, 0.04]} /><meshStandardMaterial color="#9aa0a8" metalness={0.7} roughness={0.3} /></mesh>
      <mesh position={[0, 0.775, -0.02]}><boxGeometry args={[0.22, 0.012, 0.14]} /><meshStandardMaterial color="#9aa0a8" metalness={0.7} roughness={0.3} /></mesh>
    </group>
  );
}

export function OfficeChair({ color = C.chair }) {
  return (
    <group>
      <RoundedBox args={[0.56, 0.09, 0.52]} radius={0.04} position-y={0.48} castShadow><meshStandardMaterial color={color} roughness={0.8} /></RoundedBox>
      <RoundedBox args={[0.52, 0.62, 0.07]} radius={0.04} position={[0, 0.86, 0.27]} rotation-x={-0.12} castShadow><meshStandardMaterial color={color} roughness={0.8} /></RoundedBox>
      <mesh position-y={0.25}><cylinderGeometry args={[0.035, 0.035, 0.42, 10]} /><meshStandardMaterial color="#9aa0a8" metalness={0.8} roughness={0.3} /></mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[Math.sin((i / 5) * Math.PI * 2) * 0.17, 0.05, Math.cos((i / 5) * Math.PI * 2) * 0.17]} rotation-y={(i / 5) * Math.PI * 2}>
          <boxGeometry args={[0.04, 0.03, 0.34]} /><meshStandardMaterial color={C.metal} />
        </mesh>
      ))}
    </group>
  );
}

function Desk({ L, id, desk, seat }) {
  const owner = useOffice((s) => Object.values(s.agents).find((a) => a.deskId === id));
  const night = useOffice((s) => s.sky.lamps > 0.5);
  const on = !!owner && (owner.state === 'working' || owner.state === 'panic');
  const term = useTerminal(owner, !!owner);
  const [x, z] = L.toWorld(desk);
  const [sx, sz] = L.toWorld(seat);
  const accent = owner?.state === 'panic' ? '#ff2d3a' : owner?.color ?? '#7a8494';
  return (
    <group>
      <group position={[x, 0, z]}>
        <RoundedBox args={[1.7, 0.05, 0.85]} radius={0.02} position-y={0.75} castShadow receiveShadow><meshStandardMaterial color={C.deskTop} roughness={0.35} /></RoundedBox>
        {[-0.78, 0.78].map((lx) => (
          <mesh key={lx} position={[lx, 0.37, 0]} castShadow><boxGeometry args={[0.05, 0.74, 0.72]} /><meshStandardMaterial color={C.metal} roughness={0.5} /></mesh>
        ))}
        <Monitor x={-0.34} rotY={0.12} on={on} color={accent} night={night} map={owner ? term : null} />
        <Monitor x={0.34} rotY={-0.12} on={on} color={accent} night={night} />
        <RoundedBox args={[0.46, 0.018, 0.15]} radius={0.006} position={[0, 0.785, 0.16]}><meshStandardMaterial color="#e4e6ea" /></RoundedBox>
        <mesh position={[0.36, 0.782, 0.18]}><boxGeometry args={[0.08, 0.02, 0.12]} /><meshStandardMaterial color="#e4e6ea" /></mesh>
        <group position={[-0.72, 0.775, -0.25]}>
          <mesh position-y={0.2}><cylinderGeometry args={[0.012, 0.012, 0.4, 6]} /><meshStandardMaterial color={C.metal} /></mesh>
          <mesh position={[0.08, 0.4, 0.05]} rotation-z={-0.5}>
            <coneGeometry args={[0.07, 0.1, 16, 1, true]} />
            <meshStandardMaterial color={C.metal} emissive={night ? '#ffd9a0' : '#000'} emissiveIntensity={night ? 1.5 : 0} side={THREE.DoubleSide} />
          </mesh>
        </group>
        <mesh position={[0.68, 0.82, 0.05]}><cylinderGeometry args={[0.04, 0.035, 0.09, 12]} /><meshStandardMaterial color={accent} /></mesh>
        <mesh position={[0.95, 0.17, 0.25]} castShadow><cylinderGeometry args={[0.13, 0.11, 0.34, 16, 1, true]} /><meshStandardMaterial color="#9aa0a8" side={THREE.DoubleSide} /></mesh>
      </group>
      <group position={[sx, 0, sz]}><OfficeChair /></group>
    </group>
  );
}

// ---------- Majlis xonasi ----------
function Meeting({ L }) {
  const night = useOffice((s) => s.sky.lamps > 0.5);
  const m = L.meeting;
  if (!m.table) return null;
  const [x, z] = L.toWorld([center(...m.table.x), center(...m.table.z)]);
  const [scx, scz] = L.toWorld([m.screen.x, m.screen.z]);
  return (
    <group>
      <RoundedBox args={[5.4, 0.07, 2.1]} radius={0.03} position={[x, 0.75, z]} castShadow receiveShadow><meshStandardMaterial color={C.oak} roughness={0.45} /></RoundedBox>
      {[-2, 2].map((lx) => <mesh key={lx} position={[x + lx, 0.37, z]} castShadow><boxGeometry args={[0.08, 0.74, 1.6]} /><meshStandardMaterial color={C.metal} /></mesh>)}
      {m.seats.map((s, i) => {
        const [sx, sz] = L.toWorld(s);
        const back = s[1] < m.table.z[0] ? -1 : 1;
        return (
          <group key={i} position={[sx, 0, sz]}>
            <RoundedBox args={[0.5, 0.1, 0.48]} radius={0.05} position-y={0.47} castShadow><meshStandardMaterial color="#d97a4a" roughness={0.85} /></RoundedBox>
            <RoundedBox args={[0.48, 0.42, 0.07]} radius={0.04} position={[0, 0.74, back * 0.24]} castShadow><meshStandardMaterial color="#d97a4a" roughness={0.85} /></RoundedBox>
            <mesh position-y={0.22}><cylinderGeometry args={[0.03, 0.12, 0.44, 10]} /><meshStandardMaterial color={C.metal} /></mesh>
          </group>
        );
      })}
      <group position={[scx, 0, scz + 0.12]}>
        <RoundedBox args={[2.6, 1.0, 0.06]} radius={0.02} position-y={0.95} castShadow><meshStandardMaterial color={C.metal} /></RoundedBox>
        <mesh position={[0, 0.95, 0.032]}><planeGeometry args={[2.48, 0.88]} /><meshStandardMaterial color="#2b5cab" emissive="#3a72d6" emissiveIntensity={night ? 1.2 : 0.55} /></mesh>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[-0.8 + i * 0.5, 0.78 + (i % 2) * 0.12, 0.035]}><planeGeometry args={[0.32, 0.3 + (i % 3) * 0.12]} /><meshBasicMaterial color="#9ecbff" transparent opacity={0.7} /></mesh>
        ))}
      </group>
    </group>
  );
}

// ---------- Dam olish xonasi ----------
function Lounge({ L }) {
  const night = useOffice((s) => s.sky.lamps > 0.5);
  const lo = L.lounge;
  if (!lo.couch) return null;
  const [x, z] = L.toWorld([center(...lo.couch.x), lo.couch.z]);
  const [kx, kz] = L.toWorld(lo.coffee);
  const [tx, tz] = L.toWorld([center(...lo.coffeeTable.x), lo.coffeeTable.z]);
  return (
    <group>
      <group position={[x, 0, z + 0.1]}>
        <RoundedBox args={[5, 0.32, 0.95]} radius={0.08} position-y={0.24} castShadow receiveShadow><meshStandardMaterial color="#56606e" roughness={0.95} /></RoundedBox>
        <RoundedBox args={[5, 0.55, 0.25]} radius={0.1} position={[0, 0.6, 0.36]} castShadow><meshStandardMaterial color="#56606e" roughness={0.95} /></RoundedBox>
        {[-2.45, 2.45].map((ax) => <RoundedBox key={ax} args={[0.22, 0.5, 0.95]} radius={0.08} position={[ax, 0.38, 0]} castShadow><meshStandardMaterial color="#4a5260" roughness={0.95} /></RoundedBox>)}
        {[-1.6, -0.55, 0.55, 1.6].map((cx, i) => (
          <RoundedBox key={cx} args={[0.95, 0.14, 0.72]} radius={0.06} position={[cx, 0.46, -0.08]} castShadow><meshStandardMaterial color={i % 2 ? '#e0a03a' : '#6b7685'} roughness={0.95} /></RoundedBox>
        ))}
      </group>
      <group position={[tx, 0, tz]}>
        <mesh position-y={0.38} castShadow receiveShadow><cylinderGeometry args={[0.75, 0.75, 0.05, 40]} /><meshStandardMaterial color={C.oak} roughness={0.4} /></mesh>
        <mesh position-y={0.18}><cylinderGeometry args={[0.06, 0.25, 0.36, 16]} /><meshStandardMaterial color={C.metal} /></mesh>
        <mesh position={[0.2, 0.44, 0.05]}><cylinderGeometry args={[0.05, 0.04, 0.08, 12]} /><meshStandardMaterial color="#ffffff" /></mesh>
        <mesh position={[-0.25, 0.43, -0.1]} rotation-y={0.4}><boxGeometry args={[0.3, 0.04, 0.22]} /><meshStandardMaterial color="#d9534f" /></mesh>
      </group>
      {lo.beanBags.map((b, i) => {
        const [bx, bz] = L.toWorld(b);
        return <mesh key={i} position={[bx, 0.25, bz]} scale={[1, 0.62, 1]} castShadow><sphereGeometry args={[0.42, 24, 18]} /><meshStandardMaterial color={i ? '#3f8f7a' : '#c0574b'} roughness={1} /></mesh>;
      })}
      {lo.tv && (
        <group position={[L.toWorld([0, 0])[0] + 0.18, 0, L.toWorld([0, lo.tv.z])[1]]} rotation-y={Math.PI / 2}>
          <RoundedBox args={[1.9, 0.95, 0.05]} radius={0.015} position-y={0.95} castShadow><meshStandardMaterial color={C.metal} /></RoundedBox>
          <mesh position={[0, 0.95, 0.027]}><planeGeometry args={[1.82, 0.87]} /><meshStandardMaterial color="#1d3b2f" emissive="#2f9e64" emissiveIntensity={night ? 0.8 : 0.35} /></mesh>
        </group>
      )}
      <group position={[kx, 0, kz]}>
        <RoundedBox args={[0.95, 0.9, 0.7]} radius={0.03} position-y={0.45} castShadow><meshStandardMaterial color="#f2f2f0" roughness={0.4} /></RoundedBox>
        <RoundedBox args={[0.97, 0.04, 0.72]} radius={0.01} position-y={0.92}><meshStandardMaterial color={C.oak} /></RoundedBox>
        <RoundedBox args={[0.38, 0.42, 0.34]} radius={0.04} position={[0, 1.15, -0.05]} castShadow><meshStandardMaterial color="#2a2e36" metalness={0.3} roughness={0.4} /></RoundedBox>
        <mesh position={[0, 1.24, 0.123]}><planeGeometry args={[0.2, 0.08]} /><meshStandardMaterial color="#5ee0a0" emissive="#5ee0a0" emissiveIntensity={0.9} /></mesh>
      </group>
    </group>
  );
}

function Plants({ L }) {
  const pot = useMemo(() => new THREE.CylinderGeometry(0.22, 0.18, 0.5, 20), []);
  const potMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f2f0ec', roughness: 0.5 }), []);
  const leaf = useMemo(() => new THREE.IcosahedronGeometry(0.34, 1), []);
  const leafMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4f9a5b', flatShading: true, roughness: 0.8 }), []);
  const leaf2Mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3a7d48', flatShading: true, roughness: 0.8 }), []);
  const parts = [[pot, potMat, 0.25, [1, 1, 1]], [leaf, leafMat, 0.85, [1, 1.5, 1]], [leaf, leaf2Mat, 1.3, [0.7, 1.1, 0.7]]];
  return parts.map(([g, m, y, s], k) => <Instanced key={`${k}-${L.key}`} L={L} cells={L.plants} geometry={g} material={m} y={y} scale={s} />);
}

function Instanced({ L, cells, geometry, material, y = 0, scale = [1, 1, 1] }) {
  const ref = useRef();
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    cells.forEach((c, i) => {
      const [x, z] = L.toWorld(c);
      m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, i * 1.3, 0)), new THREE.Vector3(...scale));
      ref.current.setMatrixAt(i, m);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [cells, y, scale, L]);
  return <instancedMesh ref={ref} args={[geometry, material, cells.length]} castShadow receiveShadow />;
}

function RoomLights({ L }) {
  const lamps = useOffice((s) => Math.round(s.sky.lamps * 20) / 20);
  if (lamps < 0.05) return null;
  return L.rooms.map((r) => {
    const [cx, cz] = L.toWorld([center(r.x[0], r.x[1]), center(r.z[0], r.z[1])]);
    return <pointLight key={r.id} position={[cx, 3.4, cz]} intensity={(r.kind === 'corridor' ? 5 : 9) * lamps} distance={10} decay={1.6} color="#ffd9a8" />;
  });
}

function Ground({ L }) {
  const ground = useOffice((s) => s.sky.ground);
  return (
    <RoundedBox args={[L.W + 3, 0.6, L.H + 3]} radius={0.25} position-y={-0.31} receiveShadow>
      <meshStandardMaterial color={ground} roughness={1} />
    </RoundedBox>
  );
}

export default function Office() {
  const L = useOffice((s) => s.layout);
  return (
    <group>
      <RoomLights L={L} />
      <Windows L={L} />
      <Ground L={L} key={`g${L.W}`} />
      <Floors L={L} />
      <Walls L={L} />
      {Object.entries(L.desks).map(([id, d]) => <Desk key={`${id}`} L={L} id={id} {...d} />)}
      <Meeting L={L} />
      <Lounge L={L} />
      {L.decor.map((d, i) => <Decor key={`${L.key}-${i}`} L={L} item={d} />)}
      <Plants L={L} />
    </group>
  );
}
