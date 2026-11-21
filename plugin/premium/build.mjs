#!/usr/bin/env node
// Builds the premium office from YOUR copy of the Synty POLYGON Office pack.
//   node build.mjs [pack folder or .zip] [--mixamo <folder>] [--blender <path>]
// pack: the pack's zip, or the unzipped folder (anything that contains SourceFiles/Characters and SourceFiles/Textures).
//       Left out: Downloads, Desktop and Documents are searched.
// --mixamo: optional folder with the Mixamo clips listed below (FBX Binary, "Without Skin").
//           Without them people use built-in procedural poses.
// Output goes to ~/.agent-office/premium/models (or $AGENT_OFFICE_PREMIUM_DIR/models) and stays on this computer.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PREMIUM_DIR = process.env.AGENT_OFFICE_PREMIUM_DIR || path.join(os.homedir(), '.agent-office', 'premium');
const OUT = path.join(PREMIUM_DIR, 'models');
export const CLIPS = ['Breathing Idle', 'Typing', 'Sitting Idle', 'Sitting Talking', 'Walking', 'Running', 'Talking', 'Waving', 'Drinking', 'Clapping', 'Jumping'];
const CHARACTERS = [
  'Boss_Female_01', 'Boss_Male_01', 'Business_Female_01', 'Business_Female_02', 'Business_Female_03', 'Business_Female_04',
  'Business_Male_01', 'Business_Male_02', 'Business_Male_03', 'Business_Male_04', 'Cleaner_Female_01', 'Cleaner_Male_01',
  'Developer_Female_01', 'Developer_Female_02', 'Developer_Male_01', 'Developer_Male_02', 'Security_Female_01', 'Security_Male_01',
].map((n) => `SK_Chr_${n}`);

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : null; };
const mixamoArg = flag('--mixamo');
const blenderArg = flag('--blender');
const packArg = args[0];

const ok = (m) => console.log(`✔ ${m}`);
const fail = (m, hint) => { console.log(`✖ ${m}`); if (hint) console.log(`  → ${hint}`); process.exit(1); };

// ---------- 1. the pack ----------
function findSource(dir, depth = 0) {
  if (!dir || depth > 5 || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return null;
  if (fs.existsSync(path.join(dir, 'Characters', 'SK_Chr_Developer_Male_01.fbx')) && fs.existsSync(path.join(dir, 'Textures'))) return dir;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith('.') || e.name === 'node_modules') continue;
    const hit = findSource(path.join(dir, e.name), depth + 1);
    if (hit) return hit;
  }
  return null;
}
const HOME_DIRS = ['Downloads', 'Desktop', 'Documents'].map((d) => path.join(os.homedir(), d));
const expand = (p) => path.resolve(p.replace(/^~(?=$|[\/\\])/, os.homedir()));
function unzip(zip) {
  const dest = path.join(PREMIUM_DIR, 'pack');
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  console.log(`… Unzipping ${path.basename(zip)}`);
  const r = process.platform === 'win32'
    ? spawnSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${dest}' -Force`], { stdio: 'ignore' })
    : spawnSync('unzip', ['-q', '-o', zip, '-d', dest], { stdio: 'ignore' });
  if (r.status !== 0) fail(`Could not unzip ${zip}.`, 'Unzip it yourself and give the folder instead.');
  return dest;
}
function findZip() {
  for (const d of HOME_DIRS) {
    if (!fs.existsSync(d)) continue;
    const z = fs.readdirSync(d).filter((f) => /polygon.?office.*\.zip$/i.test(f)).sort();
    if (z.length) return path.join(d, z[0]);
  }
  return null;
}
let SRC = null;
if (packArg) {
  const p = expand(packArg);
  SRC = p.toLowerCase().endsWith('.zip') && fs.existsSync(p) ? findSource(unzip(p)) : findSource(p);
} else {
  for (const d of HOME_DIRS) if (!SRC) SRC = findSource(d, 2);   // an unzipped pack in Downloads, Desktop or Documents
  if (!SRC) { const z = findZip(); if (z) SRC = findSource(unzip(z)); }
}
if (!SRC) fail(packArg ? `No Synty POLYGON Office source files found in ${packArg}.` : 'Could not find the Synty POLYGON Office pack in Downloads, Desktop or Documents.',
  'Download POLYGON Office from your Synty account (the "Source Files" zip) and give its zip or folder, e.g. /agent-office:premium ~/Downloads/POLYGON_Office_SourceFiles.zip');
ok(`Pack: ${SRC}`);

// ---------- 2. Blender ----------
function findBlender() {
  const tries = [blenderArg, process.env.BLENDER];
  if (process.platform === 'darwin') tries.push('/Applications/Blender.app/Contents/MacOS/Blender', path.join(os.homedir(), 'Applications/Blender.app/Contents/MacOS/Blender'));
  if (process.platform === 'win32') {
    const root = 'C:\\Program Files\\Blender Foundation';
    if (fs.existsSync(root)) for (const d of fs.readdirSync(root).sort().reverse()) tries.push(path.join(root, d, 'blender.exe'));
  }
  for (const t of tries) if (t && fs.existsSync(t)) return t;
  const which = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['blender'], { encoding: 'utf8' });
  return which.status === 0 ? which.stdout.split(/\r?\n/)[0].trim() : null;
}
const BLENDER = findBlender();
if (!BLENDER) fail('Blender was not found.', 'Install Blender 4.2 or newer (free, blender.org), or pass --blender <path>.');
const ver = spawnSync(BLENDER, ['--version'], { encoding: 'utf8' }).stdout?.split('\n')[0] ?? 'Blender';
ok(`${ver}`);

// ---------- 3. Mixamo clips (optional) ----------
function findClips() {
  const dirs = [mixamoArg && expand(mixamoArg), path.join(PREMIUM_DIR, 'mixamo'), path.join(path.dirname(SRC), 'mixamo'), path.join(path.dirname(path.dirname(SRC)), 'mixamo'),
    ...HOME_DIRS.flatMap((h) => (fs.existsSync(h) ? fs.readdirSync(h).filter((f) => /mixamo|animation/i.test(f)).map((f) => path.join(h, f)) : [])), ...HOME_DIRS];
  for (const d of dirs) {
    if (!d || !fs.existsSync(d) || !fs.statSync(d).isDirectory()) continue;
    const files = fs.readdirSync(d).filter((f) => f.toLowerCase().endsWith('.fbx'));
    const found = CLIPS.map((c) => files.find((f) => f.toLowerCase().replace(/[_-]/g, ' ').startsWith(c.toLowerCase())));
    if (found.some(Boolean)) return { dir: d, files: found.filter(Boolean).map((f) => path.join(d, f)), missing: CLIPS.filter((_, i) => !found[i]) };
  }
  return null;
}
const clips = findClips();
if (clips) ok(`Animations: ${clips.files.length} of ${CLIPS.length} clips in ${clips.dir}${clips.missing.length ? ` (missing: ${clips.missing.join(', ')})` : ''}`);
else console.log(`• No Mixamo clips found. People will use simple built-in poses.\n  For real animation, download these free clips from mixamo.com (FBX Binary, Without Skin) into ${path.join(PREMIUM_DIR, 'mixamo')} and run this again:\n  ${CLIPS.join(', ')}`);

// ---------- 4. convert ----------
fs.mkdirSync(OUT, { recursive: true });
function blender(script, extra, label) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    process.stdout.write(`… ${label}`);
    const p = spawn(BLENDER, ['-b', '--factory-startup', '-P', path.join(HERE, script), '--', ...extra], { stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    p.stdout.on('data', (d) => { log += d; });
    p.stderr.on('data', (d) => { log += d; });
    p.on('close', (code) => {
      const done = /DONE/.test(log);
      process.stdout.write(`\r${done ? '✔' : '✖'} ${label} (${Math.round((Date.now() - t0) / 1000)} s)\n`);
      if (!done) { fs.writeFileSync(path.join(PREMIUM_DIR, 'build.log'), log); fail(`${label} failed (exit ${code}).`, `Details: ${path.join(PREMIUM_DIR, 'build.log')}`); }
      resolve();
    });
  });
}
const props = fs.readFileSync(path.join(HERE, 'props.txt'), 'utf8').trim().split(/\s+/)
  .filter((n) => fs.existsSync(path.join(SRC, 'FBX', `${n}.fbx`)));
await blender('synty_to_gltf.py', [SRC, OUT, 'textures'], 'Textures');
await blender('synty_to_gltf.py', [SRC, OUT, 'chars', ...CHARACTERS.filter((c) => fs.existsSync(path.join(SRC, 'Characters', `${c}.fbx`)))], `${CHARACTERS.length} characters`);
await blender('synty_to_gltf.py', [SRC, OUT, 'props', ...props], `${props.length} props (the longest step)`);
if (clips?.files.length) await blender('mixamo_to_synty.py', [path.join(SRC, 'Characters', 'SK_Chr_Developer_Male_01.fbx'), path.join(OUT, 'synty_anims.glb'), ...clips.files], `${clips.files.length} animations`);

fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ builtAt: new Date().toISOString(), source: SRC, props: props.length, characters: CHARACTERS.length, clips: clips?.files.length ?? 0 }, null, 1));
ok(`Premium office built in ${OUT}`);
console.log('  Open it with /agent-office:office (it opens the premium office when it is built).');
