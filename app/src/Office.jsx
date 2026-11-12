import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html, RoundedBox } from '@react-three/drei';
import {
  W, H, toWorld, wallSegments, rooms, desks, meetingTable, meetingSeats, couch, coffee,
  coffeeTable, beanBags, bookshelf, serverRack, plants,
} from './layout.js';
import Details from './Details.jsx';
import Windows from './Windows.jsx';
import { useOffice, BAD } from './store.js';

const C = {
  wall: '#f5f3ef',
  wallCap: '#2b2f36',
  glass: '#cfe6f5',
  frame: '#2b2f36',
  deskTop: '#f7f7f5',
  metal: '#1f232a',
  screenOff: '#0f1218',
  chair: '#2a2e36',
  oak: '#c9a27a',
};

// ---------- Teksturalar (kodda chiziladi, yuklab olish shart emas) ----------
function useWoodTexture() {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const g = c.getContext('2d');
    const rows = 16, plankW = 512 / rows;
    for (let r = 0; r < rows; r++) {
      let x = -Math.random() * 300;
      while (x < 512) {
        const len = 160 + Math.random() * 220;
        const l = 64 + Math.random() * 12;
        g.fillStyle = `hsl(${28 + Math.random() * 7}, ${34 + Math.random() * 10}%, ${l}%)`;
        g.fillRect(x, r * plankW, len, plankW);
        g.globalAlpha = 0.07;
        for (let i = 0; i < 6; i++) {
          g.fillStyle = '#5a3a1e';
          g.fillRect(x, r * plankW + Math.random() * plankW, len, 1);
        }
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
    t.repeat.set(W / 4, H / 4);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, []);
}

// ---------- Yordamchi ----------
function Instanced({ cells, geometry, material, y = 0, scale = [1, 1, 1], castShadow = true }) {
  const ref = useRef();
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    cells.forEach((c, i) => {
      const [x, z] = toWorld(c);
      const s = typeof scale === 'function' ? scale(i) : scale;
      m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, i * 1.3, 0)), new THREE.Vector3(...s));
      ref.current.setMatrixAt(i, m);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [cells, y, scale]);
  return <instancedMesh ref={ref} args={[geometry, material, cells.length]} castShadow={castShadow} receiveShadow />;
}

const center = (a, b) => (a + b) / 2;

// ---------- Devorlar: tashqi — oq devor, ichki — shisha to'siq ----------
function Walls() {
  return wallSegments.map((s, i) => {
    const len = s.b - s.a + 1;
    const [x, z] = s.dir === 'h' ? toWorld([center(s.a, s.b), s.at]) : toWorld([s.at, center(s.a, s.b)]);
    const h = s.outer ? 1.15 : 1.5;
    const t = s.outer ? 0.28 : 0.08;
    const size = s.dir === 'h' ? [len, t] : [t, len];
    if (s.outer) {
      return (
        <group key={i} position={[x, 0, z]}>
          <mesh position-y={h / 2} castShadow receiveShadow>
            <boxGeometry args={[size[0], h, size[1]]} />
            <meshStandardMaterial color={C.wall} roughness={0.9} />
          </mesh>
          <mesh position-y={h + 0.02}>
            <boxGeometry args={[size[0] + 0.01, 0.04, size[1] + 0.01]} />
            <meshStandardMaterial color={C.oak} roughness={0.6} />
          </mesh>
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
          return (
            <mesh key={k} position={s.dir === 'h' ? [off, h / 2, 0] : [0, h / 2, off]}>
              <boxGeometry args={[0.06, h, 0.1]} />
              <meshStandardMaterial color={C.frame} />
            </mesh>
          );
        })}
      </group>
    );
  });
}

// ---------- Pollar va gilamlar ----------
const RUGS = {
  manager: '#b9a48a', backend: '#8fa4b8', frontend: '#b29bbd', devops: '#8fae99', meeting: '#c4b394', lounge: '#c99a86',
};
function Floors() {
  const wood = useWoodTexture();
  const theme = useOffice((s) => (s.sky.lamps > 0.5 ? 'night' : 'day'));
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={0.001} receiveShadow>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial map={wood} roughness={0.55} />
      </mesh>
      {rooms.map((r) => {
        const w = r.x[1] - r.x[0] + 1, d = r.z[1] - r.z[0] + 1;
        const [cx, cz] = toWorld([center(r.x[0], r.x[1]), center(r.z[0], r.z[1])]);
        if (r.id === 'corridor') {
          return (
            <mesh key={r.id} rotation-x={-Math.PI / 2} position={[cx, 0.003, cz]} receiveShadow>
              <planeGeometry args={[w, d - 2]} />
              <meshStandardMaterial color="#c8ccd1" roughness={0.35} metalness={0.05} />
            </mesh>
          );
        }
        return (
          <group key={r.id}>
            <RoundedBox args={[w - 2.4, 0.02, d - 2.4]} radius={0.01} position={[cx, 0.012, cz]} receiveShadow>
              <meshStandardMaterial color={RUGS[r.id]} roughness={1} />
            </RoundedBox>
            {r.name && (
              <Html position={[cx, 0.05, toWorld([0, r.z[1]])[1] + 0.25]} center distanceFactor={16} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
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
function Monitor({ x, rotY = 0, on, color, night }) {
  return (
    <group position={[x, 0, -0.22]} rotation-y={rotY}>
      <RoundedBox args={[0.66, 0.4, 0.03]} radius={0.012} position-y={1.12} castShadow>
        <meshStandardMaterial color={C.metal} roughness={0.4} />
      </RoundedBox>
      <mesh position={[0, 1.13, 0.017]}>
        <planeGeometry args={[0.62, 0.35]} />
        <meshStandardMaterial
          color={on ? color : night ? '#1a2a44' : C.screenOff}
          emissive={on ? color : night ? '#1a2a44' : '#000'}
          emissiveIntensity={on ? 1.1 : night ? 0.4 : 0}
          roughness={0.2}
        />
      </mesh>
      <mesh position={[0, 0.88, -0.02]}><boxGeometry args={[0.04, 0.24, 0.04]} /><meshStandardMaterial color="#9aa0a8" metalness={0.7} roughness={0.3} /></mesh>
      <mesh position={[0, 0.775, -0.02]}><boxGeometry args={[0.22, 0.012, 0.14]} /><meshStandardMaterial color="#9aa0a8" metalness={0.7} roughness={0.3} /></mesh>
    </group>
  );
}

function OfficeChair() {
  return (
    <group>
      <RoundedBox args={[0.56, 0.09, 0.52]} radius={0.04} position-y={0.48} castShadow>
        <meshStandardMaterial color={C.chair} roughness={0.8} />
      </RoundedBox>
      <RoundedBox args={[0.52, 0.62, 0.07]} radius={0.04} position={[0, 0.86, 0.27]} rotation-x={-0.12} castShadow>
        <meshStandardMaterial color={C.chair} roughness={0.8} />
      </RoundedBox>
      <mesh position-y={0.25}><cylinderGeometry args={[0.035, 0.035, 0.42, 10]} /><meshStandardMaterial color="#9aa0a8" metalness={0.8} roughness={0.3} /></mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[Math.sin((i / 5) * Math.PI * 2) * 0.17, 0.05, Math.cos((i / 5) * Math.PI * 2) * 0.17]} rotation-y={(i / 5) * Math.PI * 2}>
          <boxGeometry args={[0.04, 0.03, 0.34]} />
          <meshStandardMaterial color={C.metal} />
        </mesh>
      ))}
    </group>
  );
}

function Desk({ id, desk, seat }) {
  const owner = useOffice((s) => Object.values(s.agents).find((a) => a.deskId === id));
  const night = useOffice((s) => s.sky.lamps > 0.5);
  const on = !!owner && (owner.state === 'working' || owner.state === 'panic');
  const [x, z] = toWorld(desk);
  const [sx, sz] = toWorld(seat);
  const accent = owner?.state === 'panic' ? '#ff2d3a' : owner?.color ?? '#7a8494';
  return (
    <group>
      <group position={[x, 0, z]}>
        <RoundedBox args={[1.7, 0.05, 0.85]} radius={0.02} position-y={0.75} castShadow receiveShadow>
          <meshStandardMaterial color={C.deskTop} roughness={0.35} />
        </RoundedBox>
        {[-0.78, 0.78].map((lx) => (
          <mesh key={lx} position={[lx, 0.37, 0]} castShadow>
            <boxGeometry args={[0.05, 0.74, 0.72]} />
            <meshStandardMaterial color={C.metal} roughness={0.5} />
          </mesh>
        ))}
        <Monitor x={-0.34} rotY={0.12} on={on} color={accent} night={night} />
        <Monitor x={0.34} rotY={-0.12} on={on} color={accent} night={night} />
        <RoundedBox args={[0.46, 0.018, 0.15]} radius={0.006} position={[0, 0.785, 0.16]}>
          <meshStandardMaterial color="#e4e6ea" />
        </RoundedBox>
        <mesh position={[0.36, 0.782, 0.18]}><boxGeometry args={[0.08, 0.02, 0.12]} /><meshStandardMaterial color="#e4e6ea" /></mesh>
        {/* stol chirog'i */}
        <group position={[-0.72, 0.775, -0.25]}>
          <mesh position-y={0.2}><cylinderGeometry args={[0.012, 0.012, 0.4, 6]} /><meshStandardMaterial color={C.metal} /></mesh>
          <mesh position={[0.08, 0.4, 0.05]} rotation-z={-0.5}>
            <coneGeometry args={[0.07, 0.1, 16, 1, true]} />
            <meshStandardMaterial color={C.metal} emissive={night ? '#ffd9a0' : '#000'} emissiveIntensity={night ? 1.5 : 0} side={THREE.DoubleSide} />
          </mesh>
        </group>
        {/* krujka */}
        <mesh position={[0.68, 0.82, 0.05]}><cylinderGeometry args={[0.04, 0.035, 0.09, 12]} /><meshStandardMaterial color={accent} /></mesh>
      </group>
      <group position={[sx, 0, sz]}>
        <OfficeChair />
      </group>
    </group>
  );
}

// ---------- Majlis xonasi ----------
function Meeting() {
  const night = useOffice((s) => s.sky.lamps > 0.5);
  const [x, z] = toWorld([center(...meetingTable.x), center(...meetingTable.z)]);
  const [, wallZ] = toWorld([0, 13]);
  return (
    <group>
      <RoundedBox args={[5.4, 0.07, 2.1]} radius={0.03} position={[x, 0.75, z]} castShadow receiveShadow>
        <meshStandardMaterial color={C.oak} roughness={0.45} />
      </RoundedBox>
      {[-2, 2].map((lx) => (
        <mesh key={lx} position={[x + lx, 0.37, z]} castShadow><boxGeometry args={[0.08, 0.74, 1.6]} /><meshStandardMaterial color={C.metal} /></mesh>
      ))}
      {meetingSeats.map((s, i) => {
        const [sx, sz] = toWorld(s);
        const back = s[1] < meetingTable.z[0] ? -1 : 1;
        return (
          <group key={i} position={[sx, 0, sz]}>
            <RoundedBox args={[0.5, 0.1, 0.48]} radius={0.05} position-y={0.47} castShadow>
              <meshStandardMaterial color="#d97a4a" roughness={0.85} />
            </RoundedBox>
            <RoundedBox args={[0.48, 0.42, 0.07]} radius={0.04} position={[0, 0.74, back * 0.24]} castShadow>
              <meshStandardMaterial color="#d97a4a" roughness={0.85} />
            </RoundedBox>
            <mesh position-y={0.22}><cylinderGeometry args={[0.03, 0.12, 0.44, 10]} /><meshStandardMaterial color={C.metal} /></mesh>
          </group>
        );
      })}
      {/* devordagi ekran */}
      <group position={[x, 0, wallZ + 0.12]}>
        <RoundedBox args={[2.6, 1.0, 0.06]} radius={0.02} position-y={0.95} castShadow>
          <meshStandardMaterial color={C.metal} />
        </RoundedBox>
        <mesh position={[0, 0.95, 0.032]}>
          <planeGeometry args={[2.48, 0.88]} />
          <meshStandardMaterial color="#2b5cab" emissive="#3a72d6" emissiveIntensity={night ? 1.2 : 0.55} />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[-0.8 + i * 0.5, 0.78 + (i % 2) * 0.12, 0.035]}>
            <planeGeometry args={[0.32, 0.3 + (i % 3) * 0.12]} />
            <meshBasicMaterial color="#9ecbff" transparent opacity={0.7} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ---------- Dam olish xonasi ----------
function Lounge() {
  const night = useOffice((s) => s.sky.lamps > 0.5);
  const [x, z] = toWorld([center(...couch.x), couch.z]);
  const [kx, kz] = toWorld(coffee);
  const [tx, tz] = toWorld([center(...coffeeTable.x), coffeeTable.z]);
  const [tvx] = toWorld([W - 1, 0]);
  const [, tvz] = toWorld([0, 16.5]);
  return (
    <group>
      {/* divan */}
      <group position={[x, 0, z + 0.1]}>
        <RoundedBox args={[5, 0.32, 0.95]} radius={0.08} position-y={0.24} castShadow receiveShadow>
          <meshStandardMaterial color="#56606e" roughness={0.95} />
        </RoundedBox>
        <RoundedBox args={[5, 0.55, 0.25]} radius={0.1} position={[0, 0.6, 0.36]} castShadow>
          <meshStandardMaterial color="#56606e" roughness={0.95} />
        </RoundedBox>
        {[-2.45, 2.45].map((ax) => (
          <RoundedBox key={ax} args={[0.22, 0.5, 0.95]} radius={0.08} position={[ax, 0.38, 0]} castShadow>
            <meshStandardMaterial color="#4a5260" roughness={0.95} />
          </RoundedBox>
        ))}
        {[-1.6, -0.55, 0.55, 1.6].map((cx, i) => (
          <RoundedBox key={cx} args={[0.95, 0.14, 0.72]} radius={0.06} position={[cx, 0.46, -0.08]} castShadow>
            <meshStandardMaterial color={i % 2 ? '#e0a03a' : '#6b7685'} roughness={0.95} />
          </RoundedBox>
        ))}
      </group>
      {/* stolcha */}
      <group position={[tx, 0, tz]}>
        <mesh position-y={0.38} castShadow receiveShadow><cylinderGeometry args={[0.75, 0.75, 0.05, 40]} /><meshStandardMaterial color={C.oak} roughness={0.4} /></mesh>
        <mesh position-y={0.18}><cylinderGeometry args={[0.06, 0.25, 0.36, 16]} /><meshStandardMaterial color={C.metal} /></mesh>
        <mesh position={[0.2, 0.44, 0.05]}><cylinderGeometry args={[0.05, 0.04, 0.08, 12]} /><meshStandardMaterial color="#ffffff" /></mesh>
        <mesh position={[-0.25, 0.43, -0.1]} rotation-y={0.4}><boxGeometry args={[0.3, 0.04, 0.22]} /><meshStandardMaterial color="#d9534f" /></mesh>
      </group>
      {/* bean bag'lar */}
      {beanBags.map((b, i) => {
        const [bx, bz] = toWorld(b);
        return (
          <mesh key={i} position={[bx, 0.25, bz]} scale={[1, 0.62, 1]} castShadow>
            <sphereGeometry args={[0.42, 24, 18]} />
            <meshStandardMaterial color={i ? '#3f8f7a' : '#c0574b'} roughness={1} />
          </mesh>
        );
      })}
      {/* devordagi TV */}
      <group position={[tvx - 0.18, 0, tvz]} rotation-y={-Math.PI / 2}>
        <RoundedBox args={[1.9, 0.95, 0.05]} radius={0.015} position-y={0.95} castShadow>
          <meshStandardMaterial color={C.metal} />
        </RoundedBox>
        <mesh position={[0, 0.95, 0.027]}>
          <planeGeometry args={[1.82, 0.87]} />
          <meshStandardMaterial color="#1d3b2f" emissive="#2f9e64" emissiveIntensity={night ? 0.8 : 0.35} />
        </mesh>
      </group>
      {/* qahva burchagi */}
      <group position={[kx, 0, kz]}>
        <RoundedBox args={[0.95, 0.9, 0.7]} radius={0.03} position-y={0.45} castShadow>
          <meshStandardMaterial color="#f2f2f0" roughness={0.4} />
        </RoundedBox>
        <RoundedBox args={[0.97, 0.04, 0.72]} radius={0.01} position-y={0.92}>
          <meshStandardMaterial color={C.oak} />
        </RoundedBox>
        <RoundedBox args={[0.38, 0.42, 0.34]} radius={0.04} position={[0, 1.15, -0.05]} castShadow>
          <meshStandardMaterial color="#2a2e36" metalness={0.3} roughness={0.4} />
        </RoundedBox>
        <mesh position={[0, 1.24, 0.123]}><planeGeometry args={[0.2, 0.08]} /><meshStandardMaterial color="#5ee0a0" emissive="#5ee0a0" emissiveIntensity={0.9} /></mesh>
      </group>
    </group>
  );
}

// ---------- Dekor ----------
function Bookshelf() {
  const [x, z] = toWorld([center(...bookshelf.x), bookshelf.z]);
  const books = useMemo(() => {
    const cols = ['#d9534f', '#3b82c4', '#e0a03a', '#2f9e64', '#6f42c1', '#f2f2f0', '#2b2f36'];
    const out = [];
    for (let shelf = 0; shelf < 3; shelf++) {
      let bx = -0.85;
      while (bx < 0.8) {
        const w = 0.06 + Math.random() * 0.06, h = 0.22 + Math.random() * 0.1;
        if (Math.random() > 0.12) out.push({ x: bx + w / 2, y: 0.25 + shelf * 0.42 + h / 2, w, h, c: cols[Math.floor(Math.random() * cols.length)] });
        bx += w + 0.01;
      }
    }
    return out;
  }, []);
  return (
    <group position={[x, 0, z + 0.05]}>
      <mesh position-y={0.7} castShadow><boxGeometry args={[1.9, 1.4, 0.4]} /><meshStandardMaterial color={C.oak} /></mesh>
      <mesh position={[0, 0.72, 0.03]}><boxGeometry args={[1.8, 1.3, 0.38]} /><meshStandardMaterial color="#efe8de" /></mesh>
      {[0, 1, 2].map((s) => <mesh key={s} position={[0, 0.24 + s * 0.42, 0.04]}><boxGeometry args={[1.8, 0.03, 0.38]} /><meshStandardMaterial color={C.oak} /></mesh>)}
      {books.map((b, i) => <mesh key={i} position={[b.x, b.y, 0.06]}><boxGeometry args={[b.w, b.h, 0.26]} /><meshStandardMaterial color={b.c} /></mesh>)}
    </group>
  );
}

function ServerRack() {
  const [x, z] = toWorld([center(...serverRack.x), serverRack.z]);
  const leds = useRef([]);
  const siren = useRef();
  const alert = useOffice((s) => Object.values(s.services).some((sv) => BAD.has(sv.state)) || Object.values(s.agents).some((a) => a.state === 'panic'));
  const green = useMemo(() => new THREE.Color('#4cc38a'), []);
  const red = useMemo(() => new THREE.Color('#ff2d3a'), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    leds.current.forEach((m, i) => {
      if (!m) return;
      m.color.copy(alert ? red : green);
      m.emissive.copy(alert ? red : green);
      m.emissiveIntensity = Math.sin(t * (alert ? 14 : 3 + (i % 5)) + i) > 0.2 ? 2.2 : 0.2;
    });
    if (siren.current) {
      siren.current.rotation.y = t * 8;
      siren.current.children[0].material.emissiveIntensity = alert ? 2 + Math.sin(t * 16) * 1.5 : 0.05;
    }
  });
  return (
    <group position={[x, 0, z + 0.05]}>
      <group ref={siren} position={[0, 2.0, 0.1]}>
        <mesh><cylinderGeometry args={[0.1, 0.12, 0.16, 16]} /><meshStandardMaterial color="#ff3b3b" emissive="#ff1a1a" emissiveIntensity={0.05} transparent opacity={0.9} /></mesh>
        <mesh position-y={-0.1}><cylinderGeometry args={[0.13, 0.13, 0.04, 16]} /><meshStandardMaterial color="#2b2f36" /></mesh>
      </group>
      {[-0.45, 0.45].map((rx, r) => (
        <group key={rx} position-x={rx}>
          <RoundedBox args={[0.8, 1.9, 0.75]} radius={0.03} position-y={0.95} castShadow>
            <meshStandardMaterial color="#16191f" roughness={0.5} metalness={0.4} />
          </RoundedBox>
          {Array.from({ length: 8 }).map((_, i) => (
            <group key={i} position={[0, 0.3 + i * 0.2, 0.38]}>
              <mesh><boxGeometry args={[0.68, 0.14, 0.01]} /><meshStandardMaterial color="#262b33" /></mesh>
              <mesh position={[0.26, 0, 0.008]}>
                <boxGeometry args={[0.04, 0.03, 0.01]} />
                <meshStandardMaterial ref={(m) => (leds.current[r * 8 + i] = m)} color="#4cc38a" emissive="#4cc38a" emissiveIntensity={1} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

// Orqa devordagi stikerli doska (backend va frontend xonalari)
function StickyBoard({ cellX }) {
  const [x, z] = toWorld([cellX, 0]);
  const notes = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    x: -0.75 + (i % 6) * 0.3 + (Math.random() - 0.5) * 0.05,
    y: 0.95 + Math.floor(i / 6) * -0.28 + 0.12,
    c: ['#ffe066', '#ff9f9f', '#9fe2bf', '#a0c4ff'][i % 4],
    r: (Math.random() - 0.5) * 0.15,
    show: i < 4 || Math.random() > 0.15,
  })), []);
  return (
    <group position={[x, 0, z + 0.16]}>
      <mesh position-y={0.85}><boxGeometry args={[2, 0.8, 0.03]} /><meshStandardMaterial color="#ffffff" roughness={0.3} /></mesh>
      {notes.filter((n) => n.show).map((n, i) => (
        <mesh key={i} position={[n.x, n.y, 0.02]} rotation-z={n.r}><planeGeometry args={[0.2, 0.2]} /><meshStandardMaterial color={n.c} /></mesh>
      ))}
    </group>
  );
}

function Plants() {
  const pot = useMemo(() => new THREE.CylinderGeometry(0.22, 0.18, 0.5, 20), []);
  const potMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f2f0ec', roughness: 0.5 }), []);
  const leaf = useMemo(() => new THREE.IcosahedronGeometry(0.34, 1), []);
  const leafMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4f9a5b', flatShading: true, roughness: 0.8 }), []);
  const leaf2Mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3a7d48', flatShading: true, roughness: 0.8 }), []);
  return (
    <>
      <Instanced cells={plants} geometry={pot} material={potMat} y={0.25} />
      <Instanced cells={plants} geometry={leaf} material={leafMat} y={0.85} scale={[1, 1.5, 1]} />
      <Instanced cells={plants} geometry={leaf} material={leaf2Mat} y={1.3} scale={[0.7, 1.1, 0.7]} />
    </>
  );
}

function RoomLights() {
  const lamps = useOffice((s) => Math.round(s.sky.lamps * 20) / 20);
  if (lamps < 0.05) return null;
  return rooms.map((r) => {
    const [cx, cz] = toWorld([center(r.x[0], r.x[1]), center(r.z[0], r.z[1])]);
    return <pointLight key={r.id} position={[cx, 3.4, cz]} intensity={(r.id === 'corridor' ? 5 : 9) * lamps} distance={10} decay={1.6} color="#ffd9a8" />;
  });
}

function GroundMat() {
  const ground = useOffice((s) => s.sky.ground);
  return <meshStandardMaterial color={ground} roughness={1} />;
}

export default function Office() {
  return (
    <group>
      <RoomLights />
      <Windows />
      <Details />
      {/* ofis turgan plita: atrofida osmon gradienti ko'rinadi */}
      <RoundedBox args={[W + 3, 0.6, H + 3]} radius={0.25} position-y={-0.31} receiveShadow>
        <GroundMat />
      </RoundedBox>
      <Floors />
      <Walls />
      {Object.entries(desks).map(([id, d]) => <Desk key={id} id={id} {...d} />)}
      <Meeting />
      <Lounge />
      <Bookshelf />
      <ServerRack />
      <StickyBoard cellX={16} />
      <StickyBoard cellX={26} />
      <Plants />
    </group>
  );
}
