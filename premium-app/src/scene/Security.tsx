// The Cyber Security room's live parts. The video wall's five screens, the door sign and the red alert beacons are one
// mesh on one canvas (one draw call), and the analysts' consoles share one live screen material.
// The room has no warm ceiling light: its only light is the screens' cool glow, which flashes red during an alert.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useOffice, selectProject } from '../store/useOffice';
import { liveScreen } from './assets';
import { SOC_INSIDE, insideIntensity, insideLight } from './inside';
import { WALL_CANVAS, WALL_REGIONS, VIDEO_WALL, TV, TV_Z, BEACONS, SIGN, type WallRegion, drawVideoWall, drawConsole, beaconFlash, socAlert } from './socScreens';

/** The room's light: cool screen glow from the front, plus the beacons' red during an alert. */
const LIGHT: [number, number, number] = [25, 2.1, -10.6];

/**
 * Screens, sign and beacons in one geometry. Each part samples its region of the canvas; vertex colours multiply it,
 * so the beacons (on a white patch) can glow brighter than white for the bloom while the screens stay at 1.
 */
function wallGeometry() {
  const part = (g: THREE.BufferGeometry, region: WallRegion, center = false) => {
    const [rx, ry, rw, rh] = WALL_REGIONS[region];
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const u = center ? 0.5 : uv.getX(i), v = center ? 0.5 : uv.getY(i);
      uv.setXY(i, (rx + u * rw) / WALL_CANVAS.w, 1 - (ry + (1 - v) * rh) / WALL_CANVAS.h);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(uv.count * 3).fill(1), 3));
    return g;
  };
  const [, , sw, sh] = WALL_REGIONS.sign;
  const screens = [
    ...VIDEO_WALL.map((s) => part(new THREE.PlaneGeometry(TV.pw * s.s, TV.ph * s.s).translate(s.x, s.y, TV_Z + TV.front * s.s + 0.004), s.region)),
    part(new THREE.PlaneGeometry(SIGN.w, (SIGN.w * sh) / sw).translate(SIGN.x, SIGN.y, SIGN.z), 'sign'),
  ];
  const beacons = BEACONS.map(([x, y, z]) => part(new THREE.SphereGeometry(0.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).translate(x, y, z + 0.09), 'white', true));
  const parts = [...screens, ...beacons].map((g) => (g.index ? g.toNonIndexed() : g));
  const geometry = mergeGeometries(parts)!;
  [...screens, ...beacons, ...parts].forEach((g) => g.dispose());
  // the beacons' vertices come last
  return { geometry, beaconFrom: parts.slice(0, screens.length).reduce((n, g) => n + g.attributes.position.count, 0) };
}

const COOL = new THREE.Color(0.22, 0.45, 1.0), ALARM = new THREE.Color(1.0, 0.1, 0.05), tmp = new THREE.Color();

/** Video wall, sign, consoles, beacons and the room light, all driven by one clock. */
export function SecurityLive() {
  const wall = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = WALL_CANVAS.w;
    canvas.height = WALL_CANVAS.h;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return { canvas, texture, ...wallGeometry() };
  }, []);
  const light = useRef<THREE.PointLight>(null!);
  // inside, the glow reaches the corners like the other rooms' lamps do, with its own moodier falloff (inside.ts)
  const inside = useOffice((s) => insideLight(s.mode, s.shot));
  const scale = inside ? insideIntensity(SOC_INSIDE.boost, LIGHT[1], SOC_INSIDE.decay) : 1;
  // Own clock from frame deltas, so recorded renders (fixed steps) and live play show the same thing.
  const clock = useRef({ t: 0, redraw: 1 });
  useEffect(() => () => {
    wall.texture.dispose();
    wall.geometry.dispose();
  }, [wall]);

  useFrame((_, dtRaw) => {
    const c = clock.current;
    const dt = Math.min(dtRaw, 0.1);
    c.t += dt;
    const f = beaconFlash(c.t);
    const colors = wall.geometry.attributes.color as THREE.BufferAttribute;
    tmp.copy(ALARM).multiplyScalar(0.7 + f * 6);
    for (let i = wall.beaconFrom; i < colors.count; i++) colors.setXYZ(i, tmp.r, tmp.g, tmp.b);
    colors.needsUpdate = true;
    const red = 1.5 + 22 * socAlert(c.t) * Math.max(0, f - 0.2);
    light.current.color.copy(COOL).multiplyScalar(9 * scale).add(tmp.copy(ALARM).multiplyScalar(red * scale));
    c.redraw += dt;
    if (c.redraw < 0.25) return;
    c.redraw = 0;
    drawVideoWall(wall.canvas.getContext('2d')!, c.t, selectProject(useOffice.getState())?.title);
    wall.texture.needsUpdate = true;
    const consoles = liveScreen('Live_Soc');
    drawConsole(consoles.canvas.getContext('2d')!, consoles.canvas.width, consoles.canvas.height, c.t);
    consoles.texture.needsUpdate = true;
  });

  return (
    <>
      <mesh geometry={wall.geometry}>
        <meshBasicMaterial map={wall.texture} vertexColors toneMapped={false} />
      </mesh>
      <pointLight ref={light} position={LIGHT} intensity={1} distance={inside ? 10 * SOC_INSIDE.reach : 10} decay={inside ? SOC_INSIDE.decay : 2} />
    </>
  );
}
