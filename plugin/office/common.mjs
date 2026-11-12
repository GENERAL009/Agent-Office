// Umumiy sozlamalar va yordamchilar (faqat Node'ning o'z modullari, hech qanday paket kerak emas).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const UI_DIR = path.join(HERE, '..', 'ui');

// Konteyner yoki terminal nomidan agentni taxmin qilish
export function guessAgent(name = '') {
  const n = name.toLowerCase();
  if (/flutter|mobile|ios|android|dart|expo|react-?native/.test(n)) return 'mobile';
  if (/\bqa\b|e2e|cypress|playwright|selenium/.test(n)) return 'qa';
  if (/\bml\b|jupyter|notebook|train|mlflow|ray|spark/.test(n)) return 'data';
  if (/front|web|ui|client|next|nuxt|vite|react|vue|angular|svelte/.test(n)) return 'frontend';
  if (/nginx|traefik|caddy|haproxy|redis|kafka|rabbit|nats|prometheus|grafana|loki|jaeger|elastic|kibana|minio|vault|consul|runner|ci|cron/.test(n)) return 'devops';
  if (/api|back|server|svc|service|app|worker|db|postgres|mysql|maria|mongo|sql|django|flask|rails|spring|express|nest|fastapi|go|rust/.test(n)) return 'backend';
  return 'devops';
}

// Log qatorining darajasi (eski API): info | warn | error. Yangi kod severity.mjs → severityOf ishlatadi.
import { severityOf, legacyLevel, compileRules, Repeats, classify } from './severity.mjs';
export function levelOf(line) {
  return legacyLevel(severityOf(line) ?? 'info');
}

// Server bo'ylab bitta tasniflagich: loyiha qoidalari + takrorlanish hisobi
export function makeClassifier(config) {
  const st = { compiled: compileRules(config?.severity?.rules), repeats: new Repeats() };
  return {
    reload(cfg) { st.compiled = compileRules(cfg?.severity?.rules); },
    line(source, text) { return classify(text, { source, compiled: st.compiled, repeats: st.repeats }); },
    get compiled() { return st.compiled; },
  };
}

// Loyiha sozlamasi: <loyiha>/.agent-office.json (ixtiyoriy)
export function loadConfig(projectDir) {
  const file = path.join(projectDir, '.agent-office.json');
  try {
    const c = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { file, containers: {}, ignoreContainers: [], logs: [], allContainers: false, docker: true, ...c };
  } catch {
    return { file: null, containers: {}, ignoreContainers: [], logs: [], allContainers: false, docker: true };
  }
}

export { post, health, findServer, DEFAULT_PORT, RUN_DIR, LOG_FILE, STATE_FILE } from './net.mjs';

export const trim = (v, n = 300) => (typeof v === 'string' && v.length > n ? v.slice(0, n) + '…' : v);

// Nomni jamoadagi rolga bog'lash: avval sozlama, keyin nomida rol bor-yo'qligi, keyin tur bo'yicha
export function resolveAgent(name, config, team) {
  if (config.containers?.[name]) return config.containers[name];
  const n = name.toLowerCase();
  // compose servis nomi konteyner nomi ichida bo'lsa (shop-api-1 ⊃ api)
  const svc = Object.keys(config.containers || {}).sort((a, b) => b.length - a.length).find((k) => n.includes(k.toLowerCase()));
  if (svc) return config.containers[svc];
  const byId = team.find((r) => n.includes(r.id.toLowerCase()));
  if (byId) return byId.id;
  const kind = guessAgent(name);
  const byKind = team.find((r) => (r.kind || guessAgent(r.id)) === kind);
  if (byKind) return byKind.id;
  return team.find((r) => (r.kind || guessAgent(r.id)) === 'devops')?.id ?? team[0]?.id ?? 'devops';
}
