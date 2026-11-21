// Synty office characters, posed procedurally: walk, run, sit, type, talk, jump.
// Rotations are written in "character space" (x = character's left, y = up, z = forward)
// and converted to each bone's local space, so the rig's own bone axes don't matter.
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Pose } from './Avatar';
import { withPalette, PROPS_URL, type Palette } from './assets';

// Mixamo clips retargeted to the Synty rig (tools/mixamo_to_synty.py). Optional: without the file,
// characters fall back to the procedural poses below.
const ANIMS_URL = '/models/synty_anims.glb';
let clipsPromise: Promise<THREE.AnimationClip[]> | null = null;
function loadClips() {
  clipsPromise ??= fetch(ANIMS_URL, { method: 'HEAD' })
    .then((r) => (r.ok && !(r.headers.get('content-type') ?? '').includes('html') ? new GLTFLoader().loadAsync(ANIMS_URL).then((g) => g.animations) : []))
    .catch(() => []);
  return clipsPromise;
}

type ClipRole = 'type' | 'sit' | 'sitTalk' | 'walk' | 'run' | 'idle' | 'talk' | 'wave' | 'drink' | 'clap' | 'jump';
const CLIP_NAMES: Record<ClipRole, string[]> = {
  type: ['typing'], sit: ['sitting_idle', 'sitting'], sitTalk: ['sitting_talking'], walk: ['walking', 'walk'], run: ['running', 'run'],
  idle: ['breathing_idle', 'idle', 'standing_idle'], talk: ['talking'], wave: ['waving', 'wave'], drink: ['drinking'], clap: ['clapping', 'clap'], jump: ['jumping', 'jump'],
};
function pickClips(clips: THREE.AnimationClip[]) {
  const out: Partial<Record<ClipRole, THREE.AnimationClip>> = {};
  for (const role of Object.keys(CLIP_NAMES) as ClipRole[]) {
    for (const n of CLIP_NAMES[role]) {
      const c = clips.find((x) => x.name.toLowerCase() === n) ?? clips.find((x) => x.name.toLowerCase().startsWith(n));
      if (c) { out[role] = c; break; }
    }
  }
  return out;
}

export const CHARACTER_MODELS = [
  'SK_Chr_Boss_Female_01', 'SK_Chr_Business_Male_02', 'SK_Chr_Developer_Male_01', 'SK_Chr_Developer_Female_01',
  'SK_Chr_Developer_Male_02', 'SK_Chr_Business_Male_01',
] as const;
for (const m of CHARACTER_MODELS) useGLTF.preload(`/models/${m}.gltf`);

export const NAMES = {
  pelvis: 'Pelvis', spine1: 'spine_01', spine2: 'spine_02', spine3: 'spine_03', neck: 'neck_01', head: 'head',
  armL: 'UpperArm_L', foreL: 'lowerarm_l', handL: 'Hand_L', armR: 'UpperArm_R', foreR: 'lowerarm_r', handR: 'Hand_R',
  thighL: 'Thigh_L', calfL: 'calf_l', footL: 'Foot_L', thighR: 'Thigh_R', calfR: 'calf_r', footR: 'Foot_R',
} as const;
export type Key = keyof typeof NAMES;

/** Seat height of the office chairs (Synty Chair_05/06). */
const SEAT_H = 0.5;

export interface Rig {
  wrapper: THREE.Group;
  bones: Record<Key, THREE.Bone>;
  rest: Record<Key, THREE.Quaternion>;
  P: Record<Key, THREE.Quaternion>;
  Pinv: Record<Key, THREE.Quaternion>;
  pelvisY: number;
}

/**
 * Things people wear (Synty character attachments), placed at the bind pose relative to a bone and then
 * parented to it so they follow the animation: [bone, offset in character space (x = left, y = up, z = forward)].
 */
export type Wearable = 'Nametag' | 'Identity' | 'Pens' | 'Headset' | 'Earpiece' | 'Antlers' | 'Mop';
/** `turn` rotates the item (character space) at the bind pose, before it is parented to the bone. */
const WEARABLES: Record<Wearable, { prop: string; bone: Key; at: [number, number, number]; turn?: [number, number, number] }> = {
  Nametag: { prop: 'SM_Chr_Attachment_Nametag_01', bone: 'spine3', at: [-0.09, 0.06, 0.17] },
  Identity: { prop: 'SM_Chr_Attachment_Identity_01', bone: 'spine2', at: [0, 0.0, 0.18] },
  Pens: { prop: 'SM_Chr_Attachment_Pens_01', bone: 'spine3', at: [0.1, 0.05, 0.16] },
  Headset: { prop: 'SM_Chr_Attachment_Headset_02', bone: 'head', at: [0, 0.1, 0] },
  Earpiece: { prop: 'SM_Chr_Attachment_Headset_01', bone: 'head', at: [0, 0.06, 0] },
  Antlers: { prop: 'SM_Chr_Attachment_Antlers_01', bone: 'head', at: [0, 0.05, 0] },
  // Held in the right hand. In the bind pose the arm points out along -x, so the mop lies along the arm
  // (head outward); once the arm hangs down the mop stands upright with its head on the floor.
  Mop: { prop: 'SM_Prop_Mop_02', bone: 'handR', at: [-0.3, 0, 0.05], turn: [0, 0, -Math.PI / 2] },
};

export function buildRig(scene: THREE.Object3D, palette: Palette, props: THREE.Object3D, wear: Wearable[]): Rig {
  const root = SkeletonUtils.clone(scene);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      if (palette !== '01') m.material = withPalette(m.material as THREE.Material, palette);
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
    }
  });
  const wrapper = new THREE.Group();
  wrapper.add(root);
  wrapper.updateMatrixWorld(true);
  const bones = {} as Record<Key, THREE.Bone>;
  for (const k of Object.keys(NAMES) as Key[]) bones[k] = root.getObjectByName(NAMES[k]) as THREE.Bone;

  // Face +z: the character's left hand must be on +x.
  const l = bones.handL.getWorldPosition(new THREE.Vector3());
  const r = bones.handR.getWorldPosition(new THREE.Vector3());
  if (l.x < r.x) root.rotation.y = Math.PI;
  // Stand on the floor.
  wrapper.updateMatrixWorld(true);
  const lowest = Math.min(bones.footL.getWorldPosition(new THREE.Vector3()).y, bones.footR.getWorldPosition(new THREE.Vector3()).y);
  root.position.y -= lowest - 0.08;
  wrapper.updateMatrixWorld(true);

  for (const w of wear) {
    const spec = WEARABLES[w];
    const src = props.getObjectByName(spec.prop);
    if (!src) continue;
    // A pivot keeps the prop's own node transform (Synty nodes carry a rotation and 0.01 scale).
    const pivot = new THREE.Group();
    pivot.add(src.clone(true));
    const bone = bones[spec.bone];
    pivot.position.copy(bone.getWorldPosition(new THREE.Vector3())).add(new THREE.Vector3(...spec.at));
    if (spec.turn) pivot.rotation.set(...spec.turn);
    wrapper.add(pivot);
    pivot.updateMatrixWorld(true);
    bone.attach(pivot); // keeps the world transform, then follows the bone
  }

  const rest = {} as Rig['rest'], P = {} as Rig['P'], Pinv = {} as Rig['Pinv'];
  for (const k of Object.keys(NAMES) as Key[]) {
    rest[k] = bones[k].quaternion.clone();
    P[k] = bones[k].parent!.getWorldQuaternion(new THREE.Quaternion());
    Pinv[k] = P[k].clone().invert();
  }
  return { wrapper, bones, rest, P, Pinv, pelvisY: bones.pelvis.getWorldPosition(new THREE.Vector3()).y };
}

const e = new THREE.Euler(0, 0, 0, 'XYZ');
const R = new THREE.Quaternion();

export function SyntyAvatar({ model, pose, visible = true, palette = '01', wear = [] }: { model: string; pose: MutableRefObject<Pose>; visible?: boolean; palette?: Palette; wear?: Wearable[] }) {
  const gltf = useGLTF(`/models/${model}.gltf`);
  const props = useGLTF(PROPS_URL).scene;
  const wearKey = wear.join();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rig = useMemo(() => buildRig(gltf.scene, palette, props, wear), [gltf, palette, props, wearKey]);
  const phase = useRef(Math.random() * 10);
  const blend = useRef({ sit: 0, walk: 0, type: 0, run: 0, air: 0, talk: 0 });
  const [clips, setClips] = useState<Partial<Record<ClipRole, THREE.AnimationClip>> | null>(null);
  useEffect(() => { loadClips().then((c) => setClips(c.length ? pickClips(c) : null)); }, []);
  const anim = useMemo(() => {
    if (!clips || !clips.idle || !clips.walk || !clips.sit) return null;
    const mixer = new THREE.AnimationMixer(rig.wrapper);
    const actions = {} as Partial<Record<ClipRole, THREE.AnimationAction>>;
    for (const [role, clip] of Object.entries(clips) as [ClipRole, THREE.AnimationClip][]) {
      // The player's jump height comes from physics, so the jump clip must not lift the hips too.
      const c = role === 'jump' ? new THREE.AnimationClip(clip.name, clip.duration, clip.tracks.filter((t) => !t.name.endsWith('Pelvis.position'))) : clip;
      actions[role] = mixer.clipAction(c);
    }
    return { mixer, actions, current: null as THREE.AnimationAction | null };
  }, [clips, rig]);
  useEffect(() => () => { anim?.mixer.stopAllAction(); }, [anim]);

  const set = (k: Key, x: number, y = 0, z = 0) => {
    e.set(x, y, z, 'XYZ');
    R.setFromEuler(e);
    rig.bones[k].quaternion.copy(rig.Pinv[k]).multiply(R).multiply(rig.P[k]).multiply(rig.rest[k]);
  };

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const p = pose.current;
    if (anim) {
      // Mixamo clips: pick one for the pose and cross-fade.
      const a = anim.actions;
      const role: ClipRole = p.mode === 'type' ? 'type'
        : p.mode === 'sit' ? (p.talking && a.sitTalk ? 'sitTalk' : 'sit')
        : p.mode === 'walk' ? 'walk'
        : p.mode === 'run' ? (a.run ? 'run' : 'walk')
        : p.mode === 'air' ? (a.jump ? 'jump' : 'idle')
        : p.gesture && a[p.gesture] ? p.gesture
        : p.talking && a.talk ? 'talk' : 'idle';
      const next = a[role] ?? a.idle!;
      if (next !== anim.current) {
        anim.current?.fadeOut(0.3);
        next.reset().setEffectiveWeight(1).fadeIn(0.3).play();
        anim.current = next;
      }
      rig.wrapper.position.y = 0;
      anim.mixer.update(dt);
      return;
    }
    const b = blend.current;
    const k = 1 - Math.exp(-dt * 9);
    const sitting = p.mode === 'sit' || p.mode === 'type';
    b.sit += ((sitting ? 1 : 0) - b.sit) * k;
    b.walk += ((p.mode === 'walk' || p.mode === 'run' ? 1 : 0) - b.walk) * k;
    b.run += ((p.mode === 'run' ? 1 : 0) - b.run) * k;
    b.type += ((p.mode === 'type' ? 1 : 0) - b.type) * k;
    b.air += ((p.mode === 'air' ? 1 : 0) - b.air) * k * 1.5;
    b.talk += ((p.talking ? 1 : 0) - b.talk) * k;
    phase.current += dt * (6.2 + 3.5 * b.run);
    const ph = phase.current;
    const stride = (0.5 + 0.25 * b.run) * b.walk;
    const s = Math.sin(ph) * stride;
    const breathe = Math.sin(ph * 0.35) * 0.015;

    // Hips down onto the chair; a small bob when walking.
    rig.wrapper.position.y = (SEAT_H + 0.1 - rig.pelvisY) * b.sit + Math.abs(Math.cos(ph)) * 0.04 * b.walk;

    // Legs: thighs forward (−x), knees bend (+x).
    const sitThigh = -1.5 * b.sit, sitKnee = 1.5 * b.sit;
    set('thighL', -s + sitThigh - 0.7 * b.air);
    set('thighR', s + sitThigh - 0.2 * b.air);
    set('calfL', Math.max(0, Math.sin(ph + 1.3)) * 0.9 * b.walk + sitKnee + 0.9 * b.air);
    set('calfR', Math.max(0, -Math.sin(ph + 1.3)) * 0.9 * b.walk + sitKnee + 0.4 * b.air);

    // Torso
    const lean = 0.06 * b.walk + 0.1 * b.run + 0.1 * b.type + 0.03 * b.sit;
    set('spine1', lean * 0.5 + breathe);
    set('spine2', lean * 0.3);
    set('spine3', lean * 0.2);

    // Arms: T-pose → down at the sides (z), then forward (x). Elbows bend around y.
    const down = 1.22;
    const talkL = b.talk * (1 - b.type) * Math.sin(ph * 0.9) * 0.25;
    const typeOsc = Math.sin(ph * 3.1) * 0.05 * b.type;
    const armFwdL = -s * 0.8 * (1 - b.sit) - 0.95 * b.type - 0.45 * b.sit * (1 - b.type) - 1.2 * b.air + talkL;
    const armFwdR = s * 0.8 * (1 - b.sit) - 0.95 * b.type - 0.45 * b.sit * (1 - b.type) - 1.2 * b.air - typeOsc - b.talk * (1 - b.type) * (0.35 + Math.sin(ph * 1.4) * 0.2);
    set('armL', armFwdL + typeOsc, 0, -down + 0.15 * b.type + 0.3 * b.air);
    set('armR', armFwdR, 0, down - 0.15 * b.type - 0.3 * b.air);
    const elbow = 0.25 + 0.2 * b.walk + 0.55 * b.type + 0.55 * b.sit * (1 - b.type) + b.talk * 0.5;
    set('foreL', 0, -elbow);
    set('foreR', 0, elbow + b.talk * (1 - b.type) * 0.3);

    // Head: nods while talking, looks down at the keyboard while typing.
    set('neck', 0.05 * b.type);
    set('head', 0.08 * b.type + b.talk * Math.sin(ph * 1.9) * 0.06, b.talk * Math.sin(ph * 0.7) * 0.15);
  });

  return <primitive object={rig.wrapper} visible={visible} />;
}
