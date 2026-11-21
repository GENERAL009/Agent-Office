// Synty POLYGON Office props (public/models, converted with tools/synty_to_gltf.py).
// One glTF holds every prop as a named node; <Prop> clones the one it needs.
import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

export const PROPS_URL = '/models/office_props.gltf';
useGLTF.preload(PROPS_URL);

/**
 * Synty ships the same atlas in twelve palettes (01–04, each in A/B/C): floors, walls, upholstery and clothes
 * change color between them. '02' means 02_A, '03B' means 03_B.
 */
export type Palette = '01' | '02' | '03' | '04' | '01B' | '01C' | '02B' | '02C' | '03B' | '03C' | '04B' | '04C';
/** Screen images for monitors, TVs and arcade cabinets. `Live_*` screens are canvases drawn at runtime (see liveScreen). */
export type ScreenImage = 'Sceen_01' | 'Sceen_02' | 'Sceen_03' | 'Sceen_04' | 'Sceen_05' | 'Sceen_Arcade_01' | 'Live_Soc';
const textures = new Map<string, THREE.Texture>();
function texture(file: string) {
  let t = textures.get(file);
  if (!t) {
    t = new THREE.TextureLoader().load(`/models/textures/${file}`);
    t.colorSpace = THREE.SRGBColorSpace;
    t.flipY = false; // glTF convention
    t.anisotropy = 8;
    textures.set(file, t);
  }
  return t;
}
const live = new Map<string, { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture }>();
/** The canvas behind a `Live_*` screen: every prop showing it shares one material, so the room that owns it redraws it once for all. */
export function liveScreen(name: Extract<ScreenImage, `Live_${string}`>) {
  let s = live.get(name);
  if (!s) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 576;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false; // the Synty screens' UVs follow the glTF convention
    texture.anisotropy = 8;
    live.set(name, (s = { canvas, texture }));
  }
  return s;
}
const screenTexture = (s: ScreenImage) => (s.startsWith('Live_') ? liveScreen(s as 'Live_Soc').texture : texture(`PolygonOffice_Texture_${s}.jpg`));
export const paletteTexture = (p: Palette) => texture(`PolygonOffice_Texture_${p.slice(0, 2)}_${p[2] ?? 'A'}.jpg`);
const swapped = new Map<string, THREE.Material>();
/** Same material, other palette (atlas materials) or other picture (screen materials). Cached and shared. */
export function withPalette(mat: THREE.Material, p: Palette, screen?: ScreenImage): THREE.Material {
  const m = mat as THREE.MeshStandardMaterial;
  if (!m.map || m.transparent) return mat;
  const isScreen = m.name === 'Screen';
  if (isScreen ? !screen || screen === 'Sceen_01' : p === '01') return mat;
  const key = `${m.uuid}:${isScreen ? screen : p}`;
  let out = swapped.get(key);
  if (!out) {
    const c = m.clone();
    c.map = isScreen ? screenTexture(screen!) : paletteTexture(p);
    if (isScreen) { c.emissive = new THREE.Color('#ffffff'); c.emissiveMap = c.map; c.emissiveIntensity = 0.35; }
    swapped.set(key, c);
    out = c;
  }
  return out;
}

/** The see-through nets (Window_Net_*) use their own alpha texture instead of the atlas. */
let net: THREE.Material | null = null;
function netMaterial() {
  if (!net) {
    const t = new THREE.TextureLoader().load('/models/textures/Net_Alpha.png');
    t.flipY = false;
    net = new THREE.MeshStandardMaterial({ color: '#3d4148', alphaMap: t, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9 });
  }
  return net;
}

const prepared = new WeakSet<THREE.Object3D>();
function prepare(root: THREE.Object3D) {
  if (prepared.has(root)) return;
  prepared.add(root);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    const glass = mat.transparent || mat.name === 'Glass';
    m.castShadow = !glass;
    m.receiveShadow = true;
    if (mat.map) mat.map.anisotropy = 8;
    if (glass) mat.depthWrite = false;
  });
}

export interface PropProps {
  name: string;
  position?: [number, number, number];
  /** Rotation around Y in radians. */
  rot?: number;
  /** Full rotation, when a prop has to lie flat or hang on a wall at an angle. */
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  palette?: Palette;
  /** Picture on the prop's screen (monitors, TVs, arcade machines). */
  screen?: ScreenImage;
  /** Child objects to leave out, e.g. the built-in door of a glass wall piece. */
  hide?: string[];
  onClick?: (e: import('@react-three/fiber').ThreeEvent<MouseEvent>) => void;
  onPointerOver?: () => void;
  onPointerOut?: () => void;
}

/** A Synty prop by node name, e.g. "SM_Prop_Desk_04". Short names ("Desk_04", "B:Floor_Wood_01") work too. */
export function Prop({ name, position = [0, 0, 0], rot = 0, rotation, scale = 1, palette = '01', screen, hide, ...events }: PropProps) {
  const { scene } = useGLTF(PROPS_URL);
  prepare(scene);
  const full = name.startsWith('SM_') ? name : name.startsWith('B:') ? `SM_Bld_${name.slice(2)}` : `SM_Prop_${name}`;
  const obj = useMemo(() => {
    const src = scene.getObjectByName(full);
    if (!src) {
      console.warn('Missing prop', full);
      return new THREE.Group();
    }
    // Keep the node's own offset: a few pieces (double doors, mirrors) have their pivot away from the mesh.
    const c = src.clone(true);
    // A part of another prop (e.g. the door inside a glass wall piece) brings its parent's transform along.
    if (src.parent && src.parent !== scene) {
      src.parent.updateWorldMatrix(true, false);
      c.applyMatrix4(src.parent.matrixWorld);
    }
    for (const h of hide ?? []) { const o = c.getObjectByName(h); if (o) o.visible = false; }
    c.userData.prop = true;
    const isNet = /Window_Net_(01|Half_01|Corner_01)$/.test(full);
    if (palette !== '01' || screen || isNet) {
      c.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        if (isNet) { m.material = netMaterial(); m.castShadow = false; return; }
        m.material = Array.isArray(m.material) ? m.material.map((x) => withPalette(x, palette, screen)) : withPalette(m.material, palette, screen);
      });
    }
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, full, palette, screen, hide?.join()]);
  return (
    <group position={position} rotation={rotation ?? [0, rot, 0]} scale={scale} {...events}>
      <primitive object={obj} />
    </group>
  );
}
