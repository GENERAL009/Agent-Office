// Odam modeli va uning animatsiyalari (agentlar ham, boshliq ham shundan foydalanadi).
// pose.current = { mode, moving } — ota komponent har kadrda yangilab turadi.
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

const SKINS = ['#f1c9a5', '#e8b98f', '#d9a179', '#f3d0b0', '#c68c5f', '#e2b08a'];
const HAIRS = ['#2b211b', '#4a3222', '#1b1b1f', '#a5683a', '#6b4a2f', '#d9b26f'];
const PANTS = ['#3a4252', '#2c3242', '#384035', '#2b2f36', '#45403a'];
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function lookFor(id) {
  const fixed = {
    manager: { skin: '#e8b98f', hair: '#2b211b', pants: '#2b2f36', trim: '#f4f4f4' },
    backend: { skin: '#f1c9a5', hair: '#4a3222', pants: '#3a4252', trim: '#dbe7f5' },
    frontend: { skin: '#d9a179', hair: '#1b1b1f', pants: '#2c3242', trim: '#f3e2f7' },
    devops: { skin: '#f3d0b0', hair: '#a5683a', pants: '#384035', trim: '#dff2e6' },
  };
  if (fixed[id]) return fixed[id];
  const h = hash(id);
  return { skin: SKINS[h % SKINS.length], hair: HAIRS[(h >> 3) % HAIRS.length], pants: PANTS[(h >> 6) % PANTS.length], trim: '#eef2f6' };
}

export default function Person({ color, look, pose, headset = true, tie = false, boss = false }) {
  const body = useRef();
  const head = useRef();
  const armL = useRef();
  const armR = useRef();
  const legL = useRef();
  const legR = useRef();

  useFrame(() => {
    if (!body.current) return;
    const t = performance.now() / 1000;
    const { mode = 'idle', moving = false, run = false } = pose.current || {};
    const f = run ? 14 : 10;
    const swing = moving ? Math.sin(t * f) * (run ? 0.85 : 0.6) : 0;
    const panic = mode === 'panic';
    const down = mode === 'down';
    const seated = mode === 'working' || down || mode === 'sit';

    if (panic) {
      body.current.position.y = 0.78 + Math.abs(Math.sin(t * 9)) * 0.22;
      legL.current.rotation.x = Math.sin(t * 18) * 0.5;
      legR.current.rotation.x = -Math.sin(t * 18) * 0.5;
      armL.current.rotation.x = Math.PI - 0.3 + Math.sin(t * 20) * 0.5;
      armR.current.rotation.x = Math.PI - 0.3 + Math.sin(t * 20 + 2) * 0.5;
      head.current.rotation.x = Math.sin(t * 25) * 0.15;
      head.current.rotation.z = 0;
      return;
    }
    body.current.position.y = down ? 0.5 : seated ? 0.62 : 0.78 + (moving ? Math.abs(Math.sin(t * f)) * 0.05 : 0);
    legL.current.rotation.x = seated ? -1.4 : swing;
    legR.current.rotation.x = seated ? -1.4 : -swing;
    if (mode === 'working') {
      armL.current.rotation.x = -1.1 + Math.sin(t * 18) * 0.12;
      armR.current.rotation.x = -1.1 + Math.sin(t * 18 + 1.7) * 0.12;
    } else if (mode === 'talking' || mode === 'wave') {
      armL.current.rotation.x = 0;
      armR.current.rotation.x = mode === 'wave' ? Math.PI - 0.4 + Math.sin(t * 10) * 0.3 : -0.6 + Math.sin(t * 4) * 0.4;
    } else if (down) {
      armL.current.rotation.x = -0.5;
      armR.current.rotation.x = -0.5;
    } else {
      armL.current.rotation.x = -swing;
      armR.current.rotation.x = swing;
    }
    head.current.rotation.x = mode === 'talking' ? Math.sin(t * 6) * 0.12 : down ? 0.45 : 0;
    head.current.rotation.z = mode === 'thinking' ? Math.sin(t * 1.5) * 0.15 : down ? Math.sin(t * 0.8) * 0.1 : 0;
  });

  const torso = boss ? '#1e2533' : color;
  return (
    <group ref={body} position-y={0.78}>
      <mesh castShadow position-y={0.12}>
        <capsuleGeometry args={[0.22, 0.3, 6, 16]} />
        <meshStandardMaterial color={torso} roughness={boss ? 0.5 : 0.75} />
      </mesh>
      {boss ? (
        <>
          {/* oq ko'ylak, qizil galstuk, oltin nishon */}
          <mesh position={[0, 0.28, 0.19]} rotation-x={-0.25}><planeGeometry args={[0.16, 0.22]} /><meshStandardMaterial color="#f4f4f4" /></mesh>
          <mesh position={[0, 0.2, 0.215]} rotation-x={-0.2}><boxGeometry args={[0.05, 0.24, 0.02]} /><meshStandardMaterial color="#c8121e" /></mesh>
          <mesh position={[0.13, 0.3, 0.17]}><circleGeometry args={[0.035, 16]} /><meshStandardMaterial color="#e0b44a" metalness={0.8} roughness={0.25} /></mesh>
        </>
      ) : (
        <mesh position-y={0.4} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.13, 0.035, 8, 20]} />
          <meshStandardMaterial color={look.trim} roughness={0.8} />
        </mesh>
      )}
      {tie && <mesh position={[0, 0.22, 0.2]}><boxGeometry args={[0.06, 0.26, 0.02]} /><meshStandardMaterial color="#2b2f36" /></mesh>}
      <group ref={head} position-y={0.66}>
        <mesh castShadow><sphereGeometry args={[0.21, 24, 18]} /><meshStandardMaterial color={look.skin} roughness={0.7} /></mesh>
        <mesh position={[0, 0.05, -0.02]} scale={[1.05, 0.9, 1.05]}>
          <sphereGeometry args={[0.21, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={look.hair} roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.02, -0.09]} scale={[1, 0.95, 0.7]}><sphereGeometry args={[0.2, 16, 12]} /><meshStandardMaterial color={look.hair} roughness={0.9} /></mesh>
        <mesh position={[0.075, 0.0, 0.19]}><sphereGeometry args={[0.025, 8, 8]} /><meshBasicMaterial color="#1b1d22" /></mesh>
        <mesh position={[-0.075, 0.0, 0.19]}><sphereGeometry args={[0.025, 8, 8]} /><meshBasicMaterial color="#1b1d22" /></mesh>
        <mesh position={[0, -0.08, 0.185]} rotation-z={Math.PI}><torusGeometry args={[0.04, 0.008, 6, 12, Math.PI]} /><meshBasicMaterial color="#6b3b2a" /></mesh>
        {boss && (
          <group position={[0, 0.01, 0.2]}>
            {[0.075, -0.075].map((gx) => <mesh key={gx} position-x={gx}><torusGeometry args={[0.045, 0.008, 6, 16]} /><meshStandardMaterial color="#111" /></mesh>)}
            <mesh><boxGeometry args={[0.06, 0.008, 0.008]} /><meshStandardMaterial color="#111" /></mesh>
          </group>
        )}
        {headset && (
          <group>
            <mesh position-y={0.02}><torusGeometry args={[0.225, 0.018, 8, 24, Math.PI]} /><meshStandardMaterial color="#1f232a" /></mesh>
            {[0.22, -0.22].map((hx) => (
              <mesh key={hx} position={[hx, 0, 0]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.07, 0.07, 0.05, 16]} /><meshStandardMaterial color="#1f232a" /></mesh>
            ))}
          </group>
        )}
      </group>
      <group ref={armL} position={[0.29, 0.3, 0]}>
        <mesh castShadow position-y={-0.18}><capsuleGeometry args={[0.065, 0.24, 4, 10]} /><meshStandardMaterial color={torso} roughness={0.75} /></mesh>
        <mesh position-y={-0.38}><sphereGeometry args={[0.06, 10, 8]} /><meshStandardMaterial color={look.skin} /></mesh>
      </group>
      <group ref={armR} position={[-0.29, 0.3, 0]}>
        <mesh castShadow position-y={-0.18}><capsuleGeometry args={[0.065, 0.24, 4, 10]} /><meshStandardMaterial color={torso} roughness={0.75} /></mesh>
        <mesh position-y={-0.38}><sphereGeometry args={[0.06, 10, 8]} /><meshStandardMaterial color={look.skin} /></mesh>
      </group>
      {[[legL, 0.1], [legR, -0.1]].map(([ref, lx]) => (
        <group key={lx} ref={ref} position={[lx, -0.16, 0]}>
          <mesh castShadow position-y={-0.24}><capsuleGeometry args={[0.075, 0.34, 4, 10]} /><meshStandardMaterial color={boss ? '#1e2533' : look.pants} roughness={0.8} /></mesh>
          <mesh position={[0, -0.47, 0.05]}><boxGeometry args={[0.13, 0.08, 0.24]} /><meshStandardMaterial color={boss ? '#111' : '#f4f4f4'} /></mesh>
        </group>
      ))}
    </group>
  );
}
