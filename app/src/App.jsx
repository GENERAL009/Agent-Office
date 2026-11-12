import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, SoftShadows } from '@react-three/drei';
import Office from './Office.jsx';
import Agent from './Agent.jsx';
import { useOffice, BAD } from './store.js';
import { startSim, stopSim } from './sim.js';
import { startLive, stopLive, handleEvent, resolveServer } from './live.js';
import { startSun } from './sun.js';
import { BossController, BossHud } from './Boss.jsx';

const CONN = {
  off: ['Ulanmagan', '#8f9bb3'],
  connecting: ['Ulanmoqda…', '#e0a03a'],
  on: ['Server ulangan', '#4cc38a'],
  error: ['Server topilmadi — Claude’da /agent-office:office yoki /agent-office:doctor', '#ff5a5f'],
};
const STATE_UZ = {
  idle: 'bo‘sh', walking: 'yurmoqda', working: 'ishlamoqda', talking: 'gaplashmoqda', thinking: 'o‘ylamoqda',
  panic: 'XATO!', down: 'ishlamayapti',
};
const SV_UZ = { up: 'ishlayapti', down: 'to‘xtadi', unhealthy: 'sog‘lom emas', restarting: 'qayta yonmoqda', stopped: 'to‘xtatilgan', removed: 'o‘chirilgan' };
const KIND_ICON = { docker: '🐳', terminal: '⌨', file: '📄' };
const hm = (d) => (d ? new Date(d).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—');

// Live rejimni Claude'siz sinash uchun namunaviy hodisalar
const DEMO = [
  { hook: 'SessionStart' },
  { hook: 'Service', id: 'docker:demo-api-1', name: 'demo-api-1', kind: 'docker', agent: 'backend', state: 'up', detail: 'Up 1 second' },
  { hook: 'UserPromptSubmit', prompt: 'Login sahifasi va API qo‘sh' },
  { hook: 'PreToolUse', tool: 'Agent', tool_use_id: 'demo1', input: { subagent_type: 'backend', description: 'Login API yozish' } },
  { hook: 'PreToolUse', tool: 'Read', agent_type: 'backend', input: { file_path: 'src/server/routes.ts' } },
  { hook: 'PreToolUse', tool: 'Agent', tool_use_id: 'demo2', input: { subagent_type: 'frontend', description: 'Login formasi' } },
  { hook: 'PreToolUse', tool: 'Edit', agent_type: 'backend', input: { file_path: 'src/server/auth.ts' } },
  { hook: 'PreToolUse', tool: 'Write', agent_type: 'frontend', input: { file_path: 'src/pages/Login.tsx' } },
  { hook: 'PostToolUseFailure', tool: 'Bash', agent_type: 'backend', input: { command: 'npm test' }, error: 'Exit code 1\nError: Cannot find module \'express\'' },
  { hook: 'Log', agent: 'backend', source: 'demo-api-1', kind: 'docker', level: 'error', text: 'FATAL: database connection lost' },
  { hook: 'Service', id: 'docker:demo-api-1', name: 'demo-api-1', kind: 'docker', agent: 'backend', state: 'down', detail: 'Exited (1) 1 second ago' },
  { hook: 'PostToolUse', tool: 'Agent', tool_use_id: 'demo2' },
  { hook: 'Service', id: 'docker:demo-api-1', name: 'demo-api-1', kind: 'docker', agent: 'backend', state: 'up', detail: 'Up 1 second' },
  { hook: 'PostToolUse', tool: 'Agent', tool_use_id: 'demo1' },
  { hook: 'Stop' },
];

async function runDemo() {
  for (const ev of DEMO) {
    try {
      await fetch(`${await resolveServer()}/event`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(ev) });
      if (useOffice.getState().conn !== 'on') handleEvent(ev);
    } catch {
      handleEvent(ev);
    }
    await new Promise((r) => setTimeout(r, ev.hook === 'Service' && ev.state === 'down' ? 7000 : 1800));
  }
}

function SunRow() {
  const { themeMode, setThemeMode, timeOffsetH, setTimeOffset, sunInfo, sky } = useOffice();
  const icon = sky.alt > 6 ? '☀' : sky.alt > -4 ? '🌅' : '🌙';
  return (
    <div className="sun">
      <div className="sun-top">
        <div className="seg seg3">
          {[['auto', 'Avto'], ['day', 'Kun'], ['night', 'Tun']].map(([k, l]) => (
            <button key={k} className={themeMode === k ? 'on' : ''} onClick={() => setThemeMode(k)}>{l}</button>
          ))}
        </div>
        <span className="sun-alt" title="Quyosh balandligi">{icon} {Math.round(sky.alt)}°</span>
      </div>
      {themeMode === 'auto' && (
        <>
          <div className="sun-info">
            {sunInfo ? (
              <>
                <span>📍 {sunInfo.city || 'Joylashuv'} <em>({sunInfo.source})</em></span>
                <span>↑ {hm(sunInfo.sunrise)} · ↓ {hm(sunInfo.sunset)}</span>
              </>
            ) : <span>Joylashuv aniqlanmoqda…</span>}
          </div>
          <label className="time">
            <span>{timeOffsetH === 0 ? 'Hozir' : `${timeOffsetH > 0 ? '+' : ''}${timeOffsetH} soat`} · {hm(sunInfo?.now)}</span>
            <input type="range" min={-12} max={12} step={0.5} value={timeOffsetH} onChange={(e) => setTimeOffset(Number(e.target.value))} />
            {timeOffsetH !== 0 && <button className="link" onClick={() => setTimeOffset(0)}>Hozirga qaytish</button>}
          </label>
        </>
      )}
    </div>
  );
}

function BossRow() {
  const { boss, setBoss, bossName, setBossName, mode, setTeam, team } = useOffice();
  const [role, setRole] = useState('');
  const add = (e) => {
    e.preventDefault();
    const id = role.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
    if (id) setTeam([...team, { id }]);
    setRole('');
  };
  return (
    <div className="boss-row">
      <button className={`boss-btn ${boss ? 'on' : ''}`} onClick={() => setBoss(!boss)}>
        👔 {boss ? 'Boshliq rejimidan chiqish' : 'Boshliq rejimi'} <kbd>B</kbd>
      </button>
      <div className="boss-name">
        <input value={bossName} onChange={(e) => setBossName(e.target.value)} placeholder="Ismingiz" maxLength={18} title="Boshliq ismi" />
        {mode === 'sim' && (
          <form onSubmit={add} className="add-role">
            <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="+ xodim (flutter)" maxLength={20} />
          </form>
        )}
      </div>
    </div>
  );
}

function Services() {
  const services = useOffice((s) => s.services);
  const agents = useOffice((s) => s.agents);
  const list = Object.values(services).filter((s) => s.state !== 'removed').sort((a, b) => (BAD.has(b.state) - BAD.has(a.state)) || a.name.localeCompare(b.name));
  if (!list.length) return null;
  return (
    <div className="services">
      <h2>Xizmatlar</h2>
      <ul>
        {list.map((sv) => (
          <li key={sv.id} className={`sv sv-${sv.state}`} title={sv.detail}>
            <span className="sv-dot" />
            <span className="sv-icon">{KIND_ICON[sv.kind] ?? '•'}</span>
            <span className="sv-name">{sv.name}</span>
            <span className="sv-agent" style={{ color: agents[sv.agent]?.color }}>{agents[sv.agent]?.name ?? sv.agent}</span>
            <span className="sv-state">{SV_UZ[sv.state] ?? sv.state}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Panel() {
  const { mode, conn, agents, selected, feed, setMode, select, muted, toggleMute, clearErrors } = useOffice();
  const list = Object.values(agents);
  const sel = selected && agents[selected];
  const [connText, connColor] = CONN[conn];
  const working = list.filter((a) => a.state === 'working').length;
  const bad = list.filter((a) => a.state === 'panic' || a.down).length;

  return (
    <aside className="panel">
      <div className="brand">
        <div className="brand-row">
          <div>
            <h1>Agent Ofisi</h1>
            <p className="sub">
              {working} ta ishlamoqda · {list.length} jami
              {bad > 0 && <b className="sub-bad"> · {bad} ta muammo</b>}
            </p>
          </div>
          <button className="icon-btn" onClick={toggleMute} title={muted ? 'Ovozni yoqish' : 'Ovozni o‘chirish'}>{muted ? '🔕' : '🔔'}</button>
        </div>
        <div className="seg" role="tablist">
          <button className={mode === 'sim' ? 'on' : ''} onClick={() => setMode('sim')}>Simulyatsiya</button>
          <button className={mode === 'live' ? 'on' : ''} onClick={() => setMode('live')}>Live</button>
        </div>
        {mode === 'live' && (
          <div className="conn">
            <span className="dot" style={{ background: connColor }} />
            {connText}
            <button className="link" onClick={runDemo}>Sinov hodisalari</button>
          </div>
        )}
        <BossRow />
        <SunRow />
      </div>

      <div className="scroll">
        <div className="agents">
          {list.map((a) => {
            const isBad = a.state === 'panic' || a.down;
            return (
              <button key={a.id} className={`agent-row ${selected === a.id ? 'sel' : ''} ${isBad ? 'bad' : ''}`} onClick={() => select(a.id)}>
                <span className="dot" style={{ background: a.color }} />
                <span className="nm">
                  {a.name}
                  {a.errors > 0 && (
                    <span className="err-count" onClick={(e) => { e.stopPropagation(); clearErrors(a.id); }} title="Xatolar soni (bosib tozalash)">{a.errors}</span>
                  )}
                </span>
                <span className={`st st-${a.down ? 'down' : a.state}`}>{a.down ? 'ishlamayapti' : STATE_UZ[a.state] ?? a.state}</span>
                <span className="task">
                  {a.down ? `💥 ${a.down.service} ${a.down.reason}` : a.state === 'panic' ? `🔥 ${a.alarm?.text}` : a.task || '—'}
                </span>
              </button>
            );
          })}
        </div>

        <Services />

        <div className="log">
          <h2>{sel ? `${sel.name} — oxirgi harakatlar` : 'Hodisalar'}</h2>
          <ul>
            {(sel ? sel.log.map((l) => ({ ...l, who: sel.name, color: sel.color })) : feed).map((l, i) => (
              <li key={i} className={`lv-${l.level}`}>
                <time>{l.time}</time>
                <b style={{ color: l.color }}>{l.who}</b>
                <span>{l.source && <i className="src">{l.source}</i>}{l.text}</span>
              </li>
            ))}
            {!(sel ? sel.log : feed).length && <li className="empty">Hozircha hech narsa yo‘q</li>}
          </ul>
        </div>
      </div>
    </aside>
  );
}

// Sahna ustidagi qizil ogohlantirish
function AlertBanner() {
  const agents = useOffice((s) => s.agents);
  const select = useOffice((s) => s.select);
  const issues = Object.values(agents).filter((a) => a.state === 'panic' || a.down);
  if (!issues.length) return null;
  return (
    <div className="alerts">
      {issues.map((a) => (
        <button key={a.id} className={`alert ${a.down ? 'down' : 'panic'}`} onClick={() => select(a.id)}>
          <span className="alert-dot" />
          <b>{a.name}</b>
          <span>{a.down ? `${a.down.service} ${a.down.reason} — dam olish xonasida` : a.alarm?.text}</span>
        </button>
      ))}
    </div>
  );
}

function Lights() {
  const sky = useOffice((s) => s.sky);
  const W = useOffice((s) => s.layout.W);
  const half = W / 2 + 4;
  const [dx, dy, dz] = sky.sunDir;
  return (
    <>
      <SoftShadows size={18} samples={10} focus={0.5} />
      <fog attach="fog" args={[sky.horizon, 45 + W, 90 + W * 2]} />
      <ambientLight intensity={sky.ambient} color={sky.ambientColor} />
      <hemisphereLight args={[sky.hemiTop, sky.hemiBottom, sky.hemiI]} />
      <directionalLight
        position={[dx * (half + 10), dy * (half + 10), dz * (half + 10)]}
        intensity={sky.sunI}
        color={sky.sunColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-camera-left={-half}
        shadow-camera-right={half}
        shadow-camera-top={half}
        shadow-camera-bottom={-half}
        shadow-camera-far={half * 4}
      />
      {/* oy nuri */}
      <directionalLight position={[-12, 24, -10]} intensity={sky.moonI} color="#9fb6ff" />
    </>
  );
}

export default function App() {
  const mode = useOffice((s) => s.mode);
  const ids = useOffice((s) => Object.keys(s.agents).join(','));
  const sky = useOffice((s) => s.sky);

  useEffect(() => {
    startSun();
    // jamoa: loyiha sozlamasi yoki .claude/agents (server ishlayotgan bo'lsa)
    resolveServer().then((base) => fetch(`${base}/team`, { signal: AbortSignal.timeout(1500) }))
      .then((r) => r.json())
      .then((j) => { if (Array.isArray(j.team) && j.team.length) useOffice.getState().setTeam(j.team, { replace: true }); if (j.project) useOffice.setState({ project: j.project }); })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (mode === 'sim') { stopLive(); startSim(); }
    else { stopSim(); startLive(); }
    return () => { stopSim(); stopLive(); };
  }, [mode]);

  return (
    <div className={`app ${sky.lamps > 0.5 ? 'night' : 'day'}`}>
      <div className="stage" style={{ background: `linear-gradient(180deg, ${sky.top} 0%, ${sky.horizon} 70%)` }}>
        <Canvas
          shadows
          dpr={[1, 2]}
          gl={{ alpha: true }}
          camera={{ position: [0, 27, 22], fov: 42, far: 400 }}
          onPointerMissed={() => { const s = useOffice.getState(); if (s.selected) s.select(s.selected); }}
        >
          <Lights />
          <Office />
          {ids.split(',').map((id) => <Agent key={id} id={id} />)}
          <OrbitControls makeDefault target={[0, 0, 0.5]} maxPolarAngle={1.2} minDistance={8} maxDistance={45} enableDamping dampingFactor={0.08} />
          <BossController />
        </Canvas>
        <AlertBanner />
        <BossHud />
      </div>
      <Panel />
    </div>
  );
}
