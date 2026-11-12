// node --test plugin/office/severity.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  severityOf, normalize, Repeats, RestartTracker, serviceSeverity, compileRules, classify, legacyLevel, settingsFrom,
} from './severity.mjs';

const cases = [
  // critical
  ['[2026-11-12 10:01:02,331: CRITICAL/MainProcess] Unrecoverable error: VersionMismatch(\'Redis transport requires redis-py versions 3.2.0 or later\')', 'critical'],
  ['FATAL:  role "smartshop" does not exist', 'critical'],
  ['asyncpg.exceptions.InvalidPasswordError: password authentication failed for user "postgres"', 'critical'],
  ['2026-11-12 09:00:00.123 UTC [77] FATAL:  database "novera" does not exist', 'critical'],
  ['Error: connect ECONNREFUSED 127.0.0.1:5432', 'critical'],
  ['container exited: OOMKilled', 'critical'],
  ['Segmentation fault (core dumped)', 'critical'],
  ['panic: runtime error: index out of range [3] with length 3', 'critical'],
  // major
  ['IndexError: pop from empty list', 'major'],
  ['Traceback (most recent call last):', 'major'],
  ['TypeError: Cannot read properties of undefined (reading \'id\')', 'major'],
  ['java.lang.NullPointerException: name is null', 'major'],
  ['UnhandledPromiseRejectionWarning: something broke', 'major'],
  ['    at Object.<anonymous> (/app/src/server.js:12:5)', 'major'],
  ['npm error code 1 — Exit code 1', 'major'],
  // moderate
  ['[2026-11-12 10:00:00,000: ERROR/ForkPoolWorker-1] task.failed name=sync.process_queue', 'moderate'],
  ['GET /api/x 500', 'moderate'],
  ['"POST /api/orders HTTP/1.1" 502 0', 'moderate'],
  ['ERROR could not send email, will continue', 'moderate'],
  ['Error: connect ECONNREFUSED 10.0.0.9:8080', 'moderate'],
  // minor
  ['WARNING urllib3 Retrying (Retry(total=2)) after connection broken', 'minor'],
  ['DeprecationWarning: datetime.utcnow() is deprecated', 'minor'],
  ['GET /api/x 401', 'minor'],
  ['request timed out after 30s', 'minor'],
  // info
  ['GET /api/x 404', 'info'],
  ['GET /api/x 200 12ms', 'info'],
  ['"GET /health HTTP/1.1" 304 0', 'info'],
  ['0 errors', 'info'],
  ['no errors found', 'info'],
  ['registered error_handler for 500', 'info'],
  ['Compiled successfully in 1.2s', 'info'],
  ['', 'info'],
];

for (const [line, want] of cases) {
  test(`${want.padEnd(8)} ← ${line.slice(0, 70) || '(bo\'sh)'}`, () => {
    assert.equal(severityOf(line), want);
  });
}

test('eski level maydoni moslashuvi', () => {
  assert.equal(legacyLevel('info'), 'info');
  assert.equal(legacyLevel('minor'), 'warn');
  assert.equal(legacyLevel('moderate'), 'error');
  assert.equal(legacyLevel('major'), 'error');
  assert.equal(legacyLevel('critical'), 'error');
});

test('normalize: vaqt, raqam va uuid olib tashlanadi', () => {
  const a = normalize('2026-11-12 10:00:01 FATAL: conn 17 failed id=3f1c2a9e-1111-2222-3333-444455556666');
  const b = normalize('2026-11-12 10:05:44 FATAL: conn 99 failed id=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  assert.equal(a, b);
});

test('takrorlanish: bir xil qator 5 marta → bir daraja yuqori', () => {
  let t = 0;
  const r = new Repeats({ now: () => t });
  const line = (i) => `2026-11-12 10:00:${String(i).padStart(2, '0')} WARNING slow query took ${100 + i}ms`;
  const out = [];
  for (let i = 0; i < 5; i++) { t += 10_000; out.push(r.see('db', line(i), severityOf(line(i)))); }
  assert.deepEqual(out.map((o) => o.severity), ['minor', 'minor', 'minor', 'minor', 'moderate']);
  assert.equal(out[4].count, 5);
  assert.equal(new Set(out.map((o) => o.key)).size, 1, 'hammasi bitta guruh');
});

test('takrorlanish: postgres FATAL har 10 soniyada → critical bo\'lib qoladi (yuqorisi yo\'q)', () => {
  let t = 0;
  const r = new Repeats({ now: () => t });
  let last;
  for (let i = 0; i < 8; i++) { t += 10_000; last = r.see('db', 'FATAL:  role "smartshop" does not exist', 'critical'); }
  assert.equal(last.severity, 'critical');
  assert.equal(last.count, 8);
});

test('takrorlanish: 2 daqiqadan keyin hisob qaytadan', () => {
  let t = 0;
  const r = new Repeats({ now: () => t });
  for (let i = 0; i < 4; i++) { t += 10_000; r.see('a', 'ERROR x', 'moderate'); }
  t += 200_000;
  assert.equal(r.see('a', 'ERROR x', 'moderate').severity, 'moderate');
});

test('takrorlanish: info hech qachon ko\'tarilmaydi', () => {
  let t = 0;
  const r = new Repeats({ now: () => t });
  let last;
  for (let i = 0; i < 10; i++) { t += 1000; last = r.see('a', 'GET / 200', 'info'); }
  assert.equal(last.severity, 'info');
});

test('docker holatlari', () => {
  assert.equal(serviceSeverity('up'), 'info');
  assert.equal(serviceSeverity('unhealthy'), 'major');
  assert.equal(serviceSeverity('down', { exitCode: 1 }), 'critical');
  assert.equal(serviceSeverity('down', { exitCode: 0 }), 'info');
  assert.equal(serviceSeverity('restarting', { restarts: 1 }), 'major');
  assert.equal(serviceSeverity('restarting', { restarts: 3 }), 'critical');
});

test('restart: 3 daqiqada 3 marta', () => {
  let t = 0;
  const rt = new RestartTracker({ now: () => t });
  rt.note('api'); t += 30_000; rt.note('api'); t += 30_000;
  assert.equal(rt.note('api'), 3);
  t += 400_000;
  assert.equal(rt.count('api'), 0);
});

test('.agent-office.json qoidalari: critical va ignore', () => {
  const c = compileRules({ critical: ['payment gateway down'], ignore: ['/api/extension/commands/next'] });
  assert.equal(severityOf('WARN payment gateway down', c), 'critical');
  assert.equal(severityOf('GET /api/extension/commands/next 500', c), null);
  assert.equal(classify('GET /api/extension/commands/next 500', { compiled: c }), null);
  assert.equal(severityOf('GET /api/other 500', c), 'moderate');
});

test('sozlamalar: standart va noto\'g\'ri qiymatlar', () => {
  assert.deepEqual(settingsFrom({}), { panicAt: 'major', sound: 'critical', colorMode: 'status', feedMin: 'info' });
  assert.deepEqual(settingsFrom({ severity: { panicAt: 'minor', sound: 'off', colorMode: 'red', feedMin: 'minor' } }),
    { panicAt: 'minor', sound: 'off', colorMode: 'red', feedMin: 'minor' });
  assert.equal(settingsFrom({ severity: { panicAt: 'xyz' } }).panicAt, 'major');
});
