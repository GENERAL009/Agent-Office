#!/usr/bin/env node
// Terminal buyrug'ini ishga tushirib, chiqishini ofisdagi agentga ham yuboradi.
//   node run.mjs --agent backend -- npm run dev
//   node run.mjs --agent frontend --name web -- pnpm dev
// Chiqish terminalda odatdagidek ko'rinadi. Buyruq xato bilan tugasa agent
// dam olish xonasiga ketadi, xato qatorlarida esa vahimaga tushadi.
import { spawn } from 'node:child_process';
import { post, trim, resolveAgent, findServer, loadConfig, makeClassifier } from './common.mjs';

const argv = process.argv.slice(2);
const sep = argv.indexOf('--');
if (sep < 0 || sep === argv.length - 1) {
  console.error('Usage: run.mjs [--agent <name>] [--name <label>] -- <command> [args...]');
  process.exit(2);
}
const opts = {};
for (let i = 0; i < sep; i += 2) opts[argv[i].replace(/^--/, '')] = argv[i + 1];
const cmd = argv.slice(sep + 1);
const name = opts.name || `$ ${cmd.join(' ')}`.slice(0, 40);
// --agent berilmasa: buyruq nomini ofis jamoasidagi rolga bog'laymiz
let team = [];
try { const srv = await findServer(); if (srv) team = (await (await fetch(`${srv.base}/team`, { signal: AbortSignal.timeout(400) })).json()).team ?? []; } catch {}
const agent = opts.agent || resolveAgent(cmd.join(' '), {}, team.length ? team : [{ id: 'backend' }, { id: 'frontend' }, { id: 'devops' }]);
const id = `term:${process.pid}`;

let queue = [];
const flush = () => { if (queue.length) { const q = queue; queue = []; post(q, 800); } };
setInterval(flush, 250).unref();

const sev = makeClassifier(loadConfig(process.cwd()));
let perSec = 0;
setInterval(() => { perSec = 0; }, 1000).unref();

post({ hook: 'Service', id, name, kind: 'terminal', agent, state: 'up', severity: 'info', detail: cmd.join(' ') });

const child = spawn(cmd[0], cmd.slice(1), { stdio: ['inherit', 'pipe', 'pipe'], shell: process.platform === 'win32', windowsHide: true });
let rest = '';
const pipe = (out) => (buf) => {
  out.write(buf);
  const lines = (rest + buf.toString()).split('\n');
  rest = lines.pop();
  for (const line of lines) {
    // eslint-disable-next-line no-control-regex
    const text = line.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').trim();
    if (!text) continue;
    const c = sev.line(name, text);
    if (!c) continue;
    if (c.level !== 'error' && ++perSec > 4) continue;
    queue.push({ hook: 'Log', source: name, kind: 'terminal', agent, level: c.level, severity: c.severity, key: c.key, count: c.count, text: trim(text, 280) });
  }
};
child.stdout.on('data', pipe(process.stdout));
child.stderr.on('data', pipe(process.stderr));

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));

child.on('error', async (e) => {
  console.error(e.message);
  await post({ hook: 'Service', id, name, kind: 'terminal', agent, state: 'down', severity: 'major', detail: e.message });
  process.exit(127);
});
child.on('exit', async (code, signal) => {
  flush();
  const ok = code === 0 || signal === 'SIGINT' || signal === 'SIGTERM';
  await post({
    hook: 'Service', id, name, kind: 'terminal', agent, state: ok ? 'stopped' : 'down',
    severity: ok ? 'info' : 'major', // buyruq non-zero exit → katta
    detail: signal ? `signal ${signal}` : `exit code ${code}`,
  }, 800);
  process.exit(code ?? 1);
});
