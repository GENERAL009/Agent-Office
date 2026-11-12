#!/usr/bin/env node
// Loyihani skanerlaydi va qaysi rollar (agentlar) kerakligini taklif qiladi.
//   node scan.mjs [loyiha_papkasi]  → JSON
// Faqat fayl nomlari va manifestlarni o'qiydi (package.json, pubspec.yaml, go.mod, docker-compose ...).
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || process.env.CLAUDE_PROJECT_DIR || process.cwd());
const IGNORE = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.dart_tool', 'vendor', 'target', '.venv', 'venv', '__pycache__', '.idea', '.gradle', 'Pods', 'coverage', '.turbo', '.cache']);
const MAX_DEPTH = 4;
const files = [];

(function walk(dir, depth) {
  if (depth > MAX_DEPTH || files.length > 8000) return;
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (IGNORE.has(e.name)) continue;
    const p = path.join(dir, e.name);
    const rel = path.relative(root, p);
    if (e.isDirectory()) { files.push(rel + '/'); walk(p, depth + 1); }
    else files.push(rel);
  }
})(root, 0);

const read = (rel) => { try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch { return ''; } };
const json = (rel) => { try { return JSON.parse(read(rel)); } catch { return null; } };
const has = (re) => files.filter((f) => re.test(f));
const dirOf = (f) => path.dirname(f) === '.' ? '.' : path.dirname(f);

const roles = new Map(); // id -> { id, kind, evidence:Set, paths:Set, commands:Set }
const role = (id, kind) => {
  if (!roles.has(id)) roles.set(id, { id, kind, evidence: new Set(), paths: new Set(), commands: new Set() });
  return roles.get(id);
};

// --- Flutter / Dart / mobil
for (const f of has(/(^|\/)pubspec\.yaml$/)) {
  const t = read(f);
  const r = role(/flutter:/.test(t) ? 'flutter' : 'dart', 'mobile');
  r.evidence.add(`${f}${/flutter:/.test(t) ? ' (Flutter SDK)' : ''}`);
  r.paths.add(dirOf(f));
  r.commands.add('flutter test').add('flutter analyze');
}
if (has(/(^|\/)(ios\/Runner\.xcodeproj|android\/app\/build\.gradle(\.kts)?)$/).length && !roles.has('flutter')) {
  role('mobile', 'mobile').evidence.add('ios/ yoki android/ papkasi');
}

// --- JavaScript / TypeScript paketlari
for (const f of has(/(^|\/)package\.json$/)) {
  const pkg = json(f);
  if (!pkg) continue;
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const d = (n) => Object.keys(deps).some((k) => k === n || k.startsWith(`${n}/`) || k.startsWith(`@${n}`));
  const dir = dirOf(f);
  const scripts = pkg.scripts || {};
  const cmds = ['test', 'lint', 'build', 'typecheck'].filter((s) => scripts[s]).map((s) => `npm run ${s}`);
  if (d('react-native') || d('expo')) { const r = role('mobile', 'mobile'); r.evidence.add(`${f} (React Native/Expo)`); r.paths.add(dir); cmds.forEach((c) => r.commands.add(c)); }
  else if (d('next') || d('react') || d('vue') || d('svelte') || d('@angular/core') || d('nuxt') || d('solid-js') || d('astro')) {
    const r = role('frontend', 'frontend'); r.evidence.add(`${f} (${['next', 'react', 'vue', 'svelte', 'nuxt', 'astro'].filter(d).join(', ') || 'angular'})`); r.paths.add(dir); cmds.forEach((c) => r.commands.add(c));
  }
  if (d('express') || d('fastify') || d('koa') || d('hono') || d('@nestjs/core') || d('prisma') || d('typeorm') || d('mongoose') || d('pg')) {
    const r = role('backend', 'backend'); r.evidence.add(`${f} (${['express', 'fastify', 'koa', 'hono', 'prisma', 'mongoose'].filter(d).join(', ') || 'nest'})`); r.paths.add(dir); cmds.forEach((c) => r.commands.add(c));
  }
  if (d('@playwright/test') || d('cypress')) { const r = role('qa', 'qa'); r.evidence.add(`${f} (${d('cypress') ? 'Cypress' : 'Playwright'})`); r.paths.add(dir); }
}

// --- Boshqa backend tillari
const backendFiles = [
  [/(^|\/)go\.mod$/, 'Go', 'go test ./...'], [/(^|\/)Cargo\.toml$/, 'Rust', 'cargo test'],
  [/(^|\/)(pom\.xml|build\.gradle(\.kts)?)$/, 'Java/Kotlin', null], [/(^|\/)Gemfile$/, 'Ruby', 'bundle exec rspec'],
  [/(^|\/)composer\.json$/, 'PHP', null], [/\.csproj$/, '.NET', 'dotnet test'], [/(^|\/)mix\.exs$/, 'Elixir', 'mix test'],
];
for (const [re, label, cmd] of backendFiles) {
  for (const f of has(re)) {
    if (/android\//.test(f)) continue;
    const r = role('backend', 'backend'); r.evidence.add(`${f} (${label})`); r.paths.add(dirOf(f)); if (cmd) r.commands.add(cmd);
  }
}
for (const f of has(/(^|\/)(requirements[^/]*\.txt|pyproject\.toml|Pipfile)$/)) {
  const t = read(f).toLowerCase();
  if (/django|flask|fastapi|starlette|sanic|aiohttp/.test(t)) { const r = role('backend', 'backend'); r.evidence.add(`${f} (Python web)`); r.paths.add(dirOf(f)); r.commands.add('pytest'); }
  if (/torch|tensorflow|scikit|sklearn|pandas|numpy|transformers|xgboost|lightgbm|jupyter/.test(t)) { const r = role('ml', 'data'); r.evidence.add(`${f} (ML/Data)`); r.paths.add(dirOf(f)); }
}
if (has(/\.ipynb$/).length) role('ml', 'data').evidence.add(`${has(/\.ipynb$/).length} ta notebook`);

// --- DevOps
const compose = has(/(^|\/)(docker-)?compose[^/]*\.ya?ml$/);
const devopsEv = [
  ...has(/(^|\/)Dockerfile[^/]*$/).slice(0, 3), ...compose.slice(0, 2), ...has(/^\.github\/workflows\/[^/]+\.ya?ml$/).slice(0, 2),
  ...has(/\.tf$/).slice(0, 2), ...has(/(^|\/)(k8s|kubernetes|helm|charts)\//).slice(0, 2), ...has(/(^|\/)\.gitlab-ci\.yml$/),
];
if (devopsEv.length) { const r = role('devops', 'devops'); devopsEv.forEach((e) => r.evidence.add(e)); }

// --- QA (alohida test papkalari)
const testDirs = has(/(^|\/)(e2e|cypress|playwright|tests?\/e2e|integration_test)\/$/);
if (testDirs.length) { const r = role('qa', 'qa'); testDirs.slice(0, 3).forEach((e) => r.evidence.add(e)); }

// --- Hujjatlar
if (has(/(^|\/)(mkdocs\.yml|docusaurus\.config\.[jt]s)$/).length || has(/^docs\/.+\.mdx?$/).length > 10) {
  role('docs', 'docs').evidence.add(has(/(^|\/)(mkdocs\.yml|docusaurus\.config\.[jt]s)$/)[0] || 'docs/ papkasi');
}

// --- docker-compose servislari → rol
const containers = {};
const services = [];
for (const f of compose) {
  const t = read(f);
  const m = t.match(/(?:^|\n)services:[ \t]*\n([\s\S]*?)(?=\n[^\s#]|$)/);
  const block = m && m[1];
  if (!block) continue;
  for (const m of block.matchAll(/^ {2}([A-Za-z0-9_.-]+):\s*$/gm)) services.push({ file: f, name: m[1] });
}
const ids = [...roles.keys()];
const pickRole = (n) => {
  const s = n.toLowerCase();
  if (ids.includes('flutter') && /flutter|mobile|app-mobile/.test(s)) return 'flutter';
  if (ids.includes('frontend') && /front|web|ui|client|next|nuxt|vite/.test(s)) return 'frontend';
  if (ids.includes('ml') && /ml|train|jupyter|model/.test(s)) return 'ml';
  if (ids.includes('backend') && /api|back|server|worker|db|postgres|mysql|mongo|redis|queue/.test(s)) return /redis/.test(s) && ids.includes('devops') ? 'devops' : 'backend';
  return ids.includes('devops') ? 'devops' : ids[0];
};
for (const s of services) containers[s.name] = pickRole(s.name);

// --- Log fayllar
const logs = has(/(^|\/)(logs?\/[^/]+\.log|[^/]+\.log)$/).slice(0, 5).map((f) => ({ path: f }));

const out = {
  project: path.basename(root),
  root,
  roles: [...roles.values()].map((r) => ({
    id: r.id, kind: r.kind, evidence: [...r.evidence].slice(0, 6), paths: [...r.paths].slice(0, 6), commands: [...r.commands].slice(0, 6),
  })),
  composeServices: services.map((s) => s.name),
  containersHint: containers,
  logFiles: logs,
  existingAgents: (() => { try { return fs.readdirSync(path.join(root, '.claude', 'agents')).filter((f) => f.endsWith('.md')); } catch { return []; } })(),
  existingConfig: fs.existsSync(path.join(root, '.agent-office.json')),
  filesScanned: files.length,
};
console.log(JSON.stringify(out, null, 2));
