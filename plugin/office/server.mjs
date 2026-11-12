#!/usr/bin/env node
// Agent Office serveri:
//  - POST /event      hook'lar, run.mjs va kuzatuvchilardan hodisa qabul qiladi (bitta yoki massiv)
//  - GET  /events     brauzerga SSE oqimi
//  - GET  /           tayyor 3D ofis (ui/ papkasi)
//  - GET  /health     holat
// Qo'shimcha: Docker konteynerlari va log fayllarini kuzatadi.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { UI_DIR, loadConfig, resolveAgent, makeClassifier } from './common.mjs';
import { settingsFrom } from './severity.mjs';
import { PORTS, probe, writeState, clearState } from './net.mjs';
import { startDocker } from './watch-docker.mjs';
import { startFiles } from './watch-files.mjs';
import { computeTeam, signature } from './team.mjs';

const project = process.env.AGENT_OFFICE_PROJECT || process.cwd();
const config = loadConfig(project); // o'zgarganda joyida yangilanadi
let team = computeTeam(project, config);
const sev = makeClassifier(config); // xatolik darajalari va takrorlanish
const clients = new Set();
const services = new Map(); // id -> oxirgi Service hodisasi
const recentLogs = []; // yangi ulangan brauzer uchun oxirgi loglar

function broadcast(ev) {
  if (ev.hook === 'Service') services.set(ev.id, ev);
  if (ev.hook === 'Log') { recentLogs.push(ev); if (recentLogs.length > 40) recentLogs.shift(); }
  const data = `data: ${JSON.stringify(ev)}\n\n`;
  for (const c of clients) c.write(data);
}

const status = { docker: 'off', logs: 0 };
let listening = { port: null, host: null, urls: [], tried: [] };
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

function serveStatic(req, res) {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.normalize(path.join(UI_DIR, url === '/' ? 'index.html' : url));
  if (!file.startsWith(UI_DIR)) { res.writeHead(403).end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(UI_DIR, 'index.html');
  if (!fs.existsSync(file)) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
      .end('UI is not built. Run: cd app && npm install && npm run build');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

function handler(req, res) {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS).end(); return; }

  if (req.method === 'POST' && req.url === '/event') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 256_000) req.destroy(); });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        for (const ev of Array.isArray(parsed) ? parsed : [parsed]) if (ev && ev.hook) broadcast(ev);
        if (process.env.AGENT_OFFICE_DEBUG) console.log(body);
      } catch {}
      res.writeHead(204, CORS).end();
    });
    return;
  }

  if (req.url === '/events') {
    res.writeHead(200, { ...CORS, 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify({ hook: 'Snapshot', services: [...services.values()], logs: recentLogs, project: path.basename(project), team, severity: settingsFrom(config) })}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (req.url === '/team') {
    res.writeHead(200, { ...CORS, 'content-type': 'application/json' }).end(JSON.stringify({ team, project: path.basename(project), severity: settingsFrom(config) }));
    return;
  }

  if (req.url === '/health') {
    res.writeHead(200, { ...CORS, 'content-type': 'application/json' }).end(JSON.stringify({
      name: 'agent-office', ok: true, pid: process.pid, project, clients: clients.size, docker: status.docker, logs: status.logs,
      config: config.file, services: services.size, port: listening.port, urls: listening.urls, tried: listening.tried,
    }));
    return;
  }

  if (req.method === 'GET') { serveStatic(req, res); return; }
  res.writeHead(404, CORS).end();
}

// ---------- Port va manzil tanlash ----------
// 127.0.0.1 da tinglaymiz (faqat shu kompyuterdan kirish mumkin). Port band (EADDRINUSE)
// yoki Windows tomonidan zaxiraga olingan (EACCES) bo'lsa — keyingi portga o'tamiz.
// IPv4 ishlamasa — IPv6 [::1]. Hech biri bo'lmasa — tizim bergan bo'sh port.
function tryListen(port, host) {
  return new Promise((resolve) => {
    const srv = http.createServer(handler);
    const onErr = (e) => resolve({ ok: false, code: e.code, message: e.message });
    srv.once('error', onErr);
    srv.listen(port, host, () => { srv.off('error', onErr); resolve({ ok: true, srv, port: srv.address().port }); });
  });
}

async function listen() {
  const tried = [];
  for (const port of [...PORTS, 0]) {
    for (const host of ['127.0.0.1', '::1']) {
      const r = await tryListen(port, host);
      if (r.ok) return { ...r, host, tried };
      tried.push(`${host}:${port} ${r.code}`);
      if (r.code === 'EADDRINUSE') {
        // shu portda allaqachon Agent Office ishlayaptimi?
        const other = await probe(`http://${host.includes(':') ? `[${host}]` : host}:${port}`);
        if (other) return { already: other, tried };
        break; // keyingi port
      }
      if (r.code === 'EACCES') break; // zaxiraga olingan port (Windows Hyper-V/WSL) — keyingi port
      // EADDRNOTAVAIL / EAFNOSUPPORT va boshqalar: shu portda boshqa host'ni sinaymiz
    }
  }
  return { failed: true, tried };
}

const result = await listen();
if (result.already) {
  console.log(`Agent Office already running at ${result.already.base} (pid ${result.already.pid}). Exiting.`);
  process.exit(0);
}
if (result.failed) {
  console.error(`Agent Office could not listen on any port:\n  ${result.tried.join('\n  ')}`);
  process.exit(1);
}
const { port, host } = result;
const hostUrl = host.includes(':') ? `[${host}]` : host;
listening = {
  port, host, tried: result.tried,
  urls: [`http://${hostUrl}:${port}`, `http://localhost:${port}`],
};
// IPv4 bilan birga IPv6 loopback'da ham tinglaymiz (localhost ::1 ga ketsa ham ochilsin)
if (host === '127.0.0.1') {
  const v6 = await tryListen(port, '::1');
  if (v6.ok) listening.urls.push(`http://[::1]:${port}`);
}
writeState({ pid: process.pid, port, host, urls: listening.urls, project, startedAt: new Date().toISOString() });
if (result.tried.length) console.log(`Skipped: ${result.tried.join(', ')}`);
console.log(`Agent Office: ${listening.urls[0]}  (also ${listening.urls.slice(1).join(', ')})  project: ${project}`);
{
  const resolve = (name) => resolveAgent(name, config, team);
  if (config.docker !== false) startDocker(config, broadcast, status, resolve, sev);
  startFiles(config, project, broadcast, status, resolve, sev);
}

setInterval(() => { for (const c of clients) c.write(': ping\n\n'); }, 15_000);

// .agent-office.json yoki .claude/agents o'zgarsa — jamoani qayta o'qib, ofisga yuboramiz (bino o'sadi)
let sig = signature(project);
setInterval(() => {
  const now = signature(project);
  if (now === sig) return;
  sig = now;
  Object.assign(config, loadConfig(project));
  sev.reload(config);
  broadcast({ hook: 'Settings', severity: settingsFrom(config) });
  const next = computeTeam(project, config);
  if (JSON.stringify(next) !== JSON.stringify(team)) {
    team = next;
    broadcast({ hook: 'Team', team });
    console.log(`Team changed: ${team.map((r) => r.id).join(', ')}`);
  }
}, 2000);
const bye = () => { clearState(process.pid); process.exit(0); };
process.on('SIGTERM', bye);
process.on('SIGINT', bye);
