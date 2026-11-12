import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useOffice, positions } from './store.js';
import { toWorld } from './layout.js';

const LOOKS = {
  manager: { skin: '#e8b98f', hair: '#2b211b', pants: '#2b2f36', trim: '#f4f4f4' },
  backend: { skin: '#f1c9a5', hair: '#4a3222', pants: '#3a4252', trim: '#dbe7f5' },
  frontend: { skin: '#d9a179', hair: '#1b1b1f', pants: '#2c3242', trim: '#f3e2f7' },
  devops: { skin: '#f3d0b0', hair: '#a5683a', pants: '#384035', trim: '#dff2e6' },
  default: { skin: '#e8c09a', hair: '#3a2a20', pants: '#2c3242', trim: '#eeeeee' },
};
const SPEED = 2.6; // katak/sekund
const STATE_UZ = {
  idle: 'bo‘sh', walking: 'yurmoqda', working: 'ishlamoqda', talking: 'gaplashmoqda', thinking: 'o‘ylamoqda',
  panic: 'XATO!', down: 'ishlamayapti',
};

export default function Agent({ id }) {
  const a = useOffice((s) => s.agents[id]);
  const selected = useOffice((s) => s.selected === id);
  const select = useOffice((s) => s.select);
  const arrived = useOffice((s) => s.arrived);

  const root = useRef();
  const body = useRef();
  const head = useRef();
  const armL = useRef();
  const armR = useRef();
  const legL = useRef();
  const legR = useRef();
  const step = useRef({ pathId: -1, i: 0 });
  const ring = useRef();
  const alarmLight = useRef();
  const lowLight = useOffice((s) => s.sky.lamps > 0.5);

  // Pufakcha muddati tugaganda yashirish
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
    const dt = Math.min(dtRaw, 0.5); // past FPS'da ham vaqtga mos yuradi
    const t = performance.now() / 1000;
    const pos = positions[id];
    const st = step.current;
    if (st.pathId !== a.pathId) { st.pathId = a.pathId; st.i = 0; }

    // Yo'l bo'ylab yurish (bir kadrda bir nechta katak o'tishi mumkin)
    let moving = false;
    if (a.state === 'walking' && a.path.length && st.i < a.path.length) {
      let budget = SPEED * dt;
      while (budget > 0 && st.i < a.path.length) {
        const target = a.path[st.i];
        const dx = target[0] - pos.x, dz = target[1] - pos.z;
        const d = Math.hypot(dx, dz);
        if (d <= budget) {
          pos.x = target[0]; pos.z = target[1]; st.i++; budget -= d;
        } else {
          pos.x += (dx / d) * budget; pos.z += (dz / d) * budget; budget = 0;
          const want = Math.atan2(dx, dz);
          let diff = want - pos.rot;
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

    // Animatsiyalar
    const panic = a.state === 'panic';
    const down = a.state === 'down';
    const seated = a.state === 'working' || down || (a.state === 'thinking' && id === 'manager');
    const swing = moving ? Math.sin(t * 10) * 0.6 : 0;
    if (panic) {
      // vahima: sakraydi, titraydi, qo'llarini silkitadi
      const hop = Math.abs(Math.sin(t * 9)) * 0.22;
      body.current.position.y = 0.78 + hop;
      root.current.rotation.y = pos.rot + Math.sin(t * 23) * 0.25;
      root.current.position.x += Math.sin(t * 31) * 0.04;
      legL.current.rotation.x = Math.sin(t * 18) * 0.5;
      legR.current.rotation.x = -Math.sin(t * 18) * 0.5;
      armL.current.rotation.x = Math.PI - 0.3 + Math.sin(t * 20) * 0.5;
      armR.current.rotation.x = Math.PI - 0.3 + Math.sin(t * 20 + 2) * 0.5;
      head.current.rotation.x = Math.sin(t * 25) * 0.15;
      head.current.rotation.z = 0;
    } else {
      body.current.position.y = down ? 0.5 : seated ? 0.62 : 0.78 + (moving ? Math.abs(Math.sin(t * 10)) * 0.05 : 0);
      legL.current.rotation.x = seated ? -1.4 : swing;
      legR.current.rotation.x = seated ? -1.4 : -swing;
      if (a.state === 'working') {
        armL.current.rotation.x = -1.1 + Math.sin(t * 18) * 0.12;
        armR.current.rotation.x = -1.1 + Math.sin(t * 18 + 1.7) * 0.12;
      } else if (a.state === 'talking') {
        armL.current.rotation.x = 0;
        armR.current.rotation.x = -0.6 + Math.sin(t * 4) * 0.4;
      } else if (down) {
        armL.current.rotation.x = -0.5;
        armR.current.rotation.x = -0.5;
      } else {
        armL.current.rotation.x = -swing;
        armR.current.rotation.x = swing;
      }
      // ishlamay qolgan agent boshini egib, sekin chayqaladi
      head.current.rotation.x = a.state === 'talking' ? Math.sin(t * 6) * 0.12 : down ? 0.45 : 0;
      head.current.rotation.z = a.state === 'thinking' ? Math.sin(t * 1.5) * 0.15 : down ? Math.sin(t * 0.8) * 0.1 : 0;
    }
    // qizil halqa va chiroq
    const alert = panic || down;
    if (ring.current) {
      ring.current.visible = alert;
      const k = panic ? 0.5 + 0.5 * Math.sin(t * 12) : 0.6 + 0.2 * Math.sin(t * 3);
      ring.current.material.opacity = k;
      ring.current.scale.setScalar(panic ? 1 + 0.35 * (0.5 + 0.5 * Math.sin(t * 6)) : 1);
    }
    if (alarmLight.current) {
      alarmLight.current.intensity = panic ? (Math.sin(t * 12) > 0 ? 6 : 1) * (lowLight ? 1.2 : 2) : down ? 1.2 : 0;
    }
  });

  if (!a) return null;
  const showBubble = a.bubble && a.bubbleUntil > Date.now();
  const look = LOOKS[id] ?? LOOKS.default;

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
      <group ref={body} position-y={0.78}>
        {/* tana (xudi) */}
        <mesh castShadow position-y={0.12}>
          <capsuleGeometry args={[0.22, 0.3, 6, 16]} />
          <meshStandardMaterial color={a.color} roughness={0.75} />
        </mesh>
        <mesh position-y={0.4} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.13, 0.035, 8, 20]} />
          <meshStandardMaterial color={look.trim} roughness={0.8} />
        </mesh>
        {id === 'manager' && (
          <mesh position={[0, 0.22, 0.2]}><boxGeometry args={[0.06, 0.26, 0.02]} /><meshStandardMaterial color="#2b2f36" /></mesh>
        )}
        {/* bosh */}
        <group ref={head} position-y={0.66}>
          <mesh castShadow>
            <sphereGeometry args={[0.21, 24, 18]} />
            <meshStandardMaterial color={look.skin} roughness={0.7} />
          </mesh>
          {/* soch */}
          <mesh position={[0, 0.05, -0.02]} scale={[1.05, 0.9, 1.05]}>
            <sphereGeometry args={[0.21, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={look.hair} roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.02, -0.09]} scale={[1, 0.95, 0.7]}>
            <sphereGeometry args={[0.2, 16, 12]} />
            <meshStandardMaterial color={look.hair} roughness={0.9} />
          </mesh>
          <mesh position={[0.075, 0.0, 0.19]}><sphereGeometry args={[0.025, 8, 8]} /><meshBasicMaterial color="#1b1d22" /></mesh>
          <mesh position={[-0.075, 0.0, 0.19]}><sphereGeometry args={[0.025, 8, 8]} /><meshBasicMaterial color="#1b1d22" /></mesh>
          <mesh position={[0, -0.08, 0.185]} rotation-z={Math.PI}><torusGeometry args={[0.04, 0.008, 6, 12, Math.PI]} /><meshBasicMaterial color="#6b3b2a" /></mesh>
          {/* naushnik */}
          {id !== 'manager' && (
            <group>
              <mesh position-y={0.02}><torusGeometry args={[0.225, 0.018, 8, 24, Math.PI]} /><meshStandardMaterial color="#1f232a" /></mesh>
              {[0.22, -0.22].map((hx) => (
                <mesh key={hx} position={[hx, 0, 0]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.07, 0.07, 0.05, 16]} /><meshStandardMaterial color="#1f232a" /></mesh>
              ))}
            </group>
          )}
        </group>
        {/* qo'llar */}
        <group ref={armL} position={[0.29, 0.3, 0]}>
          <mesh castShadow position-y={-0.18}><capsuleGeometry args={[0.065, 0.24, 4, 10]} /><meshStandardMaterial color={a.color} roughness={0.75} /></mesh>
          <mesh position-y={-0.38}><sphereGeometry args={[0.06, 10, 8]} /><meshStandardMaterial color={look.skin} /></mesh>
        </group>
        <group ref={armR} position={[-0.29, 0.3, 0]}>
          <mesh castShadow position-y={-0.18}><capsuleGeometry args={[0.065, 0.24, 4, 10]} /><meshStandardMaterial color={a.color} roughness={0.75} /></mesh>
          <mesh position-y={-0.38}><sphereGeometry args={[0.06, 10, 8]} /><meshStandardMaterial color={look.skin} /></mesh>
        </group>
        {/* oyoqlar va krossovkalar */}
        <group ref={legL} position={[0.1, -0.16, 0]}>
          <mesh castShadow position-y={-0.24}><capsuleGeometry args={[0.075, 0.34, 4, 10]} /><meshStandardMaterial color={look.pants} roughness={0.8} /></mesh>
          <mesh position={[0, -0.47, 0.05]}><boxGeometry args={[0.13, 0.08, 0.24]} /><meshStandardMaterial color="#f4f4f4" /></mesh>
        </group>
        <group ref={legR} position={[-0.1, -0.16, 0]}>
          <mesh castShadow position-y={-0.24}><capsuleGeometry args={[0.075, 0.34, 4, 10]} /><meshStandardMaterial color={look.pants} roughness={0.8} /></mesh>
          <mesh position={[0, -0.47, 0.05]}><boxGeometry args={[0.13, 0.08, 0.24]} /><meshStandardMaterial color="#f4f4f4" /></mesh>
        </group>
      </group>

      <Html position={[0, 2.05, 0]} center distanceFactor={15} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <div className="tag-wrap">
          {showBubble && <div className={`bubble ${a.bubbleKind}`}>{a.bubble}</div>}
          <div className={`tag ${a.state === 'panic' || a.state === 'down' ? 'bad' : ''}`}>
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
