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
import { PORT, HOST, UI_DIR, PID_FILE, RUN_DIR, loadConfig } from './common.mjs';
import { startDocker } from './watch-docker.mjs';
import { startFiles } from './watch-files.mjs';

const project = process.env.AGENT_OFFICE_PROJECT || process.cwd();
const config = loadConfig(project);
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

const server = http.createServer((req, res) => {
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
    res.write(`data: ${JSON.stringify({ hook: 'Snapshot', services: [...services.values()], logs: recentLogs, project: path.basename(project) })}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (req.url === '/health') {
    res.writeHead(200, { ...CORS, 'content-type': 'application/json' }).end(JSON.stringify({
      ok: true, pid: process.pid, project, clients: clients.size, docker: status.docker, logs: status.logs,
      config: config.file, services: services.size,
    }));
    return;
  }

  if (req.method === 'GET') { serveStatic(req, res); return; }
  res.writeHead(404, CORS).end();
});

server.on('error', (e) => {
  console.error(`Agent Office server error: ${e.message}`);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  fs.mkdirSync(RUN_DIR, { recursive: true });
  fs.writeFileSync(PID_FILE, String(process.pid));
  console.log(`Agent Office: http://${HOST}:${PORT}  project: ${project}`);
  if (config.docker !== false) startDocker(config, broadcast, status);
  startFiles(config, project, broadcast, status);
});

setInterval(() => { for (const c of clients) c.write(': ping\n\n'); }, 15_000);
const bye = () => { try { fs.unlinkSync(PID_FILE); } catch {} process.exit(0); };
process.on('SIGTERM', bye);
process.on('SIGINT', bye);
