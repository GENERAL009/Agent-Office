#!/usr/bin/env node
// Serverni boshqarish: start | stop | status
//   node ctl.mjs start [loyiha_papkasi]
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { HERE, BASE, RUN_DIR, PID_FILE, LOG_FILE, health } from './common.mjs';

export async function ensureServer(projectDir, waitMs = 2500) {
  const h = await health();
  if (h) return { started: false, info: h };
  fs.mkdirSync(RUN_DIR, { recursive: true });
  const out = fs.openSync(LOG_FILE, 'a');
  const child = spawn(process.execPath, [path.join(HERE, 'server.mjs')], {
    cwd: projectDir,
    detached: true,
    stdio: ['ignore', out, out],
    env: { ...process.env, AGENT_OFFICE_PROJECT: projectDir },
  });
  child.unref();
  fs.writeFileSync(PID_FILE, String(child.pid));
  const until = Date.now() + waitMs;
  while (Date.now() < until) {
    await new Promise((r) => setTimeout(r, 150));
    const info = await health();
    if (info) return { started: true, info };
  }
  return { started: true, info: null };
}

async function main() {
  const [cmd = 'status', dir] = process.argv.slice(2);
  const projectDir = path.resolve(dir || process.env.CLAUDE_PROJECT_DIR || process.cwd());

  if (cmd === 'start') {
    const { started, info } = await ensureServer(projectDir);
    if (!info) {
      console.log(`Agent Office could not start. See the log: ${LOG_FILE}`);
      process.exit(1);
    }
    console.log(`Agent Office ${started ? 'started' : 'is already running'}: ${BASE}`);
    console.log(`Project: ${info.project}`);
    console.log(`Docker: ${info.docker}. Log files watched: ${info.logs}. Config: ${info.config ?? 'none (.agent-office.json)'}`);
  } else if (cmd === 'stop') {
    let pid = null;
    try { pid = Number(fs.readFileSync(PID_FILE, 'utf8')); } catch {}
    const info = await health();
    if (info?.pid) pid = info.pid;
    if (!pid || !info) { console.log('Agent Office is not running.'); return; }
    try { process.kill(pid, 'SIGTERM'); console.log('Agent Office stopped.'); }
    catch { console.log('Agent Office process was not found.'); }
    try { fs.unlinkSync(PID_FILE); } catch {}
  } else {
    const info = await health();
    console.log(info ? `Running at ${BASE} (project ${info.project}, docker ${info.docker})` : 'Agent Office is not running.');
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('ctl.mjs')) main();
