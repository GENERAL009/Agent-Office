// Render quality: sky backdrop, studio reflections, post-processing and the cinematic camera.
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { EffectComposer, N8AO, Bloom, SMAA, ToneMapping, Vignette, TiltShift2, HueSaturation, BrightnessContrast } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useOffice, positions } from './store.js';

// Default overview: a three-quarter "diorama" angle instead of a flat top-down view.
export function overviewPose(L) {
  const f = Math.max(1, L.W / 34);
  return { pos: new THREE.Vector3(10 * f, 27 * f, 33 * f), target: new THREE.Vector3(0.5, 0, 1.5) };
}

// Sky gradient drawn inside the scene, so post-processing sees it too.
export function SkyBackdrop() {
  const scene = useThree((s) => s.scene);
  const { top, horizon } = useOffice((s) => s.sky);
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 4; c.height = 512;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => {
    const g = tex.image.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, top);
    grad.addColorStop(0.72, horizon);
    grad.addColorStop(1, horizon);
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 512);
    tex.needsUpdate = true;
    scene.background = tex;
  }, [top, horizon, tex, scene]);
  return null;
}

// Soft studio reflections: big area lights baked once into an environment map (no downloads).
export function StudioLight() {
  const day = useOffice((s) => 1 - s.sky.lamps);
  const horizon = useOffice((s) => s.sky.horizon);
  return (
    <Environment resolution={256} frames={1} environmentIntensity={0.2 + 0.45 * day}>
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={[30, 30, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#fff1dc" position={[-14, 5, 4]} rotation-y={Math.PI / 2} scale={[18, 6, 1]} />
      <Lightformer form="rect" intensity={1.0} color={horizon} position={[14, 4, -2]} rotation-y={-Math.PI / 2} scale={[18, 6, 1]} />
      <Lightformer form="ring" intensity={1.6} color="#ffffff" position={[6, 9, 14]} scale={6} onUpdate={(o) => o.lookAt(0, 0, 0)} />
    </Environment>
  );
}

const TM = { aces: ToneMappingMode.ACES_FILMIC, agx: ToneMappingMode.AGX, neutral: ToneMappingMode.NEUTRAL };
const tm = (() => { try { return new URLSearchParams(location.search).get('tm') || 'neutral'; } catch { return 'neutral'; } })();
const FX = (() => { try { return (new URLSearchParams(location.search).get('fx') ?? 'ao,bloom,tilt,vig').split(','); } catch { return []; } })();
export function Effects() {
  const night = useOffice((s) => s.sky.lamps > 0.5);
  const boss = useOffice((s) => s.boss);
  const cinema = useOffice((s) => s.cinema);
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {FX.includes('ao') && <N8AO aoRadius={1.4} distanceFalloff={0.6} intensity={night ? 2.4 : 3.2} quality="high" halfRes={false} />}
      {FX.includes('bloom') && <Bloom mipmapBlur intensity={night ? 0.85 : 0.45} luminanceThreshold={0.82} luminanceSmoothing={0.25} radius={0.7} />}
      {FX.includes('tilt') && <TiltShift2 blur={boss || cinema ? 0.0 : 0.05} taper={0.7} />}
      {FX.includes('grade') && <HueSaturation saturation={0.12} />}
      {FX.includes('grade') && <BrightnessContrast contrast={0.1} />}
      <ToneMapping mode={TM[tm] ?? ToneMappingMode.NEUTRAL} />
      {FX.includes('vig') && <Vignette eskil={false} offset={0.28} darkness={0.5} />}
      <SMAA />
    </EffectComposer>
  );
}

// Cinema mode (key C): the camera drifts around the office on its own and flies in to
// whichever agent is busy — the "screensaver" view.
const HOLD = 6.5; // seconds on one shot
export function CinemaCamera() {
  const cinema = useOffice((s) => s.cinema);
  const boss = useOffice((s) => s.boss);
  const L = useOffice((s) => s.layout);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  const st = useRef({ shot: null, since: 0, look: new THREE.Vector3(), pos: new THREE.Vector3(), init: false });

  useEffect(() => {
    if (controls) controls.enabled = !(cinema && !boss);
    if (cinema && controls) {
      st.current.look.copy(controls.target);
      st.current.pos.copy(camera.position);
      st.current.init = true;
      st.current.since = -1e9;
    }
  }, [cinema, boss, controls, camera]);

  useFrame((_, dtRaw) => {
    if (!cinema || boss) return;
    const dt = Math.min(dtRaw, 0.1);
    const t = performance.now() / 1000;
    const S = st.current;
    const agents = useOffice.getState().agents;
    const forced = useOffice.getState().cinemaShot;

    // choose the next shot
    if (forced) S.shot = forced;
    else if (t - S.since > HOLD || (S.shot?.id && !agents[S.shot.id])) {
      const busy = Object.values(agents)
        .filter((a) => a.state === 'panic' || a.state === 'working' || a.state === 'talking' || a.state === 'walking')
        .sort((a, b) => (b.state === 'panic') - (a.state === 'panic'));
      const prev = S.shot?.id;
      const next = busy.find((a) => a.id !== prev) ?? (prev ? null : busy[0]);
      S.shot = next && S.shot?.kind !== 'follow' ? { kind: 'follow', id: next.id } : { kind: 'overview' };
      S.since = t;
    }

    const goalLook = new THREE.Vector3();
    const goalPos = new THREE.Vector3();
    if (S.shot?.kind === 'follow' && positions[S.shot.id]) {
      const p = positions[S.shot.id];
      const [wx, wz] = L.toWorld([p.x, p.z]);
      // angle given → relative to where the agent faces (0 = straight at the face), else a slow drift
      const a = S.shot.angle != null ? p.rot + S.shot.angle + Math.sin(t * 0.25) * 0.08 : 0.6 + Math.sin(t * 0.09) * 0.5;
      const d = S.shot.dist ?? 7.5;
      goalLook.set(wx, S.shot.lookY ?? 1.0, wz);
      goalPos.set(wx + Math.sin(a) * d, (S.shot.height ?? 4.6), wz + Math.cos(a) * d);
    } else {
      const o = overviewPose(L);
      const a = Math.sin(t * 0.05) * 0.35;
      const r = Math.hypot(o.pos.x, o.pos.z);
      goalLook.copy(o.target);
      goalPos.set(Math.sin(a + 0.34) * r, o.pos.y, Math.cos(a + 0.34) * r);
    }
    // critically damped glide
    const k = 1 - Math.exp(-dt * 1.6);
    S.look.lerp(goalLook, k);
    S.pos.lerp(goalPos, k);
    camera.position.copy(S.pos);
    camera.lookAt(S.look);
    if (controls) controls.target.copy(S.look);
  });
  return null;
}
