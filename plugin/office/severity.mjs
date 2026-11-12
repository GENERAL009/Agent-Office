// Xatolik darajalari (severity). Faqat Node standart kutubxonasi.
//
//   info → minor → moderate → major → critical
//
// severityOf(line, rules)  — bitta log qatorining darajasi
// legacyLevel(sev)         — eski `level` maydoni uchun: info | warn | error
// Repeats                  — bir xil xato 2 daqiqada 5 marta chiqsa, darajani bir pog'ona ko'taradi
// RestartTracker           — konteyner 3 daqiqada 3+ marta qayta yonsa → critical
// serviceSeverity(state)   — Docker/terminal holatidan daraja

export const LEVELS = ['info', 'minor', 'moderate', 'major', 'critical'];
export const rank = (s) => Math.max(0, LEVELS.indexOf(s));
export const bump = (s) => LEVELS[Math.min(LEVELS.length - 1, rank(s) + 1)];
export const maxSev = (a, b) => (rank(a) >= rank(b) ? a : b);
export const legacyLevel = (s) => (s === 'minor' ? 'warn' : rank(s) >= rank('moderate') ? 'error' : 'info');

// ---------- Qoidalar (yuqoridan pastga: birinchi mos kelgani yutadi) ----------

// Xato emas, garchi "error" so'zi bo'lsa ham
const NOT_ERROR = [
  /\b0 (errors?|failures?|failed)\b/i,
  /\bno (errors?|issues?|problems?) (found|detected)?\b/i,
  /\berrors?\s*[:=]\s*0\b/i,
  /\bwithout (errors?|failures?)\b/i,
  /\berror[_-]?(handler|page|boundary|reporting|log(ger)?|code[s]?\s*[:=]\s*(0|none))\b/i,
  /\b(on|handle|catch)_?error\b/i,
  /\bsuccessfully\b.*\b(recovered|retried)\b/i,
];

const CRITICAL = [
  /\[\s*critical\b|\bcritical\s*[:\]/|]|\blevel=critical\b|\bCRITICAL\b/,
  /\bFATAL\b|\bfatal error\b|\blevel=fatal\b/i,
  /\bPANIC\b|\bpanic:|\bpanicked at\b/,
  /\bOOMKilled\b|\bout of memory\b|\bOutOfMemoryError\b|\bcannot allocate memory\b/i,
  /\bsegmentation fault\b|\bsegfault\b|\bSIGSEGV\b|\bcore dumped\b/i,
  /\bpassword authentication failed\b|\bInvalidPasswordError\b|\bAccess denied for user\b|\bauthentication failed for user\b/i,
  /\brole\s+"[^"]+"\s+does not exist\b|\bdatabase\s+"[^"]+"\s+does not exist\b/i,
  /\bUnrecoverable error\b|\bkernel panic\b|\bdata corruption\b/i,
  // bazaga ulanib bo'lmadi (postgres/mysql/mongo/redis portlari yoki nomlari)
  /\bECONNREFUSED\b.*(:5432|:3306|:27017|:6379|postgres|mysql|mongo|redis|database|\bdb\b)/i,
  /(postgres|mysql|mongo|redis|database|\bdb\b).*\b(ECONNREFUSED|connection refused|could not connect|connection to server .* failed)\b/i,
];

const MAJOR = [
  /\bTraceback \(most recent call last\)/,
  /\bunhandled (exception|rejection|promise rejection|error)\b|\bUnhandledPromiseRejection\w*|\buncaught (exception|error|typeerror)\b/i,
  /(^|[\s.:\]])[A-Z][A-Za-z0-9_]*(Error|Exception):/, // IndexError: …, java.lang.NullPointerException: …
  /\bstack ?trace\b|^\s+at [\w$.<>]+ \(.+:\d+:\d+\)/i,
  /\bexit(ed)? (with )?(code|status) [1-9]\d*\b|\bExit code [1-9]\d*\b|\bcommand failed\b/i,
  /\b(killed|terminated) by signal\b|\bcrash(ed)?\b/i,
];

const MODERATE = [
  /\bERROR\b|\[\s*error\s*[\]/]|\blevel=error\b|\berr!/i,
  /\b(failed|failure)\b/i,
  /\bexception\b/i,
  /\bECONNREFUSED\b|\bECONNRESET\b|\bEADDRINUSE\b|\bENOENT\b|\bEACCES\b/,
];

const MINOR = [
  /\bWARN(ING)?\b|\[\s*warn(ing)?\s*[\]/]|\blevel=warn(ing)?\b/i,
  /\bdeprecat(ed|ion)\b/i,
  /\bretry(ing)?\b|\bretries\b|\bbackoff\b/i,
  /\btime[ds]? ?out\b|\btimed out\b/i,
  /\bslow (query|request)\b/i,
];

// HTTP access log: "GET /api/x 500", "\"POST /a HTTP/1.1\" 503 12"
const HTTP = /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\S+(?:\s+HTTP\/[\d.]+"?)?\s+(\d{3})\b/;

function compile(list) {
  return (list || []).map((r) => {
    if (r instanceof RegExp) return r;
    try { return new RegExp(r, 'i'); } catch { return null; }
  }).filter(Boolean);
}

// rules: .agent-office.json → severity.rules = { critical: [..], major: [..], moderate: [..], minor: [..], info: [..], ignore: [..] }
export function compileRules(rules = {}) {
  const out = {};
  for (const k of [...LEVELS, 'ignore']) out[k] = compile(rules[k]);
  return out;
}

// Qatorning darajasi. 'ignore' qoidasiga mos kelsa — null (umuman ko'rsatilmaydi).
export function severityOf(line, compiled = null) {
  const text = String(line ?? '');
  if (!text.trim()) return 'info';
  if (compiled) {
    if (compiled.ignore.some((r) => r.test(text))) return null;
    for (const lvl of [...LEVELS].reverse()) if (compiled[lvl].some((r) => r.test(text))) return lvl;
  }
  if (NOT_ERROR.some((r) => r.test(text)) && !CRITICAL.some((r) => r.test(text))) return 'info';
  if (CRITICAL.some((r) => r.test(text))) return 'critical';

  const http = text.match(HTTP);
  if (http) {
    const code = Number(http[2]);
    if (code >= 500) return 'moderate';
    if (code >= 400 && code !== 404) return 'minor';
    return 'info';
  }

  if (MAJOR.some((r) => r.test(text))) return 'major';
  if (MODERATE.some((r) => r.test(text))) return 'moderate';
  if (MINOR.some((r) => r.test(text))) return 'minor';
  return 'info';
}

// Takrorlanishni aniqlash uchun matnni "qolip"ga keltirish: vaqt, uuid, raqam, hex, yo'l raqamlari olib tashlanadi
export function normalize(line) {
  return String(line ?? '')
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
    .replace(/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g, '<t>')
    .replace(/\b\d{2}:\d{2}:\d{2}(?:[.,]\d+)?\b/g, '<t>')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<id>')
    .replace(/\b0x[0-9a-f]+\b/gi, '<hex>')
    .replace(/\b[0-9a-f]{12,}\b/gi, '<hex>')
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}

// Takrorlanish hisoblagichi: bir xil qolip WINDOW ichida THRESHOLD marta → bir pog'ona yuqori.
// Har bir chiqishda guruh kaliti va hisoblagich qaytariladi (UI bitta qatorni yangilaydi, spam qilmaydi).
export class Repeats {
  constructor({ windowMs = 120_000, threshold = 5, now = () => Date.now() } = {}) {
    this.windowMs = windowMs; this.threshold = threshold; this.now = now; this.map = new Map();
  }
  see(source, line, sev) {
    const t = this.now();
    const key = `${source}|${normalize(line)}`;
    let g = this.map.get(key);
    if (!g) { g = { times: [], total: 0 }; this.map.set(key, g); }
    g.times = g.times.filter((x) => t - x < this.windowMs);
    g.times.push(t);
    g.total += 1;
    const recent = g.times.length;
    const escalated = sev !== 'info' && recent >= this.threshold;
    if (this.map.size > 2000) this.gc(t);
    return { key, count: g.total, recent, severity: escalated ? bump(sev) : sev, escalated };
  }
  gc(t) { for (const [k, g] of this.map) if (!g.times.some((x) => t - x < this.windowMs)) this.map.delete(k); }
}

// Konteyner qayta-qayta yonishi: 3 daqiqada 3+ marta restart → critical
export class RestartTracker {
  constructor({ windowMs = 180_000, threshold = 3, now = () => Date.now() } = {}) {
    this.windowMs = windowMs; this.threshold = threshold; this.now = now; this.map = new Map();
  }
  note(name) {
    const t = this.now();
    const list = (this.map.get(name) || []).filter((x) => t - x < this.windowMs);
    list.push(t);
    this.map.set(name, list);
    return list.length;
  }
  count(name) {
    const t = this.now();
    return (this.map.get(name) || []).filter((x) => t - x < this.windowMs).length;
  }
}

// Xizmat holatidan daraja
export function serviceSeverity(state, { restarts = 0, exitCode = null } = {}) {
  switch (state) {
    case 'up': case 'stopped': case 'removed': return 'info';
    case 'unhealthy': return 'major';
    case 'restarting': return restarts >= 3 ? 'critical' : 'major';
    case 'down': return exitCode === 0 ? 'info' : 'critical';
    default: return 'info';
  }
}

// .agent-office.json → severity sozlamalari (standart qiymatlar bilan)
export const DEFAULT_SETTINGS = { panicAt: 'major', sound: 'critical', colorMode: 'status', feedMin: 'info' };
export function settingsFrom(config) {
  const s = config?.severity || {};
  const pick = (v, ok, d) => (ok.includes(v) ? v : d);
  return {
    panicAt: pick(s.panicAt, ['minor', 'moderate', 'major', 'critical'], DEFAULT_SETTINGS.panicAt),
    sound: pick(s.sound, ['off', 'minor', 'moderate', 'major', 'critical'], DEFAULT_SETTINGS.sound),
    colorMode: pick(s.colorMode, ['status', 'red'], DEFAULT_SETTINGS.colorMode),
    feedMin: pick(s.feedMin, LEVELS, DEFAULT_SETTINGS.feedMin),
  };
}

// Bitta log qatoridan to'liq natija: daraja (takrorlanishdan keyin), eski level, guruh kaliti
export function classify(line, { source = '', compiled = null, repeats = null } = {}) {
  const base = severityOf(line, compiled);
  if (base === null) return null;
  if (!repeats) return { severity: base, level: legacyLevel(base), key: `${source}|${normalize(line)}`, count: 1 };
  const r = repeats.see(source, line, base);
  return { severity: r.severity, level: legacyLevel(r.severity), key: r.key, count: r.count, escalated: r.escalated, base };
}
