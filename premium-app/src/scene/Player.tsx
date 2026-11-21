// Virtual Life Mode: the user's own avatar. WASD / Shift / Space / E / V, mouse look.
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useOffice } from '../store/useOffice';
import { AGENT_IDS, type AgentId } from '../core/types';
import { PROFILES } from '../core/agents';
import type { Pose } from './Avatar';
import { SyntyAvatar } from './SyntyAvatar';
import { collide, segmentHitsBox } from '../world/nav';
import { INTERACTABLES, WALLS, PLAYER_SPAWN } from '../world/layout';
import { agentBodies, keys, look, nearby, player } from '../world/runtime';
import { labelPortal } from './labels';

const WALK = 3.2, RUN = 6.2, JUMP = 4.6, GRAVITY = 13, RADIUS = 0.32;
const camWalls = WALLS.filter((w) => w.kind !== 'low').map((w) => w.box);
const isTyping = () => {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
};

export function Player() {
  const mode = useOffice((s) => s.mode);
  const style = useOffice((s) => s.cameraStyle);
  const group = useRef<THREE.Group>(null!);
  const pose = useRef<Pose>({ mode: 'stand', talking: false });
  const { gl, camera } = useThree();
  const hintTick = useRef(0);
  const active = mode === 'life';

  // Reset the player at the entrance whenever Virtual Life starts.
  useEffect(() => {
    if (!active) return;
    Object.assign(player, { x: PLAYER_SPAWN.x, z: PLAYER_SPAWN.z, y: 0, vy: 0, yaw: PLAYER_SPAWN.rot, facing: PLAYER_SPAWN.rot, pitch: -0.12, seat: null });
  }, [active]);

  // Keyboard, pointer lock and mouse look.
  useEffect(() => {
    if (!active) return;
    const st = useOffice.getState;
    const down = (e: KeyboardEvent) => {
      if (isTyping()) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', ' ', 'shift', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
      keys.add(k);
      if (k === 'v') st().setCameraStyle(st().cameraStyle === 'third' ? 'first' : 'third');
      if (k === 'e') interact();
      if (k === 'escape' && !look.locked) {
        const s = st();
        if (s.chatWith) s.openChat(null);
        else if (s.modal) s.openModal(null);
        else s.setMenu(!s.menuOpen);
      }
    };
    const up = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const blur = () => keys.clear();
    const canvas = gl.domElement;
    const click = () => {
      const s = st();
      if (s.menuOpen || s.chatWith || s.modal) return;
      try { canvas.requestPointerLock()?.catch?.(() => {}); } catch { /* not supported: drag-to-look still works */ }
    };
    const lockChange = () => {
      const wasLocked = look.locked;
      look.locked = document.pointerLockElement === canvas;
      const s = st();
      if (wasLocked && !look.locked && !s.chatWith && !s.modal) s.setMenu(true);
    };
    let dragging = false;
    const mdown = (e: MouseEvent) => { if (e.button === 0 || e.button === 2) dragging = true; };
    const mup = () => { dragging = false; };
    const move = (e: MouseEvent) => {
      if (!look.locked && !dragging) return;
      const k = look.locked ? 0.0022 : 0.005;
      player.yaw -= e.movementX * k;
      player.pitch = THREE.MathUtils.clamp(player.pitch - e.movementY * k, -1.1, 0.9);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    canvas.addEventListener('click', click);
    canvas.addEventListener('mousedown', mdown);
    window.addEventListener('mouseup', mup);
    window.addEventListener('mousemove', move);
    document.addEventListener('pointerlockchange', lockChange);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      canvas.removeEventListener('click', click);
      canvas.removeEventListener('mousedown', mdown);
      window.removeEventListener('mouseup', mup);
      window.removeEventListener('mousemove', move);
      document.removeEventListener('pointerlockchange', lockChange);
      keys.clear();
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      useOffice.getState().setHint(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, gl]);

  function interact() {
    const s = useOffice.getState();
    if (player.seat) { standUp(); return; }
    if (s.chatWith || s.modal || s.menuOpen || !nearby.id) return;
    if (document.pointerLockElement) document.exitPointerLock();
    if (nearby.kind === 'agent') {
      s.openChat(nearby.id as AgentId);
      return;
    }
    const obj = INTERACTABLES.find((o) => o.id === nearby.id);
    if (!obj) return;
    if (obj.kind === 'computer' && obj.agent) s.select(obj.agent, 'tasks');
    if (obj.kind === 'whiteboard') s.openModal('whiteboard');
    if (obj.kind === 'meeting') s.openModal('meeting');
    if (obj.kind === 'manager') s.openModal('manager');
    if (obj.kind === 'seat' && obj.seat) {
      Object.assign(player, { seat: obj.seat, x: obj.seat.x, z: obj.seat.z, facing: obj.seat.rot, yaw: obj.seat.rot, y: 0, vy: 0 });
    }
  }

  useFrame((_, dtRaw) => {
    if (!active) return;
    const dt = Math.min(dtRaw, 0.05);
    const s = useOffice.getState();
    const frozen = !!(s.chatWith || s.modal || s.menuOpen) || isTyping();

    // Turning with arrow keys (handy without a mouse).
    if (!frozen) {
      if (keys.has('arrowleft')) player.yaw += 2.2 * dt;
      if (keys.has('arrowright')) player.yaw -= 2.2 * dt;
    }

    const fwd = { x: Math.sin(player.yaw), z: Math.cos(player.yaw) };
    const right = { x: -Math.cos(player.yaw), z: Math.sin(player.yaw) };
    let mx = 0, mz = 0;
    if (!frozen) {
      if (keys.has('w') || keys.has('arrowup')) { mx += fwd.x; mz += fwd.z; }
      if (keys.has('s') || keys.has('arrowdown')) { mx -= fwd.x; mz -= fwd.z; }
      if (keys.has('d')) { mx += right.x; mz += right.z; }
      if (keys.has('a')) { mx -= right.x; mz -= right.z; }
    }
    if (player.seat && Math.hypot(mx, mz) > 0.01) standUp();
    const len = player.seat ? 0 : Math.hypot(mx, mz);
    player.running = keys.has('shift');
    player.moving = len > 0.01;
    if (player.moving) {
      const sp = (player.running ? RUN : WALK) * dt;
      const p = collide(player.x + (mx / len) * sp, player.z + (mz / len) * sp, RADIUS);
      player.x = p.x;
      player.z = p.z;
      const targetFacing = Math.atan2(mx, mz);
      let d = ((targetFacing - player.facing + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (d < -Math.PI) d += Math.PI * 2;
      player.facing += d * (1 - Math.exp(-dt * 14));
    }

    // Jump
    const onGround = player.y <= 0.0001;
    if (!frozen && !player.seat && keys.has(' ') && onGround) player.vy = JUMP;
    player.vy -= GRAVITY * dt;
    player.y = Math.max(0, player.y + player.vy * dt);
    if (player.y === 0 && player.vy < 0) player.vy = 0;

    pose.current.mode = player.seat ? 'sit' : player.y > 0.02 ? 'air' : player.moving ? (player.running ? 'run' : 'walk') : 'stand';
    group.current.position.set(player.x, player.y, player.z);
    group.current.rotation.y = style === 'first' ? player.yaw : player.facing;

    // Camera
    const head = new THREE.Vector3(player.x, 1.58 + player.y, player.z);
    const cp = Math.cos(player.pitch), sp2 = Math.sin(player.pitch);
    const dir = new THREE.Vector3(Math.sin(player.yaw) * cp, sp2, Math.cos(player.yaw) * cp);
    let desiredPos: THREE.Vector3, desiredLook: THREE.Vector3;
    if (style === 'first') {
      desiredPos = head.clone().add(new THREE.Vector3(fwd.x * 0.12, 0.04, fwd.z * 0.12));
      desiredLook = desiredPos.clone().add(dir);
    } else {
      let dist = 4.2;
      const back = head.clone().addScaledVector(dir, -dist);
      const t = segmentHitsBox({ x: head.x, z: head.z }, { x: back.x, z: back.z }, camWalls);
      if (t < 1) dist = Math.max(0.6, dist * t - 0.25);
      desiredPos = head.clone().addScaledVector(dir, -dist).add(new THREE.Vector3(0, 0.35, 0));
      desiredPos.y = Math.min(2.75, Math.max(0.35, desiredPos.y)); // stay under the ceiling
      desiredLook = head.clone().addScaledVector(dir, 2).add(new THREE.Vector3(0, 0.1, 0));
    }
    const rig = camera.userData.rig as { pos: THREE.Vector3; look: THREE.Vector3 } | undefined;
    if (rig) { rig.pos.copy(desiredPos); rig.look.copy(desiredLook); }

    // What is in reach?
    hintTick.current += dt;
    if (hintTick.current > 0.1) {
      hintTick.current = 0;
      let best: { kind: 'agent' | 'object'; id: string; d: number; label: string } | null = null;
      for (const id of AGENT_IDS) {
        if (useOffice.getState().agents[id].vacant) continue;
        const b = agentBodies[id];
        const d = Math.hypot(b.x - player.x, b.z - player.z);
        if (d < 2.1 && (!best || d < best.d)) best = { kind: 'agent', id, d, label: `Press E to talk to ${PROFILES[id].name} (${PROFILES[id].role})` };
      }
      for (const o of INTERACTABLES) {
        const d = Math.hypot(o.x - player.x, o.z - player.z);
        if (d < 1.8 && (!best || d < best.d - 0.4)) best = { kind: 'object', id: o.id, d, label: `Press E · ${o.label}${o.agent ? ` (${PROFILES[o.agent].name})` : ''}` };
      }
      nearby.kind = best?.kind ?? null;
      nearby.id = best?.id ?? null;
      s.setHint(frozen ? null : player.seat ? 'Press E to stand up' : best?.label ?? null);
    }
  });

  function standUp() {
    const seat = player.seat;
    if (!seat) return;
    player.seat = null;
    // Step out in front of the seat if there is room (sofa), otherwise behind it (table chairs).
    const out = [0.75, -0.75].map((d) => ({ x: seat.x + Math.sin(seat.rot) * d, z: seat.z + Math.cos(seat.rot) * d }))
      .map((c) => ({ c, p: collide(c.x, c.z, RADIUS) }))
      .find(({ c, p }) => Math.hypot(c.x - p.x, c.z - p.z) < 0.05);
    const p = out ? out.p : collide(seat.x, seat.z, RADIUS);
    player.x = p.x;
    player.z = p.z;
  }

  if (!active) return null;
  return (
    <group ref={group}>
      <SyntyAvatar model="SK_Chr_Business_Male_01" pose={pose} visible={style === 'third'} />
      {style === 'third' && (
        <Html portal={labelPortal} position={[0, 2.25, 0]} center distanceFactor={7}>
          <div className="whitespace-nowrap rounded-full bg-sky-400/90 px-2.5 py-0.5 text-[11px] font-bold text-slate-950">YOU</div>
        </Html>
      )}
    </group>
  );
}
