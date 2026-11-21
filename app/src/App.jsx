import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, SoftShadows } from '@react-three/drei';
import Office from './Office.jsx';
import Agent from './Agent.jsx';
import { useOffice } from './store.js';
import { SEV, SEV_LOWER, LEVELS, rank, visibleSev, atLeast, maxSev } from './severity.js';
import { tr, lang, setLang, LANGS, LOCALE, STATE_LABEL, SERVICE_LABEL } from './i18n.js';
import { startSim, stopSim } from './sim.js';
import { startLive, stopLive, handleEvent, resolveServer } from './live.js';
import { startSun } from './sun.js';
import { BossController, BossHud } from './Boss.jsx';
import { replayUrl, startReplay, stopReplay } from './replay.js';
import { SkyBackdrop, StudioLight, Effects, CinemaCamera } from './Look.jsx';

const CONN = {
  off: [tr('Not connected'), '#8f9bb3'],
  connecting: [tr('Connecting…'), '#e0a03a'],
  on: [tr('Server connected'), '#4cc38a'],
  replay: [tr('Replaying a recording'), '#7c9cff'],
  error: [tr('Server not found — run /agent-office:office or /agent-office:doctor in Claude'), '#ff5a5f'],
};
const KIND_ICON = { docker: '🐳', terminal: '⌨', file: '📄' };
const hm = (d) => (d ? new Date(d).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' }) : '—');

// Live rejimni Claude'siz sinash uchun namunaviy hodisalar
const DEMO = [
  { hook: 'SessionStart' },
  { hook: 'Service', id: 'docker:demo-api-1', name: 'demo-api-1', kind: 'docker', agent: 'backend', state: 'up', detail: 'Up 1 second' },
  { hook: 'UserPromptSubmit', prompt: tr('Add a login page and an API') },
  { hook: 'PreToolUse', tool: 'Agent', tool_use_id: 'demo1', input: { subagent_type: 'backend', description: tr('Write the login API') } },
  { hook: 'PreToolUse', tool: 'Read', agent_type: 'backend', input: { file_path: 'src/server/routes.ts' } },
  { hook: 'PreToolUse', tool: 'Agent', tool_use_id: 'demo2', input: { subagent_type: 'frontend', description: tr('Login form') } },
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
          {[['auto', tr('Auto')], ['day', tr('Day')], ['night', tr('Night')]].map(([k, l]) => (
            <button key={k} className={themeMode === k ? 'on' : ''} onClick={() => setThemeMode(k)}>{l}</button>
          ))}
        </div>
        <span className="sun-alt" title={tr('Sun height')}>{icon} {Math.round(sky.alt)}°</span>
      </div>
      {themeMode === 'auto' && (
        <>
          <div className="sun-info">
            {sunInfo ? (
              <>
                <span>📍 {sunInfo.city || tr('Location')} <em>({tr(sunInfo.source)})</em></span>
                <span>↑ {hm(sunInfo.sunrise)} · ↓ {hm(sunInfo.sunset)}</span>
              </>
            ) : <span>{tr('Finding your location…')}</span>}
          </div>
          <label className="time">
            <span>{timeOffsetH === 0 ? tr('Now') : tr('{n} h', { n: `${timeOffsetH > 0 ? '+' : ''}${timeOffsetH}` })} · {hm(sunInfo?.now)}</span>
            <input type="range" min={-12} max={12} step={0.5} value={timeOffsetH} onChange={(e) => setTimeOffset(Number(e.target.value))} />
            {timeOffsetH !== 0 && <button className="link" onClick={() => setTimeOffset(0)}>{tr('Back to now')}</button>}
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
        👔 {boss ? tr('Leave boss mode') : tr('Boss mode')} <kbd>B</kbd>
      </button>
      <div className="boss-name">
        <input value={bossName} onChange={(e) => setBossName(e.target.value)} placeholder={tr('Your name')} maxLength={18} title={tr('Boss name')} />
        {mode === 'sim' && (
          <form onSubmit={add} className="add-role">
            <input value={role} onChange={(e) => setRole(e.target.value)} placeholder={tr('+ teammate (flutter)')} maxLength={20} />
          </form>
        )}
      </div>
    </div>
  );
}

// Faol muammolar darajalar bo'yicha: agentlarning guruhlangan muammolari + nosoz xizmatlar
function useCounts() {
  const issues = useOffice((s) => s.issues);
  const services = useOffice((s) => s.services);
  const c = { minor: 0, moderate: 0, major: 0, critical: 0 };
  for (const is of Object.values(issues)) if (c[is.severity] !== undefined) c[is.severity]++;
  for (const sv of Object.values(services)) if (c[sv.severity] !== undefined) c[sv.severity]++;
  return c;
}

function Counts() {
  const c = useCounts();
  const items = ['critical', 'major', 'moderate', 'minor'].filter((k) => c[k]);
  if (!items.length) return <p className="sub sub-ok">{tr('No problems')}</p>;
  return (
    <p className="counts">
      {items.map((k) => (
        <span key={k} className={`count sev-${k}`}><i />{c[k]} {SEV_LOWER[k]}</span>
      ))}
    </p>
  );
}

const PANIC_OPTS = [['minor', tr('Minor')], ['moderate', tr('Moderate')], ['major', tr('Major')], ['critical', tr('Critical')]];
const SOUND_OPTS = [['off', tr('Off')], ['major', tr('Major')], ['critical', tr('Critical')]];
const COLOR_OPTS = [['status', tr('By status')], ['red', tr('Red only')]];
const FEED_OPTS = [['info', tr('All')], ['minor', tr('Minor+')], ['moderate', tr('Moderate+')], ['major', tr('Major+')]];

function Choice({ id, label, hint, value, options, onChange }) {
  return (
    <div className="choice" role="group" aria-labelledby={`${id}-l`}>
      <span id={`${id}-l`} className="choice-label">{label}{hint && <em>{hint}</em>}</span>
      <div className="seg seg-sm" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
        {options.map(([v, l]) => (
          <button key={v} type="button" className={value === v ? 'on' : ''} aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>
        ))}
      </div>
    </div>
  );
}

function ErrorSettings() {
  const { settings, setSetting, resetSettings, serverSeverity } = useOffice();
  const [open, setOpen] = useState(() => { try { return localStorage.getItem('agent-office-errors-open') === '1'; } catch { return false; } });
  const toggle = () => { setOpen(!open); try { localStorage.setItem('agent-office-errors-open', open ? '0' : '1'); } catch {} };
  const fromProject = Object.keys(serverSeverity || {}).length > 0;
  return (
    <div className={`errs ${open ? 'open' : ''}`}>
      <button type="button" className="errs-head" onClick={toggle} aria-expanded={open}>
        <b>{tr('Errors')}</b>
        <span className="legend" aria-label={tr('Color key')}>
          {['minor', 'moderate', 'major', 'critical'].map((k) => <i key={k} className={`sev-${k}`} title={SEV[k].label} />)}
        </span>
        <span className="errs-sum">{tr('panic at: {x}', { x: SEV[settings.panicAt].label.toLowerCase() })}</span>
        <span className="chev">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="errs-body">
          <Choice id="panicAt" label={tr('Panic threshold')} hint={tr('red light, siren, lounge')} value={settings.panicAt} options={PANIC_OPTS} onChange={(v) => setSetting('panicAt', v)} />
          <Choice id="colorMode" label={tr('Color mode')} value={settings.colorMode} options={COLOR_OPTS} onChange={(v) => setSetting('colorMode', v)} />
          <Choice id="sound" label={tr('Sound')} hint={tr('alarm from this level')} value={settings.sound} options={SOUND_OPTS} onChange={(v) => setSetting('sound', v)} />
          <Choice id="feedMin" label={tr('Event feed')} hint={tr('hide below')} value={settings.feedMin} options={FEED_OPTS} onChange={(v) => setSetting('feedMin', v)} />
          <ul className="legend-list">
            {LEVELS.map((k) => (
              <li key={k}><i className={`sev-${k}`} /><b>{SEV[k].label}</b><span>{LEGEND[k]}</span></li>
            ))}
          </ul>
          <div className="errs-foot">
            <span>{fromProject ? tr('Defaults: .agent-office.json') : tr('Saved in this browser')}</span>
            <button type="button" className="link" onClick={resetSettings}>{tr('Reset to defaults')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

const LEGEND = {
  info: tr('plain log, 2xx/3xx/404'),
  minor: tr('warning, retry, timeout, 4xx'),
  moderate: tr('ERROR line, failed tool, 5xx'),
  major: 'Traceback, …Error:, unhealthy, exit ≠ 0',
  critical: tr('FATAL, PANIC, OOM, DB auth, container crashed'),
};

function Services() {
  const services = useOffice((s) => s.services);
  const agents = useOffice((s) => s.agents);
  const settings = useOffice((s) => s.settings);
  const list = Object.values(services).filter((s) => s.state !== 'removed').sort((a, b) => (rank(b.severity) - rank(a.severity)) || a.name.localeCompare(b.name));
  if (!list.length) return null;
  return (
    <div className="services">
      <h2>{tr('Services')}</h2>
      <ul>
        {list.map((sv) => (
          <li key={sv.id} className={`sv sv-${sv.state} ${visibleSev(sv.severity, settings) ? `sev-${visibleSev(sv.severity, settings)}` : ''}`} title={sv.detail}>
            <span className="sv-dot" />
            <span className="sv-icon">{KIND_ICON[sv.kind] ?? '•'}</span>
            <span className="sv-name">{sv.name}</span>
            <span className="sv-agent" style={{ color: agents[sv.agent]?.color }}>{agents[sv.agent]?.name ?? sv.agent}</span>
            <span className="sv-state">{SERVICE_LABEL(sv.state)}{sv.restarts > 1 ? ` ×${sv.restarts}` : ''}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// The premium office (built from the user's own Synty pack with /agent-office:premium)
function PremiumLink() {
  const [ready, setReady] = useState(null);
  useEffect(() => {
    resolveServer().then((base) => fetch(`${base}/health`, { signal: AbortSignal.timeout(1500) })).then((r) => r.json())
      .then((j) => setReady(!!j.premium)).catch(() => setReady(null));
  }, []);
  if (ready === null) return null;
  return ready
    ? <a className="premium-link" href="/premium/">✦ {tr('Open the premium office')} ↗</a>
    : <p className="premium-hint">✦ {tr('Premium 3D office: run /agent-office:premium')}</p>;
}

function Panel() {
  const { mode, conn, agents, selected, feed, setMode, select, muted, toggleMute, clearErrors, replayInfo } = useOffice();
  const isReplay = !!replayInfo;
  const list = Object.values(agents);
  const sel = selected && agents[selected];
  const [connText, connColor] = CONN[conn];
  const working = list.filter((a) => a.state === 'working').length;
  const settings = useOffice((s) => s.settings);

  return (
    <aside className="panel">
      <div className="brand">
        <div className="brand-row">
          <div>
            <h1>{tr('Agent Office')}</h1>
            <p className="sub">{tr('{n} working · {m} total', { n: working, m: list.length })}</p>
            <Counts />
          </div>
          <div className="lang" role="group" aria-label={tr('Language')}>
            {LANGS.map((l) => <button key={l} className={lang === l ? 'on' : ''} onClick={() => lang !== l && setLang(l)}>{l.toUpperCase()}</button>)}
          </div>
          <button className="icon-btn" onClick={toggleMute} title={muted ? tr('Unmute') : tr('Mute')}>{muted ? '🔕' : '🔔'}</button>
        </div>
        {isReplay && (
          <div className="replay-card">
            <b>▶ {replayInfo.title}</b>
            <span>{replayInfo.recordedAt} · {tr('real hook events')}</span>
            <div className="replay-bar"><i style={{ width: `${(100 * replayInfo.at) / Math.max(1, replayInfo.total)}%` }} /></div>
          </div>
        )}
        {!isReplay && (
        <div className="seg" role="tablist">
          <button className={mode === 'sim' ? 'on' : ''} onClick={() => setMode('sim')}>{tr('Simulation')}</button>
          <button className={mode === 'live' ? 'on' : ''} onClick={() => setMode('live')}>Live</button>
        </div>
        )}
        {mode === 'live' && !isReplay && (
          <div className="conn">
            <span className="dot" style={{ background: connColor }} />
            {connText}
            <button className="link" onClick={runDemo}>{tr('Test events')}</button>
          </div>
        )}
        <PremiumLink />
        <BossRow />
        <ErrorSettings />
        <SunRow />
      </div>

      <div className="scroll">
        <div className="agents">
          {list.map((a) => {
            const isBad = a.state === 'panic' || a.down;
            const vis = visibleSev(isBad ? maxSev(maxSev(a.sev ?? 'info', a.down?.severity ?? 'info'), a.alarm?.severity ?? 'major') : a.sev, settings);
            return (
              <button key={a.id} className={`agent-row ${selected === a.id ? 'sel' : ''} ${isBad ? 'bad' : ''} ${vis ? `sev-${vis}` : ''}`} onClick={() => select(a.id)}>
                <span className="dot" style={{ background: a.color }} />
                <span className="nm">
                  {a.name}
                  {a.errors > 0 && (
                    <span className="err-count" onClick={(e) => { e.stopPropagation(); clearErrors(a.id); }} title={tr('Error count (click to clear)')}>{a.errors}</span>
                  )}
                </span>
                <span className={`st st-${a.down ? 'down' : a.state} ${vis ? `sev-${vis}` : ''}`}>{a.down ? STATE_LABEL('down') : a.state === 'panic' ? (SEV[vis ?? 'major'].label + '!') : vis ? SEV[vis].label.toLowerCase() : STATE_LABEL(a.state)}</span>
                <span className="task">
                  {a.down ? `💥 ${a.down.service} ${a.down.reason}` : a.state === 'panic' ? `🔥 ${a.alarm?.text}` : a.task || '—'}
                </span>
              </button>
            );
          })}
        </div>

        <Services />

        <div className="log">
          <h2>{sel ? tr('{name} — recent activity', { name: sel.name }) : tr('Events')}</h2>
          <ul>
            {(() => {
              const rows = (sel ? sel.log.map((l) => ({ ...l, who: sel.name, color: sel.color })) : feed)
                .filter((l) => atLeast(l.severity ?? 'info', settings.feedMin));
              if (!rows.length) return <li className="empty">{settings.feedMin === 'info' ? tr('Nothing yet') : tr('No {level} or higher events', { level: SEV[settings.feedMin].label.toLowerCase() })}</li>;
              return rows.map((l, i) => {
                const vis = visibleSev(l.severity, settings);
                return (
                  <li key={l.key ? `${l.key}` : i} className={vis ? `sev-${vis}` : ''}>
                    <time>{l.time}</time>
                    <b style={{ color: l.color }}>{l.who}</b>
                    <span>
                      {vis && <i className="sev-tag">{SEV[vis].label}</i>}
                      {l.source && <i className="src">{l.source}</i>}{l.text}
                      {l.count > 1 && <i className="rep">×{l.count}</i>}
                    </span>
                  </li>
                );
              });
            })()}
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
  const settings = useOffice((s) => s.settings);
  const issues = Object.values(agents)
    .filter((a) => a.state === 'panic' || a.down)
    .map((a) => ({ a, sev: maxSev(maxSev(a.sev ?? 'info', a.down?.severity ?? 'info'), a.alarm?.severity ?? 'major') }))
    .sort((x, y) => rank(y.sev) - rank(x.sev));
  if (!issues.length) return null;
  return (
    <div className="alerts">
      {issues.map(({ a, sev }) => (
        <button key={a.id} className={`alert ${a.down ? 'down' : 'panic'} sev-${visibleSev(sev, settings) ?? 'major'}`} onClick={() => select(a.id)}>
          <span className="alert-dot" />
          <b>{a.name}</b>
          <em className="alert-sev">{SEV[sev]?.label}</em>
          <span>{a.down ? tr('{service} {reason} — in the lounge', { service: a.down.service, reason: a.down.reason }) : a.alarm?.text}</span>
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
      <SoftShadows size={14} samples={12} focus={0.6} />
      <fog attach="fog" args={[sky.horizon, 45 + W, 90 + W * 2]} />
      <ambientLight intensity={sky.ambient * 0.6} color={sky.ambientColor} />
      <hemisphereLight args={[sky.hemiTop, sky.hemiBottom, sky.hemiI]} />
      <directionalLight
        position={[dx * (half + 10), dy * (half + 10), dz * (half + 10)]}
        intensity={sky.sunI}
        color={sky.sunColor}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
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
    if (replayUrl()) return;
    // jamoa: loyiha sozlamasi yoki .claude/agents (server ishlayotgan bo'lsa)
    resolveServer().then((base) => fetch(`${base}/team`, { signal: AbortSignal.timeout(1500) }))
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j.team) && j.team.length) useOffice.getState().setTeam(j.team, { replace: true });
        if (j.project) useOffice.setState({ project: j.project });
        if (j.severity) useOffice.getState().setServerSeverity(j.severity); // .agent-office.json standartlari
      })
      .catch(() => {});
  }, []);
  const replay = replayUrl();
  useEffect(() => {
    if (!replay) return;
    startReplay(replay);
    return () => stopReplay();
  }, [replay]);
  useEffect(() => {
    if (replay) return;
    if (mode === 'sim') { stopLive(); startSim(); }
    else { stopSim(); startLive(); }
    return () => { stopSim(); stopLive(); };
  }, [mode, replay]);

  return (
    <div className={`app ${sky.lamps > 0.5 ? 'night' : 'day'}`}>
      <div className="stage" style={{ background: `linear-gradient(180deg, ${sky.top} 0%, ${sky.horizon} 70%)` }}>
        <Canvas
          shadows
          dpr={[1, 2]}
          gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
          camera={{ position: [9, 21, 25], fov: 34, near: 0.5, far: 400 }}
          onPointerMissed={() => { const s = useOffice.getState(); if (s.selected) s.select(s.selected); }}
        >
          <SkyBackdrop />
          <StudioLight />
          <Lights />
          <Office />
          {ids.split(',').map((id) => <Agent key={id} id={id} />)}
          <OrbitControls makeDefault target={[0, 0, 0.5]} maxPolarAngle={1.2} minDistance={8} maxDistance={45} enableDamping dampingFactor={0.08} />
          <BossController />
          <CinemaCamera />
          <Effects />
        </Canvas>
        <AlertBanner />
        <BossHud />
      </div>
      <Panel />
    </div>
  );
}
