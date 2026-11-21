// Overview: orbit controls + animated presets. Virtual Life: follows the player's rig.
// Switching modes flies the camera smoothly instead of cutting.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { useOffice, type CameraPreset } from '../store/useOffice';
import { findShot, shotAt } from './shots';
import { shotCamera } from '../world/runtime';
import { RENDER } from './RenderController';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
export const PRESETS: Record<CameraPreset, { pos: THREE.Vector3; look: THREE.Vector3 }> = {
  overview: { pos: V(5, 46, 22), look: V(5, 0, -1) },
  workspace: { pos: V(10.5, 10, 19), look: V(10.5, 0.8, 6.0) },
  meeting: { pos: V(-15, 11, 0.5), look: V(-15, 0.8, -10) },
  manager: { pos: V(-6.2, 11, 0.5), look: V(-6.2, 0.8, -10) },
  lounge: { pos: V(-3.8, 11, 19.5), look: V(-3.8, 0.8, 6.0) },
  kitchen: { pos: V(-15, 10, 11), look: V(-15, 0.8, 1.2) },
  security: { pos: V(25, 11, 0.5), look: V(25, 0.8, -10) },
};

export function CameraDirector() {
  const mode = useOffice((s) => s.mode);
  const style = useOffice((s) => s.cameraStyle);
  const preset = useOffice((s) => s.preset);
  const nonce = useOffice((s) => s.presetNonce);
  const { camera } = useThree();
  const controls = useRef<OrbitControlsImpl | null>(null);
  const flight = useRef<{ pos: THREE.Vector3; look: THREE.Vector3 } | null>(null);
  const curLook = useRef(PRESETS.overview.look.clone());
  const lifeBlend = useRef(0);
  const shotId = useOffice((s) => s.shot);
  const shotClock = useRef(0);

  useEffect(() => { shotClock.current = 0; if (!shotId) shotCamera.active = false; }, [shotId]);

  useMemo(() => { camera.userData.rig = { pos: camera.position.clone(), look: curLook.current.clone() }; }, [camera]);

  useEffect(() => {
    lifeBlend.current = 0;
    if (mode === 'overview') flight.current = PRESETS[preset];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (mode === 'overview') flight.current = PRESETS[preset];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  // Keep the orbit target continuous when the controls (re)mount.
  useEffect(() => {
    if (mode === 'overview' && controls.current) {
      controls.current.target.copy(curLook.current);
      controls.current.update();
    }
  }, [mode]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    if (mode === 'life') {
      const cam = camera as THREE.PerspectiveCamera;
      if (RENDER?.fov && cam.fov !== RENDER.fov) { cam.fov = RENDER.fov; cam.updateProjectionMatrix(); }
      const rig = camera.userData.rig as { pos: THREE.Vector3; look: THREE.Vector3 };
      lifeBlend.current = Math.min(1, lifeBlend.current + dt / 1.3);
      const settled = lifeBlend.current >= 1;
      const k = settled ? (style === 'first' ? 1 : 1 - Math.exp(-dt * 16)) : 1 - Math.exp(-dt * (1.5 + 8 * lifeBlend.current));
      camera.position.lerp(rig.pos, k);
      curLook.current.lerp(rig.look, settled && style === 'first' ? 1 : k);
      camera.lookAt(curLook.current);
      return;
    }
    const c = controls.current;
    const shot = shotId ? findShot(shotId) : undefined;
    if (shot) {
      shotClock.current += dtRaw;
      const cam = camera as THREE.PerspectiveCamera;
      const fov = RENDER?.fov ?? shot.fov ?? 45;
      if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
      const { pos, look, done } = shotAt(shot, shotClock.current);
      camera.position.copy(pos);
      camera.lookAt(look);
      curLook.current.copy(look);
      Object.assign(shotCamera, { active: true, x: pos.x, z: pos.z, rot: Math.atan2(look.x - pos.x, look.z - pos.z) });
      if (done) {
        shotCamera.active = false;
        if (cam.fov !== (RENDER?.fov ?? 45)) { cam.fov = RENDER?.fov ?? 45; cam.updateProjectionMatrix(); }
        flight.current = null;
        if (c) { c.target.copy(look); c.update(); }
        useOffice.getState().playShot(null);
      }
      return;
    }
    if (flight.current && c) {
      const k = 1 - Math.exp(-dt * 3);
      camera.position.lerp(flight.current.pos, k);
      c.target.lerp(flight.current.look, k);
      c.update();
      if (camera.position.distanceTo(flight.current.pos) < 0.05 && c.target.distanceTo(flight.current.look) < 0.05) flight.current = null;
    }
    if (c) curLook.current.copy(c.target);
  });

  if (mode !== 'overview') return null;
  return (
    <OrbitControls
      ref={controls as never}
      makeDefault
      enabled={!shotId}
      enableDamping
      dampingFactor={0.08}
      maxPolarAngle={1.42}
      minDistance={3}
      maxDistance={80}
      onStart={() => { flight.current = null; }}
    />
  );
}
