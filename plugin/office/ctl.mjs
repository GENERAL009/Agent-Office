#!/usr/bin/env node
// Serverni boshqarish:
//   node ctl.mjs start [loyiha] [--open]   serverni yoqadi (kerak bo'lsa), manzilni chiqaradi
//   node ctl.mjs stop                      to'xtatadi
//   node ctl.mjs status                    holat
//   node ctl.mjs open                      brauzerda ochadi
//   node ctl.mjs doctor                    nima uchun ochilmayotganini tekshiradi
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { HERE } from './common.mjs';
import { findServer, readState, clearState, LOG_FILE, RUN_DIR, STATE_FILE, PORTS, DEFAULT_PORT } from './net.mjs';

export async function ensureServer(projectDir, waitMs = 4000) {
  const running = await findServer({ thorough: waitMs > 2000 });
  if (running) return { started: false, info: running };
  fs.mkdirSync(RUN_DIR, { recursive: true });
  const out = fs.openSync(LOG_FILE, 'a');
  const child = spawn(process.execPath, [path.join(HERE, 'server.mjs')], {
    cwd: projectDir,
    detached: true,
    windowsHide: true, // Windows'da konsol oynasi ochilmasin
    stdio: ['ignore', out, out],
    env: { ...process.env, AGENT_OFFICE_PROJECT: projectDir },
  });
  child.unref();
  const until = Date.now() + waitMs;
  while (Date.now() < until) {
    await new Promise((r) => setTimeout(r, 200));
    const info = await findServer();
    if (info) return { started: true, info };
  }
  return { started: true, info: await findServer({ thorough: true }) };
}

export function openBrowser(url) {
  const opts = { detached: true, stdio: 'ignore', windowsHide: true };
  try {
    if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '""', url], opts).unref();
    else if (process.platform === 'darwin') spawn('open', [url], opts).unref();
    else spawn('xdg-open', [url], opts).unref();
    return true;
  } catch { return false; }
}

const tail = (file, n = 15) => { try { return fs.readFileSync(file, 'utf8').trim().split('\n').slice(-n); } catch { return []; } };

// Port bo'shmi: free | in-use | reserved (EACCES) | <xato kodi>
function checkPort(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', (e) => resolve(e.code === 'EADDRINUSE' ? 'in-use' : e.code === 'EACCES' ? 'reserved' : e.code));
    s.listen(port, host, () => s.close(() => resolve('free')));
  });
}

async function doctor(projectDir) {
  const ok = (m) => console.log(`  ✔ ${m}`);
  const bad = (m) => console.log(`  ✖ ${m}`);
  const info = (m) => console.log(`    ${m}`);
  console.log('Agent Office doctor\n');

  const major = Number(process.versions.node.split('.')[0]);
  (major >= 18 ? ok : bad)(`Node.js ${process.versions.node}${major >= 18 ? '' : ' — 18 or newer is required'}`);
  console.log(`  • ${process.platform} · project ${projectDir}`);
  if (process.env.CLAUDE_CODE_REMOTE === 'true') {
    bad('This Claude Code session runs in the cloud. The office server runs there too, so a browser on your computer cannot reach it. Run `claude` on your own computer.');
  }

  const st = readState();
  if (st) ok(`State file: pid ${st.pid}, port ${st.port}, ${st.urls.join(' , ')}`);
  else info(`No state file at ${STATE_FILE} (server never started or stopped cleanly)`);

  const srv = await findServer({ thorough: true, timeout: 800 });
  if (srv) {
    ok(`Server answers at ${srv.base}`);
    for (const u of srv.urls ?? []) info(`also try: ${u}`);
    if (srv.tried?.length) info(`ports skipped at start: ${srv.tried.join(', ')}`);
  } else {
    bad('No Agent Office server answers on 127.0.0.1 / localhost / [::1], ports ' + `${PORTS[0]}–${PORTS[PORTS.length - 1]}`);
    const p = await checkPort(DEFAULT_PORT);
    if (p === 'free') info(`port ${DEFAULT_PORT} is free — the server is just not running. Run: node "${path.join(HERE, 'ctl.mjs')}" start`);
    else if (p === 'in-use') info(`port ${DEFAULT_PORT} is used by another program — the server will pick the next free port on start`);
    else if (p === 'reserved') {
      info(`port ${DEFAULT_PORT} is reserved by Windows (Hyper-V / WSL / Docker) — the server will pick the next free port on start`);
      info('see reserved ranges: netsh interface ipv4 show excludedportrange protocol=tcp');
    } else info(`port ${DEFAULT_PORT}: ${p}`);
  }

  const log = tail(LOG_FILE);
  if (log.length) { console.log(`\n  Last lines of ${LOG_FILE}:`); for (const l of log) info(l); }

  await new Promise((r) => execFile('docker', ['version', '--format', '{{.Server.Version}}'], { timeout: 4000, windowsHide: true }, (err, out) => {
    if (err) info(`Docker: not available (${/ENOENT/.test(String(err.code)) ? 'not installed' : 'daemon not reachable'}) — optional`);
    else ok(`Docker ${out.trim()}`);
    r();
  }));
  return srv;
}

async function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith('--')));
  const [cmd = 'status', dir] = args.filter((a) => !a.startsWith('--'));
  const projectDir = path.resolve(dir || process.env.CLAUDE_PROJECT_DIR || process.cwd());

  if (cmd === 'start') {
    const { started, info } = await ensureServer(projectDir);
    if (!info) {
      console.log('Agent Office could not start. Diagnosis:\n');
      await doctor(projectDir);
      process.exit(1);
    }
    const [main, ...alt] = info.urls?.length ? info.urls : [info.base];
    console.log(`Agent Office ${started ? 'started' : 'is already running'}: ${main}`);
    if (alt.length) console.log(`If that does not open, try: ${alt.join('  or  ')}`);
    if (info.port && info.port !== DEFAULT_PORT) console.log(`Port ${DEFAULT_PORT} was not usable (${(info.tried ?? []).join(', ') || 'busy'}), so port ${info.port} is used.`);
    console.log(`Project: ${info.project}`);
    console.log(`Docker: ${info.docker}. Log files watched: ${info.logs}. Config: ${info.config ?? 'none (.agent-office.json)'}`);
    if (flags.has('--open') && openBrowser(main)) console.log('Opened in your browser.');
  } else if (cmd === 'open') {
    const info = await findServer({ thorough: true });
    if (!info) { console.log('Agent Office is not running. Start it with: ctl.mjs start --open'); process.exit(1); }
    openBrowser(info.urls?.[0] ?? info.base);
    console.log(`Opened ${info.urls?.[0] ?? info.base}`);
  } else if (cmd === 'stop') {
    const info = await findServer({ thorough: true });
    const pid = info?.pid ?? readState()?.pid;
    if (!pid) { console.log('Agent Office is not running.'); clearState(); return; }
    try { process.kill(pid, 'SIGTERM'); console.log('Agent Office stopped.'); }
    catch { console.log('Agent Office process was not found.'); }
    clearState(pid);
  } else if (cmd === 'doctor') {
    await doctor(projectDir);
  } else {
    const info = await findServer({ thorough: true });
    console.log(info ? `Running at ${info.base} (project ${info.project}, docker ${info.docker})` : 'Agent Office is not running.');
  }
}

if (process.argv[1] && path.basename(process.argv[1]) === 'ctl.mjs') main();
