// A person in the office (agents and the boss share it). Stylised, big-head proportions so faces
// still read from the overview camera. pose.current = { mode, moving, run } is updated by the parent.
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { crewFor } from './crew.js';

export const lookFor = (id) => crewFor(id);

const HEAD_Y = 0.72;
// torso silhouette: hips → waist → chest → shoulders
const TORSO = new THREE.LatheGeometry(
  [[0, -0.09], [0.165, -0.088], [0.182, -0.04], [0.176, 0.06], [0.19, 0.18], [0.215, 0.3], [0.212, 0.37], [0.18, 0.425], [0.1, 0.46], [0, 0.465]]
    .map(([r, y]) => new THREE.Vector2(r, y)), 40,
);
const soften = (c, k = 0.16) => '#' + new THREE.Color(c).lerp(new THREE.Color('#f3efe9'), k).getHexString();
const HR = 0.25; // head radius

function Mat({ color, rough = 0.7, ...rest }) {
  return <meshStandardMaterial color={color} roughness={rough} {...rest} />;
}

function Hair({ look }) {
  const c = look.hair;
  const style = look.style ?? 'short';
  const curls = useMemo(() => {
    if (style !== 'curly') return [];
    const out = [];
    const N = 46, R = HR + 0.03;
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 1.05;          // upper part of a sphere
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const a = i * 2.39996;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (z > 0.55 && y < 0.55) continue;           // keep the face clear
      out.push([x * R, y * R + 0.02, z * R - 0.01]);
    }
    return out;
  }, [style]);
  const tight = style === 'buzz';
  return (
    <group>
      {/* cap: tilted back so the forehead shows */}
      <mesh castShadow rotation-x={-0.38} position={[0, 0.015, -0.005]}>
        <sphereGeometry args={[HR + (tight ? 0.008 : 0.016), 32, 16, 0, Math.PI * 2, 0, Math.PI * (tight ? 0.46 : 0.52)]} />
        <Mat color={c} rough={0.85} />
      </mesh>
      {(style === 'short' || style === 'side') && (
        <mesh position={[style === 'side' ? 0.05 : 0, 0.165, 0.15]} rotation-z={style === 'side' ? -0.35 : 0} scale={[1.55, 0.5, 0.85]}>
          <sphereGeometry args={[0.12, 20, 12]} />
          <Mat color={c} rough={0.85} />
        </mesh>
      )}
      {style === 'long' && (
        <>
          <mesh castShadow position={[0, -0.12, -0.11]} scale={[1.18, 1, 0.6]}>
            <capsuleGeometry args={[0.2, 0.2, 8, 20]} />
            <Mat color={c} rough={0.85} />
          </mesh>
          {[0.205, -0.205].map((x) => (
            <mesh key={x} position={[x, -0.1, 0.02]} scale={[0.6, 1, 0.9]}>
              <capsuleGeometry args={[0.08, 0.22, 6, 12]} />
              <Mat color={c} rough={0.85} />
            </mesh>
          ))}
          <mesh position={[0.04, 0.17, 0.15]} rotation-z={0.3} scale={[1.6, 0.45, 0.85]}>
            <sphereGeometry args={[0.12, 20, 12]} />
            <Mat color={c} rough={0.85} />
          </mesh>
        </>
      )}
      {style === 'bun' && (
        <>
          <mesh castShadow position={[0, 0.24, -0.1]}><sphereGeometry args={[0.11, 20, 14]} /><Mat color={c} rough={0.85} /></mesh>
          <mesh position={[0, 0.2, 0.06]} scale={[1.5, 0.4, 1]}><sphereGeometry args={[0.13, 20, 12]} /><Mat color={c} rough={0.85} /></mesh>
        </>
      )}
      {style === 'ponytail' && (
        <>
          <mesh position={[0, 0.1, -0.245]}><sphereGeometry args={[0.065, 14, 10]} /><Mat color={c} rough={0.85} /></mesh>
          <mesh castShadow position={[0, -0.08, -0.3]} rotation-x={0.35}><capsuleGeometry args={[0.07, 0.24, 6, 12]} /><Mat color={c} rough={0.85} /></mesh>
          <mesh position={[-0.04, 0.17, 0.15]} rotation-z={-0.3} scale={[1.6, 0.45, 0.85]}><sphereGeometry args={[0.12, 20, 12]} /><Mat color={c} rough={0.85} /></mesh>
        </>
      )}
      {curls.map((p, i) => (
        <mesh key={i} position={p} castShadow={i % 4 === 0}><sphereGeometry args={[0.062, 12, 9]} /><Mat color={c} rough={0.9} /></mesh>
      ))}
      {look.beard && (
        <mesh position={[0, -0.02, 0.012]} rotation-x={0.25}>
          <sphereGeometry args={[HR + 0.01, 32, 12, -Math.PI * 0.15, Math.PI * 1.3, Math.PI * 0.6, Math.PI * 0.32]} />
          <Mat color={c} rough={0.95} side={2} />
        </mesh>
      )}
    </group>
  );
}

function Face({ look }) {
  const brow = look.hair;
  const nose = '#' + new THREE.Color(look.skin).multiplyScalar(0.9).getHexString();
  return (
    <group>
      {[0.088, -0.088].map((x) => (
        <group key={x} position={[x, -0.008, HR - 0.022]}>
          <mesh scale={[0.8, 1.12, 0.5]}><sphereGeometry args={[0.03, 16, 12]} /><meshStandardMaterial color="#1a1716" roughness={0.2} /></mesh>
          <mesh position={[0.009, 0.013, 0.014]}><sphereGeometry args={[0.008, 8, 6]} /><meshBasicMaterial color="#ffffff" /></mesh>
          <mesh position={[0, 0.056, 0.004]} rotation-z={x > 0 ? -0.1 : 0.1} scale={[1, 0.6, 0.5]}><capsuleGeometry args={[0.011, 0.045, 4, 8]} /><Mat color={brow} /></mesh>
        </group>
      ))}
      <mesh position={[0, -0.05, HR - 0.002]} scale={[1, 0.85, 0.8]}><sphereGeometry args={[0.022, 12, 10]} /><Mat color={nose} rough={0.6} /></mesh>
      <mesh position={[0, -0.1, look.beard ? HR + 0.008 : HR - 0.026]} rotation-z={Math.PI}>
        <torusGeometry args={[0.03, 0.0075, 8, 16, Math.PI]} />
        <meshStandardMaterial color="#5a2a24" roughness={0.6} />
      </mesh>
      {[0.135, -0.135].map((x) => (
        <mesh key={x} position={[x, -0.06, HR - 0.06]} rotation-y={x > 0 ? 0.5 : -0.5} scale={[1, 0.65, 0.2]}>
          <sphereGeometry args={[0.04, 12, 8]} />
          <meshStandardMaterial color="#ef8f86" transparent opacity={0.45} roughness={0.8} depthWrite={false} />
        </mesh>
      ))}
      {look.glasses && (
        <group position={[0, 0.005, HR + 0.012]}>
          {[0.088, -0.088].map((x) => (
            <mesh key={x} position-x={x}><torusGeometry args={[0.055, 0.009, 8, 24]} /><meshStandardMaterial color="#1b1c20" roughness={0.3} metalness={0.4} /></mesh>
          ))}
          <mesh><boxGeometry args={[0.07, 0.01, 0.01]} /><meshStandardMaterial color="#1b1c20" /></mesh>
        </group>
      )}
    </group>
  );
}

export default function Person({ color, look, pose, tie = false, boss = false }) {
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
    const breathe = Math.sin(t * 2.1) * 0.008;

    if (panic) {
      body.current.position.y = 0.78 + Math.abs(Math.sin(t * 9)) * 0.22;
      legL.current.rotation.x = Math.sin(t * 18) * 0.5;
      legR.current.rotation.x = -Math.sin(t * 18) * 0.5;
      armL.current.rotation.x = Math.PI - 0.3 + Math.sin(t * 20) * 0.5;
      armR.current.rotation.x = Math.PI - 0.3 + Math.sin(t * 20 + 2) * 0.5;
      armL.current.rotation.z = 0.25; armR.current.rotation.z = -0.25;
      head.current.rotation.x = Math.sin(t * 25) * 0.15;
      head.current.rotation.z = 0;
      return;
    }
    armL.current.rotation.z = 0.06; armR.current.rotation.z = -0.06;
    body.current.position.y = (down ? 0.5 : seated ? 0.62 : 0.78 + (moving ? Math.abs(Math.sin(t * f)) * 0.05 : 0)) + breathe;
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
    head.current.rotation.x = mode === 'talking' ? Math.sin(t * 6) * 0.12 : down ? 0.45 : mode === 'working' ? 0.12 : 0;
    head.current.rotation.z = mode === 'thinking' ? Math.sin(t * 1.5) * 0.15 : down ? Math.sin(t * 0.8) * 0.1 : 0;
    head.current.rotation.y = mode === 'idle' && !moving ? Math.sin(t * 0.5) * 0.25 : 0;
  });

  const suit = boss || tie;
  const torso = boss ? '#1e2533' : tie ? '#2d3446' : soften(color);
  const sleeve = torso;
  const forearm = suit ? torso : look.skin;
  return (
    <group ref={body} position-y={0.78}>
      {/* torso */}
      <mesh castShadow receiveShadow geometry={TORSO} scale={[1.0, 1, 0.78]}>
        <Mat color={torso} rough={suit ? 0.55 : 0.85} />
      </mesh>
      {/* hips / belt */}
      <mesh position-y={-0.085} scale={[1, 1, 0.8]}>
        <cylinderGeometry args={[0.172, 0.165, 0.09, 32]} />
        <Mat color={boss ? '#1e2533' : look.pants} rough={0.85} />
      </mesh>
      {suit ? (
        <>
          <mesh position={[0, 0.3, 0.162]} rotation-x={-0.22}><planeGeometry args={[0.15, 0.2]} /><Mat color="#f4f4f4" /></mesh>
          <mesh position={[0, 0.22, 0.178]} rotation-x={-0.18}><boxGeometry args={[0.05, 0.22, 0.015]} /><Mat color={boss ? '#c8121e' : color} rough={0.5} /></mesh>
          {boss && <mesh position={[0.11, 0.3, 0.155]}><circleGeometry args={[0.03, 16]} /><meshStandardMaterial color="#e0b44a" metalness={0.8} roughness={0.25} /></mesh>}
        </>
      ) : (
        <mesh position-y={0.43} rotation-x={Math.PI / 2} scale={[1.05, 0.85, 1]}>
          <torusGeometry args={[0.105, 0.028, 10, 24]} />
          <Mat color={look.trim ?? '#f4f1ec'} rough={0.8} />
        </mesh>
      )}
      {/* neck */}
      <mesh position-y={0.47}><cylinderGeometry args={[0.065, 0.075, 0.1, 16]} /><Mat color={look.skin} rough={0.65} /></mesh>

      <group ref={head} position-y={HEAD_Y}>
        <mesh castShadow><sphereGeometry args={[HR, 40, 28]} /><Mat color={look.skin} rough={0.62} /></mesh>
        {[HR - 0.005, -(HR - 0.005)].map((x) => (
          <mesh key={x} position={[x, -0.01, 0]} scale={[0.5, 1, 0.75]}><sphereGeometry args={[0.055, 12, 10]} /><Mat color={look.skin} rough={0.65} /></mesh>
        ))}
        <Face look={look} />
        <Hair look={look} />
        {boss && (
          <group position={[0, 0.005, HR + 0.012]}>
            {[0.088, -0.088].map((gx) => <mesh key={gx} position-x={gx}><torusGeometry args={[0.055, 0.01, 6, 20]} /><meshStandardMaterial color="#111" /></mesh>)}
            <mesh><boxGeometry args={[0.07, 0.01, 0.01]} /><meshStandardMaterial color="#111" /></mesh>
          </group>
        )}
      </group>

      {[[armL, 0.255], [armR, -0.255]].map(([ref, x]) => (
        <group key={x} ref={ref} position={[x, 0.33, 0]}>
          <mesh castShadow position-y={-0.07}><capsuleGeometry args={[0.068, 0.12, 6, 14]} /><Mat color={sleeve} rough={0.8} /></mesh>
          <mesh castShadow position-y={-0.25}><capsuleGeometry args={[0.06, 0.17, 6, 14]} /><Mat color={forearm} rough={0.7} /></mesh>
          <mesh position-y={-0.4}><sphereGeometry args={[0.066, 14, 12]} /><Mat color={look.skin} rough={0.65} /></mesh>
        </group>
      ))}

      {[[legL, 0.1], [legR, -0.1]].map(([ref, lx]) => (
        <group key={lx} ref={ref} position={[lx, -0.14, 0]}>
          <mesh castShadow position-y={-0.3}><capsuleGeometry args={[0.088, 0.34, 6, 14]} /><Mat color={boss ? '#1e2533' : look.pants} rough={0.85} /></mesh>
          <mesh castShadow position={[0, -0.6, 0.05]} scale={[0.95, 0.6, 1.55]}><sphereGeometry args={[0.1, 18, 12]} /><Mat color={boss ? '#111' : look.shoes ?? '#f2f2f2'} rough={0.5} /></mesh>
        </group>
      ))}
    </group>
  );
}
