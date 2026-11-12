// Boshliq rejimi: siz ofis bo'ylab yurasiz (WASD), kamera orqangizdan ergashadi (3-shaxs),
// stolga yaqinlashsangiz monitordagi loglarni ochib ko'rasiz (E).
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useOffice, positions } from './store.js';
import Person from './Person.jsx';

const WALK = 3.2;
const RUN = 5.6;
const R = 0.28; // to'qnashuv radiusi
const BOSS_LOOK = { skin: '#e8b98f', hair: '#1b1b1f', pants: '#1e2533', trim: '#fff' };
const greeted = {};

const keys = {};
const typing = (e) => /input|textarea|select/i.test(e.target?.tagName ?? '');

function canStand(L, x, z) {
  for (const [dx, dz] of [[-R, -R], [R, -R], [-R, R], [R, R]]) {
    if (!L.isFree(Math.round(x + dx), Math.round(z + dz))) return false;
  }
  return true;
}

// Monitorlar: stollar (agent loglari), monitoring devori (xizmatlar), majlis ekrani (umumiy lenta)
function screensOf(L, agents) {
  const list = [];
  for (const [deskId, d] of Object.entries(L.desks)) {
    const owner = Object.values(agents).find((a) => a.deskId === deskId);
    if (owner) list.push({ kind: 'desk', id: owner.id, label: owner.name, at: [d.desk[0], d.desk[1] + 0.9] });
  }
  for (const it of L.decor) {
    if (it.type === 'monitorWall') {
      const cx = it.cells.reduce((s, c) => s + c[0], 0) / it.cells.length;
      list.push({ kind: 'services', id: 'services', label: 'Monitoring', at: [cx, it.cells[0][1] + 1] });
    }
  }
  if (L.meeting.screen) list.push({ kind: 'feed', id: 'feed', label: 'Majlis ekrani', at: [L.meeting.screen.x, 14.6] });
  return list;
}

export function BossController() {
  const L = useOffice((s) => s.layout);
  const boss = useOffice((s) => s.boss);
  const bossName = useOffice((s) => s.bossName);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  const root = useRef();
  const pose = useRef({ mode: 'idle', moving: false });
  const lastNear = useRef(null);
  const tmp = useRef(new THREE.Vector3());

  // klaviatura
  useEffect(() => {
    const down = (e) => {
      if (typing(e)) return;
      const k = e.key.toLowerCase();
      keys[k] = true;
      const s = useOffice.getState();
      if (k === 'b' && !s.boss) { s.setBoss(true); return; }
      if (!s.boss) return;
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      if (k === 'e' && s.nearScreen) s.setScreenOpen(!s.screenOpen);
      if (k === 'escape') { if (s.screenOpen) s.setScreenOpen(false); else s.setBoss(false); }
    };
    const up = (e) => { keys[e.key.toLowerCase()] = false; };
    const blur = () => { for (const k in keys) keys[k] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, []);

  // rejimga kirish/chiqish: kamera joylashuvi
  useEffect(() => {
    if (!controls) return;
    if (boss) {
      if (!positions.boss) positions.boss = { x: L.bossStart[0], z: L.bossStart[1], rot: Math.PI / 2 };
      const p = positions.boss;
      const [wx, wz] = L.toWorld([p.x, p.z]);
      controls.target.set(wx, 1.2, wz);
      camera.position.set(wx - Math.sin(p.rot) * 6, 4.6, wz - Math.cos(p.rot) * 6);
      controls.minDistance = 2.5; controls.maxDistance = 16; controls.maxPolarAngle = 1.45;
    } else {
      const f = Math.max(1, L.W / 34);
      controls.target.set(0, 0, 0.5);
      camera.position.set(0, 27 * f, 22 * f);
      controls.minDistance = 8; controls.maxDistance = 45 * f; controls.maxPolarAngle = 1.2;
    }
    controls.update();
  }, [boss, controls, camera, L]);

  useFrame((_, dtRaw) => {
    if (!boss || !root.current || !controls) return;
    const dt = Math.min(dtRaw, 0.1);
    const p = positions.boss;
    const st = useOffice.getState();

    // kameraga nisbatan yo'nalish
    const f = tmp.current.copy(controls.target).sub(camera.position);
    f.y = 0; f.normalize();
    const fx = f.x, fz = f.z;
    const rx = -fz, rz = fx;
    const fwd = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0);
    const side = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
    let mx = fx * fwd + rx * side, mz = fz * fwd + rz * side;
    const len = Math.hypot(mx, mz);
    const run = !!keys.shift;
    let moving = false;
    if (len > 0 && !st.screenOpen) {
      mx /= len; mz /= len;
      const sp = (run ? RUN : WALK) * dt;
      const nx = p.x + mx * sp, nz = p.z + mz * sp;
      if (canStand(L, nx, p.z)) p.x = nx;
      if (canStand(L, p.x, nz)) p.z = nz;
      let diff = Math.atan2(mx, mz) - p.rot;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      p.rot += diff * Math.min(1, dt * 14);
      moving = true;
    }
    pose.current.moving = moving;
    pose.current.run = run;

    const [wx, wz] = L.toWorld([p.x, p.z]);
    root.current.position.set(wx, 0, wz);
    root.current.rotation.y = p.rot;

    // kamera ergashadi
    const k = Math.min(1, dt * 8);
    const dx = (wx - controls.target.x) * k, dz = (wz - controls.target.z) * k, dy = (1.2 - controls.target.y) * k;
    controls.target.x += dx; controls.target.y += dy; controls.target.z += dz;
    camera.position.x += dx; camera.position.y += dy; camera.position.z += dz;

    // yaqin monitor
    let best = null, bestD = 1.9;
    for (const s of screensOf(L, st.agents)) {
      const d = Math.hypot(s.at[0] - p.x, s.at[1] - p.z);
      if (d < bestD) { best = s; bestD = d; }
    }
    const key = best ? `${best.kind}:${best.id}` : null;
    if (key !== lastNear.current) { lastNear.current = key; st.setNearScreen(best); }

    // agentlar salomlashadi
    const now = Date.now();
    for (const a of Object.values(st.agents)) {
      const ap = positions[a.id];
      if (!ap) continue;
      const d = Math.hypot(ap.x - p.x, ap.z - p.z);
      if (d < 1.6) {
        if (['idle', 'talking'].includes(a.state)) ap.rot = Math.atan2(p.x - ap.x, p.z - ap.z);
        if (!greeted[a.id] || now - greeted[a.id] > 25000) {
          greeted[a.id] = now;
          ap.waveUntil = now + 1600;
          const who = st.bossName;
          const text = a.state === 'panic' ? `${who}, yordam bering! ${a.alarm?.text ?? ''}`
            : a.down ? `${who}, ${a.down.service} ${a.down.reason} 😢`
              : a.state === 'working' ? `Salom, ${who}! ${a.task || 'ishlayapman'} ustidaman`
                : `Salom, ${who}! 👋`;
          st.say(a.id, text, 3200, a.state === 'panic' || a.down ? 'error' : '');
        }
      }
    }
  });

  if (!boss) return null;
  return (
    <group ref={root}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
        <ringGeometry args={[0.42, 0.55, 48]} />
        <meshBasicMaterial color="#f0b43a" transparent opacity={0.9} toneMapped={false} />
      </mesh>
      <Person color="#1e2533" look={BOSS_LOOK} pose={pose} headset={false} boss />
      <Html position={[0, 2.05, 0]} center distanceFactor={6} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <div className="tag boss-tag">👔 {bossName} <span className="tag-state">· siz</span></div>
      </Html>
    </group>
  );
}

// ---------- Ekran ustidagi qism (DOM) ----------
const LV = { error: 'err', warn: 'warn', info: '' };

export function BossHud() {
  const { boss, nearScreen, screenOpen, setScreenOpen, setBoss, agents, services, feed } = useOffice();
  if (!boss) return null;
  const agent = nearScreen?.kind === 'desk' ? agents[nearScreen.id] : null;

  return (
    <>
      <div className="boss-help">
        <b>Boshliq rejimi</b>
        <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> yurish</span>
        <span><kbd>Shift</kbd> yugurish</span>
        <span>🖱 kamera</span>
        <span><kbd>E</kbd> monitor</span>
        <button onClick={() => setBoss(false)}>Chiqish <kbd>Esc</kbd></button>
      </div>

      {nearScreen && !screenOpen && (
        <button className="boss-prompt" onClick={() => setScreenOpen(true)}>
          <kbd>E</kbd> {nearScreen.label} monitorini ochish
        </button>
      )}

      {nearScreen && screenOpen && (
        <div className="term-wrap" onClick={() => setScreenOpen(false)}>
          <div className={`term ${agent?.state === 'panic' ? 'panic' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className="term-bar" style={{ background: agent?.state === 'panic' ? '#ff2d3a' : agent?.color ?? '#2b2f36' }}>
              <span className="term-dots"><i /><i /><i /></span>
              <b>{nearScreen.kind === 'desk' ? `${agent?.name} — terminal` : nearScreen.label}</b>
              <button onClick={() => setScreenOpen(false)}>✕</button>
            </div>
            {agent && (
              <div className="term-status">
                <span>holat: <b>{agent.down ? 'ishlamayapti' : agent.state}</b></span>
                <span>vazifa: <b>{agent.task || '—'}</b></span>
                <span>xatolar: <b className={agent.errors ? 'err' : ''}>{agent.errors}</b></span>
                {agent.down && <span className="err">💥 {agent.down.service} {agent.down.reason}</span>}
              </div>
            )}
            <div className="term-body">
              <div className="tl cursor">▋</div>
              {nearScreen.kind === 'desk' && (agent?.log.length ? agent.log.map((l, i) => (
                <div key={i} className={`tl ${LV[l.level] ?? ''}`}><time>{l.time}</time>{l.source && <em>[{l.source}]</em>} {l.text}</div>
              )) : <div className="tl dim">$ hozircha log yo‘q_</div>)}
              {nearScreen.kind === 'services' && (Object.values(services).length ? Object.values(services).map((sv) => (
                <div key={sv.id} className={`tl ${['down', 'unhealthy', 'restarting'].includes(sv.state) ? 'err' : ''}`}>
                  <em>{sv.kind}</em> {sv.name.padEnd(22, ' ')} {sv.state.padEnd(11, ' ')} → {agents[sv.agent]?.name ?? sv.agent} <span className="dim">{sv.detail}</span>
                </div>
              )) : <div className="tl dim">$ kuzatilayotgan xizmat yo‘q_</div>)}
              {nearScreen.kind === 'feed' && feed.map((l, i) => (
                <div key={i} className={`tl ${LV[l.level] ?? ''}`}><time>{l.time}</time><b style={{ color: l.color }}>{l.who}</b> {l.text}</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
