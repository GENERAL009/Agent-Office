// Walks each agent to wherever the data source wants it, and animates the right pose.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useOffice } from '../store/useOffice';
import { AGENT_IDS, type Agent, type AgentId } from '../core/types';
import { STATUS_COLOR, STATUS_LABEL } from '../core/agents';
import type { Pose } from './Avatar';
import { SyntyAvatar } from './SyntyAvatar';
import { COFFEE_SPOTS, MEETING_SEATS, SOC_SPOTS, WHITEBOARD_SPOT, deskSeat, visitSpot, type Spot } from '../world/layout';
import { findPath, type P } from '../world/nav';
import { agentBodies, nearby, player } from '../world/runtime';
import { labelPortal } from './labels';

import { SEAT_MODEL as MODELS } from '../core/plugin/team';

function spotFor(a: Agent): { spot: Spot; seated: boolean } {
  switch (a.place) {
    case 'meeting': return { spot: MEETING_SEATS[a.seat ?? 0], seated: true };
    case 'whiteboard': return { spot: WHITEBOARD_SPOT, seated: false };
    case 'coffee': return { spot: COFFEE_SPOTS[AGENT_IDS.indexOf(a.id) % COFFEE_SPOTS.length], seated: false };
    case 'security': return { spot: SOC_SPOTS[AGENT_IDS.indexOf(a.id) % SOC_SPOTS.length], seated: false };
    case 'visit': return { spot: visitSpot(a.visiting ?? 'developer'), seated: false };
    default: return { spot: deskSeat(a.id), seated: true };
  }
}

const LABEL_STYLE = { pointerEvents: 'none' } as const;

const angleLerp = (a: number, b: number, k: number) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
};

function AgentFigure({ id }: { id: AgentId }) {
  const agent = useOffice((s) => s.agents[id]);
  const selected = useOffice((s) => s.selectedId === id);
  const speed = useOffice((s) => s.speed);
  const select = useOffice((s) => s.select);
  const lastLine = useOffice((s) => {
    for (let i = s.messages.length - 1; i >= 0; i--) {
      const m = s.messages[i];
      if (m.from === id) return m.text;
    }
    return '';
  });
  const group = useRef<THREE.Group>(null!);
  const pose = useRef<Pose>({ mode: 'sit', talking: false });
  const path = useRef<P[]>([]);
  const target = useRef<{ spot: Spot; seated: boolean }>(spotFor(agent));

  const { spot, seated } = spotFor(agent);
  const key = `${spot.x},${spot.z},${spot.rot}`;
  const setArrived = (v: boolean) => {
    if (useOffice.getState().agents[id].arrived !== v) useOffice.getState().dispatch({ type: 'agent.patch', id, patch: { arrived: v } });
  };
  useEffect(() => {
    target.current = { spot, seated };
    const b = agentBodies[id];
    if (Math.hypot(b.x - spot.x, b.z - spot.z) > 0.05) {
      path.current = findPath(b, spot);
      setArrived(false);
    } else if (!path.current.length) {
      setArrived(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const b = agentBodies[id];
    const st = useOffice.getState();

    // Someone came to talk: stop, turn to them, and stay until the conversation ends.
    const near = st.mode === 'life' && Math.hypot(player.x - b.x, player.z - b.z) < 2.2;
    const engaged = st.mode === 'life' && (st.chatWith === id || (near && nearby.kind === 'agent' && nearby.id === id));
    const walking = path.current.length > 0;

    if (engaged && (walking || !target.current.seated)) {
      b.rot = angleLerp(b.rot, Math.atan2(player.x - b.x, player.z - b.z), 1 - Math.exp(-dt * 8));
      pose.current.mode = 'stand';
    } else if (walking) {
      const walkSpeed = 1.5 * Math.min(Math.max(speed, 1), 3);
      const next = path.current[0];
      const dx = next.x - b.x, dz = next.z - b.z;
      const dist = Math.hypot(dx, dz);
      const step = walkSpeed * dt;
      if (dist <= step) {
        b.x = next.x; b.z = next.z;
        path.current.shift();
        if (!path.current.length) setArrived(true);
      } else {
        b.x += (dx / dist) * step;
        b.z += (dz / dist) * step;
        b.rot = angleLerp(b.rot, Math.atan2(dx, dz), 1 - Math.exp(-dt * 12));
      }
      pose.current.mode = 'walk';
    } else {
      if (!st.agents[id].arrived && Math.hypot(b.x - target.current.spot.x, b.z - target.current.spot.z) < 0.05) setArrived(true);
      b.rot = angleLerp(b.rot, target.current.spot.rot, 1 - Math.exp(-dt * 8));
      const working = agent.status === 'working' && agent.place === 'desk' && st.chatWith !== id;
      pose.current.mode = target.current.seated ? (working ? 'type' : 'sit') : 'stand';
    }
    pose.current.talking = agent.speaking;
    pose.current.gesture = agent.place === 'coffee' && !walking ? 'drink' : agent.status === 'completed' && !walking ? 'clap' : engaged && !target.current.seated ? 'wave' : null;
    group.current.position.set(b.x, 0, b.z);
    group.current.rotation.y = b.rot;
  });

  const ring = useMemo(() => new THREE.MeshBasicMaterial({ color: agent.color, transparent: true, opacity: 0.85, toneMapped: false }), [agent.color]);
  const click = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); select(id); };

  return (
    <group ref={group} onClick={click} onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')}>
      <SyntyAvatar model={MODELS[id]} pose={pose} wear={id === 'developer' ? ['Nametag', 'Headset'] : ['Nametag']} />
      {/* invisible, larger hit box */}
      <mesh position={[0, 0.9, 0]} visible={false}>
        <boxGeometry args={[0.7, 1.8, 0.7]} />
      </mesh>
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} material={ring}>
          <ringGeometry args={[0.5, 0.6, 48]} />
        </mesh>
      )}
      <Html portal={labelPortal} position={[0, 2.2, 0]} center distanceFactor={9} zIndexRange={[20, 0]} style={LABEL_STYLE}>
        <div className="flex flex-col items-center gap-1 select-none">
          {agent.speaking && lastLine && (
            <div className="max-w-[260px] rounded-xl bg-white/95 px-3 py-1.5 text-[13px] leading-snug text-slate-900 shadow-lg" style={{ width: 'max-content' }}>
              {lastLine.length > 110 ? lastLine.slice(0, 108) + '…' : lastLine}
            </div>
          )}
          <div className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/10 bg-slate-950/80 px-2.5 py-1 text-[12px] font-semibold text-white shadow">
            <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[agent.status], boxShadow: `0 0 8px ${STATUS_COLOR[agent.status]}` }} />
            {agent.name}
            <span className="font-normal text-slate-400">· {STATUS_LABEL[agent.status]}</span>
          </div>
        </div>
      </Html>
    </group>
  );
}

export function Agents() {
  const ids = useOffice((s) => AGENT_IDS.filter((id) => !s.agents[id].vacant).join(','));
  useEffect(() => {
    // an empty seat must not block anyone walking around
    for (const id of AGENT_IDS) if (!ids.split(',').includes(id)) Object.assign(agentBodies[id], { x: 1e4, z: 1e4 });
  }, [ids]);
  return <>{ids.split(',').filter(Boolean).map((id) => <AgentFigure key={id} id={id as AgentId} />)}</>;
}
