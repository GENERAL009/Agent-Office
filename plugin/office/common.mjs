// Umumiy sozlamalar va yordamchilar (faqat Node'ning o'z modullari, hech qanday paket kerak emas).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PORT = Number(process.env.AGENT_OFFICE_PORT || 4777);
export const HOST = '127.0.0.1';
export const BASE = `http://${HOST}:${PORT}`;
export const RUN_DIR = path.join(os.tmpdir(), `agent-office-${PORT}`);
export const PID_FILE = path.join(RUN_DIR, 'server.pid');
export const LOG_FILE = path.join(RUN_DIR, 'server.log');
export const UI_DIR = path.join(HERE, '..', 'ui');

// Konteyner yoki terminal nomidan agentni taxmin qilish
export function guessAgent(name = '') {
  const n = name.toLowerCase();
  if (/front|web|ui|client|next|nuxt|vite|react|vue|angular|svelte/.test(n)) return 'frontend';
  if (/nginx|traefik|caddy|haproxy|redis|kafka|rabbit|nats|prometheus|grafana|loki|jaeger|elastic|kibana|minio|vault|consul|runner|ci|cron/.test(n)) return 'devops';
  if (/api|back|server|svc|service|app|worker|db|postgres|mysql|maria|mongo|sql|django|flask|rails|spring|express|nest|fastapi|go|rust/.test(n)) return 'backend';
  return 'devops';
}

// Log qatorining darajasi
const ERR = /\b(error|errors?:|err!|exception|traceback|fatal|panic|panicked|crash(ed)?|unhandled|segfault|segmentation fault|econnrefused|eaddrinuse|enoent|out of memory|oomkilled|killed|failed|failure|uncaught|stack trace)\b/i;
const NOT_ERR = /\b(0 errors?|no errors?|errors?: 0|without errors?|error[_-]?(page|handler|boundary)\b)/i;
const WARN = /\b(warn(ing)?|deprecated|retrying|timeout|timed out)\b/i;
export function levelOf(line) {
  if (ERR.test(line) && !NOT_ERR.test(line)) return 'error';
  if (WARN.test(line)) return 'warn';
  return 'info';
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

export async function post(events, timeout = 500) {
  try {
    await fetch(`${BASE}/event`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(events),
      signal: AbortSignal.timeout(timeout),
    });
    return true;
  } catch {
    return false;
  }
}

export async function health(timeout = 400) {
  try {
    const r = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(timeout) });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

export const trim = (v, n = 300) => (typeof v === 'string' && v.length > n ? v.slice(0, n) + '…' : v);
