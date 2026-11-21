// Procedural low-poly person with walk / sit / type / talk animation.
import { useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export type PoseMode = 'stand' | 'walk' | 'sit' | 'type' | 'run' | 'air';
/** Optional one-off gesture on top of the pose (used by the Mixamo clips when available). */
export type Gesture = 'drink' | 'wave' | 'clap' | null;
export interface Pose { mode: PoseMode; talking: boolean; gesture?: Gesture; }

interface Props {
  shirt: string;
  skin?: string;
  hair?: string;
  hairStyle?: 'short' | 'long' | 'bun' | 'cap' | 'none';
  pose: MutableRefObject<Pose>;
  visible?: boolean;
}

const pants = new THREE.MeshStandardMaterial({ color: '#1f2433', roughness: 0.85 });
const shoe = new THREE.MeshStandardMaterial({ color: '#0e1016', roughness: 0.6 });
const eyeMat = new THREE.MeshBasicMaterial({ color: '#111318' });

export function Avatar({ shirt, skin = '#e8c4a6', hair = '#2b1d14', hairStyle = 'short', pose, visible = true }: Props) {
  const mats = useMemo(() => ({
    shirt: new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.6 }),
    skin: new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 }),
    hair: new THREE.MeshStandardMaterial({ color: hair, roughness: 0.9 }),
  }), [shirt, skin, hair]);

  const hips = useRef<THREE.Group>(null!);
  const torso = useRef<THREE.Group>(null!);
  const head = useRef<THREE.Group>(null!);
  const legL = useRef<THREE.Group>(null!);
  const legR = useRef<THREE.Group>(null!);
  const kneeL = useRef<THREE.Group>(null!);
  const kneeR = useRef<THREE.Group>(null!);
  const armL = useRef<THREE.Group>(null!);
  const armR = useRef<THREE.Group>(null!);
  const elbowL = useRef<THREE.Group>(null!);
  const elbowR = useRef<THREE.Group>(null!);
  const phase = useRef(Math.random() * 10);
  const blend = useRef({ sit: 0, walk: 0, type: 0 });

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const p = pose.current;
    const b = blend.current;
    const k = 1 - Math.exp(-dt * 10);
    const sitting = p.mode === 'sit' || p.mode === 'type';
    b.sit += ((sitting ? 1 : 0) - b.sit) * k;
    b.walk += ((p.mode === 'walk' || p.mode === 'run' ? 1 : 0) - b.walk) * k;
    b.type += ((p.mode === 'type' ? 1 : 0) - b.type) * k;
    phase.current += dt * (p.mode === 'run' ? 11 : 7.5);
    const ph = phase.current;
    const swing = Math.sin(ph) * (p.mode === 'run' ? 0.85 : 0.55) * b.walk;
    const air = p.mode === 'air' ? 1 : 0;

    hips.current.position.y = THREE.MathUtils.lerp(0.95, 0.56, b.sit) + Math.abs(Math.cos(ph)) * 0.035 * b.walk;
    torso.current.rotation.x = 0.06 * b.walk + 0.12 * b.type;

    legL.current.rotation.x = -swing - (Math.PI / 2) * b.sit - 0.4 * air;
    legR.current.rotation.x = swing - (Math.PI / 2) * b.sit + 0.2 * air;
    kneeL.current.rotation.x = Math.max(0, -Math.sin(ph + 1.2)) * 0.8 * b.walk + (Math.PI / 2) * b.sit + 0.6 * air;
    kneeR.current.rotation.x = Math.max(0, Math.sin(ph + 1.2)) * 0.8 * b.walk + (Math.PI / 2) * b.sit + 0.3 * air;

    const typeL = -1.05 + Math.sin(ph * 2.6) * 0.07;
    const typeR = -1.05 + Math.cos(ph * 2.9) * 0.07;
    const talk = p.talking ? Math.sin(ph * 1.7) * 0.35 : 0;
    armL.current.rotation.x = swing * 0.9 * (1 - b.sit) + b.type * typeL + (1 - b.type) * b.sit * -0.55 - 1.2 * air;
    armR.current.rotation.x = -swing * 0.9 * (1 - b.sit) + b.type * typeR + (1 - b.type) * b.sit * -0.55 - talk * (1 - b.type) - 1.2 * air;
    armL.current.rotation.z = 0.08 + 0.25 * air;
    armR.current.rotation.z = -0.08 - 0.25 * air;
    elbowL.current.rotation.x = -0.25 * b.walk - 0.55 * b.type - 0.4 * b.sit * (1 - b.type);
    elbowR.current.rotation.x = -0.25 * b.walk - 0.55 * b.type - 0.4 * b.sit * (1 - b.type) - Math.abs(talk) * 0.8;

    head.current.rotation.x = p.talking ? Math.sin(ph * 2.2) * 0.06 : 0.05 * b.type;
    head.current.rotation.y = p.talking ? Math.sin(ph * 0.9) * 0.18 : 0;
  });

  return (
    <group visible={visible}>
      <group ref={hips} position={[0, 0.95, 0]}>
        {/* legs */}
        {([[legL, kneeL, -0.12], [legR, kneeR, 0.12]] as const).map(([leg, knee, x], i) => (
          <group key={i} ref={leg} position={[x, 0, 0]}>
            <mesh material={pants} position={[0, -0.22, 0]} castShadow>
              <capsuleGeometry args={[0.085, 0.3, 4, 10]} />
            </mesh>
            <group ref={knee} position={[0, -0.44, 0]}>
              <mesh material={pants} position={[0, -0.2, 0]} castShadow>
                <capsuleGeometry args={[0.075, 0.3, 4, 10]} />
              </mesh>
              <mesh material={shoe} position={[0, -0.42, 0.06]} castShadow>
                <boxGeometry args={[0.13, 0.08, 0.27]} />
              </mesh>
            </group>
          </group>
        ))}
        {/* torso */}
        <group ref={torso}>
          <mesh material={mats.shirt} position={[0, 0.3, 0]} castShadow>
            <capsuleGeometry args={[0.2, 0.36, 6, 14]} />
          </mesh>
          {([[armL, elbowL, -0.27], [armR, elbowR, 0.27]] as const).map(([arm, elbow, x], i) => (
            <group key={i} ref={arm} position={[x, 0.55, 0]}>
              <mesh material={mats.shirt} position={[0, -0.15, 0]} castShadow>
                <capsuleGeometry args={[0.065, 0.22, 4, 10]} />
              </mesh>
              <group ref={elbow} position={[0, -0.3, 0]}>
                <mesh material={mats.skin} position={[0, -0.13, 0]} castShadow>
                  <capsuleGeometry args={[0.055, 0.2, 4, 10]} />
                </mesh>
              </group>
            </group>
          ))}
          <group ref={head} position={[0, 0.72, 0]}>
            <mesh material={mats.skin} position={[0, 0.14, 0]} castShadow>
              <sphereGeometry args={[0.17, 24, 18]} />
            </mesh>
            <mesh material={eyeMat} position={[-0.06, 0.16, 0.155]}>
              <sphereGeometry args={[0.022, 10, 8]} />
            </mesh>
            <mesh material={eyeMat} position={[0.06, 0.16, 0.155]}>
              <sphereGeometry args={[0.022, 10, 8]} />
            </mesh>
            {hairStyle !== 'none' && (
              <mesh material={mats.hair} position={[0, 0.2, -0.015]} castShadow>
                <sphereGeometry args={[0.178, 24, 14, 0, Math.PI * 2, 0, hairStyle === 'cap' ? Math.PI / 2.3 : Math.PI / 1.85]} />
              </mesh>
            )}
            {hairStyle === 'long' && (
              <mesh material={mats.hair} position={[0, 0.06, -0.08]} castShadow>
                <boxGeometry args={[0.32, 0.32, 0.12]} />
              </mesh>
            )}
            {hairStyle === 'bun' && (
              <mesh material={mats.hair} position={[0, 0.33, -0.1]} castShadow>
                <sphereGeometry args={[0.08, 12, 10]} />
              </mesh>
            )}
            {hairStyle === 'cap' && (
              <mesh material={mats.shirt} position={[0, 0.25, 0.1]} rotation={[0.25, 0, 0]}>
                <boxGeometry args={[0.26, 0.025, 0.16]} />
              </mesh>
            )}
          </group>
        </group>
      </group>
    </group>
  );
}
