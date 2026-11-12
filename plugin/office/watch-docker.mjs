// Docker kuzatuvchisi: konteyner holatini har 3 soniyada tekshiradi va
// ishlayotgan konteynerlarning loglarini oqim bilan o'qiydi.
import { spawn, execFile } from 'node:child_process';
import { guessAgent, levelOf, trim } from './common.mjs';
import { RateLimit } from './rate.mjs';

const POLL_MS = 3000;

function dockerPs() {
  return new Promise((resolve, reject) => {
    execFile('docker', ['ps', '-a', '--no-trunc', '--format', '{{json .}}'], { timeout: 5000, maxBuffer: 4_000_000 }, (err, out) => {
      if (err) return reject(err);
      resolve(out.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean));
    });
  });
}

// Docker holatini ofis tiliga o'tkazish: up | down | unhealthy | restarting | stopped
function stateOf(c) {
  const st = (c.State || '').toLowerCase();
  const status = c.Status || '';
  if (st === 'running') return /unhealthy/i.test(status) ? 'unhealthy' : 'up';
  if (st === 'restarting') return 'restarting';
  if (st === 'paused') return 'stopped';
  const code = Number((status.match(/Exited \((\d+)\)/) || [])[1] ?? 1);
  return code === 0 || code === 143 || code === 130 ? 'stopped' : 'down';
}

export function startDocker(config, emit, status) {
  const tracked = new Map(); // name -> { state, agent, logs }
  const ignore = new Set(config.ignoreContainers || []);
  const agentFor = (name) => config.containers?.[name] ?? guessAgent(name);
  const limit = new RateLimit();
  let firstPoll = true;
  let warned = false;

  function follow(name, agent) {
    const p = spawn('docker', ['logs', '-f', '--since', '1s', name], { stdio: ['ignore', 'pipe', 'pipe'] });
    const onData = (buf) => {
      for (const line of buf.toString().split('\n')) {
        const text = line.trim();
        if (!text) continue;
        const level = levelOf(text);
        if (!limit.allow(name, level)) continue;
        emit({ hook: 'Log', source: name, kind: 'docker', agent, level, text: trim(text, 280) });
      }
    };
    p.stdout.on('data', onData);
    p.stderr.on('data', onData);
    p.on('error', () => {});
    return p;
  }

  async function poll() {
    let list;
    try {
      list = await dockerPs();
      if (status.docker !== 'on') { status.docker = 'on'; warned = false; }
    } catch (e) {
      if (!warned) {
        status.docker = /ENOENT/.test(String(e?.code ?? e)) ? 'not installed' : 'not reachable';
        warned = true;
      }
      setTimeout(poll, 15_000);
      return;
    }

    const seen = new Set();
    for (const c of list) {
      const name = (c.Names || '').split(',')[0];
      if (!name || ignore.has(name)) continue;
      seen.add(name);
      const state = stateOf(c);
      let t = tracked.get(name);
      // Kuzatishni boshlash: ishlayotgani, sozlamada ko'rsatilgani yoki allContainers
      if (!t) {
        const wanted = state === 'up' || state === 'unhealthy' || state === 'restarting' || config.containers?.[name] || config.allContainers;
        if (!wanted || (firstPoll && state === 'stopped' && !config.containers?.[name])) continue;
        t = { state: null, agent: agentFor(name), logs: null };
        tracked.set(name, t);
      }
      if (t.state !== state) {
        emit({
          hook: 'Service', id: `docker:${name}`, name, kind: 'docker', agent: t.agent, state,
          prev: t.state, detail: c.Status, image: c.Image,
        });
        t.state = state;
      }
      const running = state === 'up' || state === 'unhealthy';
      if (running && !t.logs) { t.logs = follow(name, t.agent); t.logs.on('exit', () => { t.logs = null; }); }
      if (!running && t.logs) { t.logs.kill(); t.logs = null; }
    }
    // O'chirib yuborilgan konteynerlar
    for (const [name, t] of tracked) {
      if (!seen.has(name) && t.state !== 'removed') {
        emit({ hook: 'Service', id: `docker:${name}`, name, kind: 'docker', agent: t.agent, state: 'removed', prev: t.state, detail: 'Konteyner o‘chirildi' });
        t.state = 'removed';
        t.logs?.kill();
      }
    }
    firstPoll = false;
    setTimeout(poll, POLL_MS);
  }
  poll();
}
