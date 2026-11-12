// Live rejim: Claude Code hook'lari, Docker, terminal va log fayllardan kelgan hodisalarni
// agent harakatiga aylantiradi.
import { useOffice } from './store.js';
import { fromLegacy, isLevel, severityOf } from './severity.js';

// Ofis serverning o'zidan ochilsa — o'sha manzil; Vite dev serverdan ochilsa — 4777 port
// Ofis serverining o'zidan ochilgan bo'lsa — o'sha manzil. Vite dev (5173) yoki fayldan ochilsa —
// serverni qidiramiz: 127.0.0.1 / localhost, port 4777…4790.
const served = !(location.port === '5173' || location.protocol === 'file:');
export let SERVER = served ? location.origin : 'http://127.0.0.1:4777';
let resolving = null;
export function resolveServer() {
  if (served) return Promise.resolve(SERVER);
  resolving ??= (async () => {
    const bases = [];
    for (let p = 4777; p <= 4790; p++) for (const h of ['127.0.0.1', 'localhost']) bases.push(`http://${h}:${p}`);
    const found = await new Promise((resolve) => {
      let left = bases.length;
      for (const b of bases) {
        fetch(`${b}/health`, { signal: AbortSignal.timeout(1200) })
          .then((r) => r.json()).then((j) => (j?.name === 'agent-office' ? resolve(b) : --left || resolve(null)))
          .catch(() => --left || resolve(null));
      }
    });
    resolving = null;
    if (found) SERVER = found;
    return SERVER;
  })();
  return resolving;
}
const S = () => useOffice.getState();
const SPAWN_TOOLS = new Set(['Task', 'Agent']);
const short = (s, n = 60) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s ?? '');
const base = (p) => (p ? p.split(/[\\/]/).pop() : '');
const firstLine = (s) => (s || '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 2).join(' · ');

function describe(tool, input = {}) {
  if (input.file_path) return `${tool} ${base(input.file_path)}`;
  if (input.command) return `${tool} ${short(input.command, 48)}`;
  if (input.pattern) return `${tool} "${short(input.pattern, 30)}"`;
  if (input.url) return `${tool} ${short(input.url, 40)}`;
  if (input.query) return `${tool} "${short(input.query, 36)}"`;
  return tool || 'harakat';
}

// Plugin agentlari "agent-office:backend" ko'rinishida keladi — ofisda "backend"
const norm = (n) => (n ? String(n).split(':').pop() : n);

let running = []; // ishga tushgan sub-agentlar (agent_type kelmasa zaxira)
const actorOf = (e) => norm(e.agent_type) || (running.length ? running[running.length - 1].agent : 'manager');

function startSub(agent, task) {
  const s = S();
  s.ensureAgent(agent);
  const a = S().agents[agent];
  if (a.state === 'working' || (a.state === 'walking' && a.after?.state === 'working')) return;
  S().patch(agent, { task });
  S().goToDesk(agent, { state: 'working' });
  S().log(agent, `Vazifa oldi: ${task}`);
}

function finishSub(agent) {
  const s = S();
  if (!s.agents[agent]) return;
  s.log(agent, '✓ Vazifa tugadi');
  s.say(agent, 'Tayyor!', 2500, 'ok');
  s.patch(agent, { task: '' });
  setTimeout(() => S().goToLounge(agent), 1200);
}

export function handleEvent(e) {
  const s = S();
  const hook = e.hook ?? e.hook_event_name;
  const tool = e.tool ?? e.tool_name;
  const input = e.input ?? e.tool_input ?? {};

  switch (hook) {
    case 'Team': {
      if (Array.isArray(e.team)) s.setTeam(e.team);
      break;
    }
    case 'Settings': {
      if (e.severity) s.setServerSeverity(e.severity);
      break;
    }
    case 'Snapshot': {
      if (e.severity) s.setServerSeverity(e.severity);
      if (e.project) useOffice.setState({ project: e.project });
      if (Array.isArray(e.team)) s.setTeam(e.team, { replace: true });
      for (const sv of e.services || []) s.setService(sv);
      for (const l of (e.logs || []).slice(-15)) S().ensureAgent(l.agent) && S().log(l.agent, l.text, l.level, l.source);
      break;
    }
    case 'Service': s.setService(e); break;
    case 'Log': {
      const id = norm(e.agent) || 'devops';
      s.ensureAgent(id);
      // yangi server `severity` yuboradi; eskisi faqat `level`
      const sev = isLevel(e.severity) ? e.severity : fromLegacy(e.level);
      if (sev === 'info') S().log(id, e.text, 'info', e.source, { key: e.key, count: e.count });
      else S().alert(id, sev, short(e.text, 110), e.source, { key: e.key, count: e.count });
      break;
    }
    case 'SessionStart': {
      running = [];
      s.goToDesk('manager', { state: 'idle' });
      s.say('manager', 'Sessiya boshlandi');
      s.log('manager', 'Sessiya boshlandi');
      break;
    }
    case 'SessionEnd': {
      s.setState('manager', 'idle');
      s.say('manager', 'Sessiya yopildi 👋');
      s.log('manager', 'Sessiya yopildi');
      break;
    }
    case 'UserPromptSubmit': {
      const p = short(e.prompt, 80) || 'Yangi so‘rov';
      s.goToDesk('manager', { state: 'thinking' });
      s.patch('manager', { task: p });
      s.say('manager', p, 5000);
      s.log('manager', `So‘rov: ${p}`);
      break;
    }
    case 'SubagentStart': {
      if (e.agent_type) startSub(norm(e.agent_type), S().agents[norm(e.agent_type)]?.task || 'Vazifa');
      break;
    }
    case 'PreToolUse': {
      if (SPAWN_TOOLS.has(tool)) {
        const agent = norm(input.subagent_type) || 'general-purpose';
        running.push({ id: e.tool_use_id, agent });
        const task = short(input.description || input.prompt, 50) || 'Vazifa';
        s.say(norm(e.agent_type) || 'manager', `${agent}: ${task}`, 4000);
        s.log(norm(e.agent_type) || 'manager', `→ ${agent}ga topshirdi: ${task}`);
        startSub(agent, task);
        break;
      }
      const who = actorOf(e);
      s.ensureAgent(who);
      const what = describe(tool, input);
      const a = S().agents[who];
      if (a.state === 'idle' && !a.down) S().goToDesk(who, { state: 'working' });
      else S().setState(who, 'working');
      if (!S().isPanicking(who)) S().say(who, what, 2500);
      S().log(who, what);
      break;
    }
    case 'PostToolUse': {
      if (SPAWN_TOOLS.has(tool)) {
        const idx = running.findIndex((r) => r.id && r.id === e.tool_use_id);
        const r = idx >= 0 ? running.splice(idx, 1)[0] : running.pop();
        if (r) finishSub(r.agent);
        s.setState(norm(e.agent_type) || 'manager', 'thinking');
      } else if (e.stderr) {
        const who = actorOf(e);
        const sev = isLevel(e.stderr_severity) ? e.stderr_severity : fromLegacy(e.stderr_level ?? 'warn');
        if (sev === 'info') s.log(who, `stderr: ${short(e.stderr, 120)}`, 'info', 'stderr');
        else s.alert(who, sev, short(e.stderr, 90), 'stderr');
      }
      break;
    }
    case 'PostToolUseFailure': {
      if (e.is_interrupt) break;
      const who = actorOf(e);
      const sev = isLevel(e.severity) ? e.severity : (tool === 'Bash' ? 'major' : 'moderate');
      s.alert(who, sev, `${tool} yiqildi: ${short(firstLine(e.error), 80)}`, tool);
      if (SPAWN_TOOLS.has(tool)) {
        const idx = running.findIndex((r) => r.id && r.id === e.tool_use_id);
        const r = idx >= 0 ? running.splice(idx, 1)[0] : null;
        if (r) S().alert(r.agent, 'major', 'Sub-agent xato bilan tugadi', tool);
      }
      break;
    }
    case 'SubagentStop': {
      const who = norm(e.agent_type) || running[running.length - 1]?.agent;
      if (who) s.log(who, 'Sub-agent to‘xtadi');
      break;
    }
    case 'Stop': {
      s.setState('manager', 'idle');
      s.patch('manager', { task: '' });
      s.say('manager', 'Javob tayyor ✓', 3000, 'ok');
      s.log('manager', 'Javob tayyor');
      break;
    }
    case 'StopFailure': {
      s.alert('manager', isLevel(e.severity) ? e.severity : 'major', `Javob yiqildi: ${short(firstLine(e.error), 70) || 'API xatosi'}`, 'Claude');
      break;
    }
    default: break;
  }
}

let es = null;
export async function startLive() {
  stopLive();
  S().setConn('connecting');
  const base = await resolveServer();
  if (S().mode !== 'live') return;
  es = new EventSource(`${base}/events`);
  es.onopen = () => S().setConn('on');
  es.onerror = () => S().setConn('error');
  es.onmessage = (m) => { try { handleEvent(JSON.parse(m.data)); } catch (err) { console.warn(err); } };
}
export function stopLive() {
  if (es) { es.close(); es = null; }
  running = [];
  S().setConn('off');
}
