// Serverni topish va unga ulanish. Server qaysi manzil va portda ishlayotganini
// state faylga yozadi; bu yerda avval o'sha fayl, keyin bir nechta zaxira variant tekshiriladi:
//   127.0.0.1 → localhost → [::1], port 4777 → 4778 … 4790.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const DEFAULT_PORT = Number(process.env.AGENT_OFFICE_PORT || 4777);
export const PORTS = [DEFAULT_PORT, ...Array.from({ length: 13 }, (_, i) => DEFAULT_PORT + 1 + i)];
export const HOSTS = ['127.0.0.1', 'localhost', '[::1]'];
export const RUN_DIR = path.join(os.tmpdir(), 'agent-office');
export const STATE_FILE = path.join(RUN_DIR, 'server.json');
export const LOG_FILE = path.join(RUN_DIR, 'server.log');

export function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return null; }
}
export function writeState(state) {
  fs.mkdirSync(RUN_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
export function clearState(pid) {
  const s = readState();
  if (!s || !pid || s.pid === pid) { try { fs.unlinkSync(STATE_FILE); } catch {} }
}

// Manzilda aynan Agent Office javob beryaptimi
export async function probe(base, timeout = 400) {
  try {
    const r = await fetch(`${base}/health`, { signal: AbortSignal.timeout(timeout) });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.name === 'agent-office' ? { ...j, base } : null;
  } catch {
    return null;
  }
}

// Bir nechta manzildan birinchi javob berganini qaytaradi
async function first(bases, timeout) {
  if (!bases.length) return null;
  return new Promise((resolve) => {
    let left = bases.length;
    for (const b of bases) {
      probe(b, timeout).then((r) => {
        if (r) resolve(r);
        else if (--left === 0) resolve(null);
      });
    }
  });
}

// thorough=false: state fayl + standart port (hook'lar uchun tez)
// thorough=true:  barcha host va portlar (ctl, doctor uchun)
export async function findServer({ thorough = false, timeout = 400 } = {}) {
  const st = readState();
  const fromState = st?.urls ?? [];
  const quick = [...fromState, ...HOSTS.map((h) => `http://${h}:${DEFAULT_PORT}`)];
  const r = await first([...new Set(quick)], timeout);
  if (r || !thorough) return r;
  const all = PORTS.flatMap((p) => HOSTS.slice(0, 2).map((h) => `http://${h}:${p}`));
  return first([...new Set(all)].filter((b) => !quick.includes(b)), timeout);
}

export async function post(events, timeout = 500) {
  const srv = await findServer({ timeout: 300 });
  if (!srv) return false;
  try {
    await fetch(`${srv.base}/event`, {
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

export const health = (opts) => findServer(opts);
