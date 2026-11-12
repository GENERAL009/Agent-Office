import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useOffice, positions } from './store.js';
import Person, { lookFor } from './Person.jsx';

const SPEED = 2.6; // katak/sekund
export const STATE_UZ = {
  idle: 'bo‘sh', walking: 'yurmoqda', working: 'ishlamoqda', talking: 'gaplashmoqda', thinking: 'o‘ylamoqda',
  panic: 'XATO!', down: 'ishlamayapti',
};

export default function Agent({ id }) {
  const a = useOffice((s) => s.agents[id]);
  const selected = useOffice((s) => s.selected === id);
  const select = useOffice((s) => s.select);
  const arrived = useOffice((s) => s.arrived);
  const toWorld = useOffice((s) => s.layout.toWorld);
  const lowLight = useOffice((s) => s.sky.lamps > 0.5);
  const boss = useOffice((s) => s.boss);

  const root = useRef();
  const ring = useRef();
  const alarmLight = useRef();
  const pose = useRef({ mode: 'idle', moving: false });
  const step = useRef({ pathId: -1, i: 0 });

  const [, force] = useState(0);
  useEffect(() => {
    if (!a?.bubble) return;
    const ms = a.bubbleUntil - Date.now();
    if (ms <= 0) return;
    const t = setTimeout(() => force((n) => n + 1), ms + 20);
    return () => clearTimeout(t);
  }, [a?.bubble, a?.bubbleUntil]);

  useFrame((_, dtRaw) => {
    if (!a || !root.current) return;
    const dt = Math.min(dtRaw, 0.5);
    const t = performance.now() / 1000;
    const pos = positions[id];
    if (!pos) return;
    const st = step.current;
    if (st.pathId !== a.pathId) { st.pathId = a.pathId; st.i = 0; }

    let moving = false;
    if (a.state === 'walking' && a.path.length && st.i < a.path.length) {
      let budget = SPEED * dt;
      while (budget > 0 && st.i < a.path.length) {
        const target = a.path[st.i];
        const dx = target[0] - pos.x, dz = target[1] - pos.z;
        const d = Math.hypot(dx, dz);
        if (d <= budget) { pos.x = target[0]; pos.z = target[1]; st.i++; budget -= d; }
        else {
          pos.x += (dx / d) * budget; pos.z += (dz / d) * budget; budget = 0;
          let diff = Math.atan2(dx, dz) - pos.rot;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          pos.rot += diff * Math.min(1, dt * 12);
          moving = true;
        }
      }
      if (st.i >= a.path.length) {
        if (a.after?.face === 'desk') pos.rot = Math.PI;
        arrived(id);
      }
    }

    const [wx, wz] = toWorld([pos.x, pos.z]);
    root.current.position.set(wx, 0, wz);
    root.current.rotation.y = pos.rot;
    const panic = a.state === 'panic';
    const down = a.state === 'down';
    if (panic) {
      root.current.rotation.y = pos.rot + Math.sin(t * 23) * 0.25;
      root.current.position.x += Math.sin(t * 31) * 0.04;
    }
    let mode = a.state === 'walking' ? 'idle' : a.state;
    if (a.state === 'thinking' && id === 'manager') mode = 'working';
    if (pos.waveUntil && pos.waveUntil > Date.now() && !panic && !down && !moving) mode = 'wave';
    pose.current.mode = mode;
    pose.current.moving = moving;

    if (ring.current) {
      ring.current.visible = panic || down;
      ring.current.material.opacity = panic ? 0.5 + 0.5 * Math.sin(t * 12) : 0.6 + 0.2 * Math.sin(t * 3);
      ring.current.scale.setScalar(panic ? 1 + 0.35 * (0.5 + 0.5 * Math.sin(t * 6)) : 1);
    }
    if (alarmLight.current) {
      alarmLight.current.intensity = panic ? (Math.sin(t * 12) > 0 ? 6 : 1) * (lowLight ? 1.2 : 2) : down ? 1.2 : 0;
    }
  });

  if (!a) return null;
  const showBubble = a.bubble && a.bubbleUntil > Date.now();
  const bad = a.state === 'panic' || a.state === 'down';

  return (
    <group ref={root} onClick={(e) => { e.stopPropagation(); select(id); }}>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.025} visible={false}>
        <ringGeometry args={[0.5, 0.72, 48]} />
        <meshBasicMaterial color="#ff2d3a" transparent opacity={0.8} depthWrite={false} toneMapped={false} />
      </mesh>
      <pointLight ref={alarmLight} position={[0, 2.2, 0]} color="#ff2a2a" intensity={0} distance={5} decay={1.4} />
      {selected && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
          <ringGeometry args={[0.42, 0.52, 48]} />
          <meshBasicMaterial color={a.color} transparent opacity={0.9} />
        </mesh>
      )}
      <Person color={a.color} look={lookFor(id)} pose={pose} headset={id !== 'manager'} tie={id === 'manager'} />
      <Html position={[0, 2.05, 0]} center distanceFactor={boss ? 6 : 15} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <div className="tag-wrap">
          {showBubble && <div className={`bubble ${a.bubbleKind}`}>{a.bubble}</div>}
          <div className={`tag ${bad ? 'bad' : ''}`}>
            <span className="dot" style={{ background: a.color }} />
            {a.name}
            <span className="tag-state">· {STATE_UZ[a.state] ?? a.state}</span>
            {a.errors > 0 && <span className="tag-err">{a.errors}</span>}
          </div>
        </div>
      </Html>
    </group>
  );
}
