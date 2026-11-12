// Live rejim: Claude Code hook'lari, Docker, terminal va log fayllardan kelgan hodisalarni
// agent harakatiga aylantiradi.
import { useOffice } from './store.js';
import { loungeSpots } from './layout.js';

// Ofis serverning o'zidan ochilsa — o'sha manzil; Vite dev serverdan ochilsa — 4777 port
export const SERVER = location.port === '5173' || location.protocol === 'file:' ? 'http://127.0.0.1:4777' : location.origin;
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
  const i = S().agents[agent].index;
  setTimeout(() => S().goTo(agent, loungeSpots[i % loungeSpots.length], { state: 'idle' }), 1200);
}

export function handleEvent(e) {
  const s = S();
  const hook = e.hook ?? e.hook_event_name;
  const tool = e.tool ?? e.tool_name;
  const input = e.input ?? e.tool_input ?? {};

  switch (hook) {
    case 'Snapshot': {
      if (e.project) useOffice.setState({ project: e.project });
      for (const sv of e.services || []) s.setService(sv);
      for (const l of (e.logs || []).slice(-15)) S().ensureAgent(l.agent) && S().log(l.agent, l.text, l.level, l.source);
      break;
    }
    case 'Service': s.setService(e); break;
    case 'Log': {
      const id = e.agent || 'devops';
      s.ensureAgent(id);
      if (e.level === 'error') S().panic(id, short(e.text, 90), e.source);
      else S().log(id, e.text, e.level, e.source);
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
        if (e.stderr_level === 'error') s.panic(who, short(e.stderr, 90), 'stderr');
        else s.log(who, `stderr: ${short(e.stderr, 120)}`, 'warn');
      }
      break;
    }
    case 'PostToolUseFailure': {
      if (e.is_interrupt) break;
      const who = actorOf(e);
      s.panic(who, `${tool} yiqildi: ${short(firstLine(e.error), 80)}`, tool);
      if (SPAWN_TOOLS.has(tool)) {
        const idx = running.findIndex((r) => r.id && r.id === e.tool_use_id);
        const r = idx >= 0 ? running.splice(idx, 1)[0] : null;
        if (r) S().panic(r.agent, 'Sub-agent xato bilan tugadi', tool);
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
      s.panic('manager', `Javob yiqildi: ${short(firstLine(e.error), 70) || 'API xatosi'}`, 'Claude');
      break;
    }
    default: break;
  }
}

let es = null;
export function startLive() {
  stopLive();
  S().setConn('connecting');
  es = new EventSource(`${SERVER}/events`);
  es.onopen = () => S().setConn('on');
  es.onerror = () => S().setConn('error');
  es.onmessage = (m) => { try { handleEvent(JSON.parse(m.data)); } catch (err) { console.warn(err); } };
}
export function stopLive() {
  if (es) { es.close(); es = null; }
  running = [];
  S().setConn('off');
}
