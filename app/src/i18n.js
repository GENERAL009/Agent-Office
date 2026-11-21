// Interface language. English is the default; Uzbek is one click away (EN | UZ in the panel).
// The source strings are English, so tr('Session started') needs no entry for English.
// Choice order: ?lang= in the URL, then the saved choice, then English.
const LS = 'agent-office-lang';
export const LANGS = ['en', 'uz'];

export const lang = (() => {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (LANGS.includes(q)) return q;
    const saved = localStorage.getItem(LS);
    if (LANGS.includes(saved)) return saved;
  } catch { /* private window */ }
  return 'en';
})();

export function setLang(l) {
  try { localStorage.setItem(LS, l); } catch {}
  const u = new URL(location.href);
  u.searchParams.delete('lang');
  location.replace(u.toString());
}

export const LOCALE = lang === 'uz' ? 'uz-UZ' : 'en-US';

const UZ = {
  // connection
  'Not connected': 'Ulanmagan',
  'Connecting…': 'Ulanmoqda…',
  'Server connected': 'Server ulangan',
  'Replaying a recording': 'Yozuv qayta o‘ynatilmoqda',
  'Server not found — run /agent-office:office or /agent-office:doctor in Claude': 'Server topilmadi — Claude’da /agent-office:office yoki /agent-office:doctor',
  // agent states
  idle: 'bo‘sh', walking: 'yurmoqda', working: 'ishlamoqda', talking: 'gaplashmoqda', thinking: 'o‘ylamoqda',
  'ERROR!': 'XATO!', offline: 'ishlamayapti',
  // service states
  running: 'ishlayapti', crashed: 'to‘xtadi', unhealthy: 'sog‘lom emas', restarting: 'qayta yonmoqda', stopped: 'to‘xtatilgan', removed: 'o‘chirilgan',
  // severity
  Info: 'Oddiy', Minor: 'Mayda', Moderate: 'O‘rtacha', Major: 'Katta', Critical: 'Kritik',
  minor: 'mayda', moderate: 'o‘rtacha', major: 'katta', critical: 'kritik',
  // sun
  Auto: 'Avto', Day: 'Kun', Night: 'Tun', 'Sun height': 'Quyosh balandligi', Location: 'Joylashuv',
  'Finding your location…': 'Joylashuv aniqlanmoqda…', Now: 'Hozir', '{n} h': '{n} soat', 'Back to now': 'Hozirga qaytish',
  approximate: 'taxminiy', saved: 'saqlangan', Tashkent: 'Toshkent',
  // boss
  'Leave boss mode': 'Boshliq rejimidan chiqish', 'Boss mode': 'Boshliq rejimi', 'Your name': 'Ismingiz', 'Boss name': 'Boshliq ismi',
  '+ teammate (flutter)': '+ xodim (flutter)', Boss: 'Boshliq', you: 'siz', walk: 'yurish', run: 'yugurish', camera: 'kamera',
  monitor: 'monitor', Exit: 'Chiqish', 'Open the {label} monitor': '{label} monitorini ochish', 'state:': 'holat:', 'task:': 'vazifa:',
  'errors:': 'xatolar:', '$ no logs yet_': '$ hozircha log yo‘q_', '$ no services watched_': '$ kuzatilayotgan xizmat yo‘q_',
  'Meeting screen': 'Majlis ekrani', '{who}, help! {text}': '{who}, yordam bering! {text}', 'Hi {who}! On it: {task}': 'Salom, {who}! {task} ustidaman',
  work: 'ish', 'Hi {who}! 👋': 'Salom, {who}! 👋', 'Cinema camera': 'Kino kamera',
  // panel
  'Agent Office': 'Agent Ofisi', '{n} working · {m} total': '{n} ta ishlamoqda · {m} jami', 'No problems': 'Muammo yo‘q',
  Unmute: 'Ovozni yoqish', Mute: 'Ovozni o‘chirish', 'real hook events': 'haqiqiy hook hodisalari', Simulation: 'Simulyatsiya',
  'Test events': 'Sinov hodisalari', 'Error count (click to clear)': 'Xatolar soni (bosib tozalash)',
  '{name} — recent activity': '{name} — oxirgi harakatlar', Events: 'Hodisalar', 'Nothing yet': 'Hozircha hech narsa yo‘q',
  'No {level} or higher events': '{level} va undan yuqori hodisa yo‘q', Services: 'Xizmatlar',
  '{service} {reason} — in the lounge': '{service} {reason} — dam olish xonasida', Language: 'Til',
  // error settings
  Errors: 'Xatolar', 'Color key': 'Rang izohi', 'panic at: {x}': 'panika: {x}', 'Panic threshold': 'Panika chegarasi',
  'red light, siren, lounge': 'qizil chiroq, sirena, dam olish xonasi', 'Color mode': 'Rang rejimi', Sound: 'Ovoz',
  'alarm from this level': 'shu darajadan signal', 'Event feed': 'Hodisalar lentasi', 'hide below': 'pastini yashirish',
  Off: 'O‘chiq', 'By status': 'Holat bo‘yicha', 'Red only': 'Faqat qizil', All: 'Hammasi', 'Minor+': 'Mayda+', 'Moderate+': 'O‘rtacha+', 'Major+': 'Katta+',
  'Defaults: .agent-office.json': 'Standart: .agent-office.json', 'Saved in this browser': 'Tanlov shu brauzerda saqlanadi',
  'Reset to defaults': 'Standartga qaytarish',
  'plain log, 2xx/3xx/404': 'oddiy log, 2xx/3xx/404', 'warning, retry, timeout, 4xx': 'ogohlantirish, retry, timeout, 4xx',
  'ERROR line, failed tool, 5xx': 'ERROR qatori, yiqilgan tool, 5xx', 'FATAL, PANIC, OOM, DB auth, container crashed': 'FATAL, PANIC, OOM, DB auth, konteyner yiqildi',
  // rooms and roles
  Lounge: 'Dam olish', 'Meeting room': 'Majlis xonasi', 'Green zone': 'Yashil zona', ENTRANCE: 'KIRISH',
  Mobile: 'Mobil', Design: 'Dizayn', Docs: 'Hujjatlar', Security: 'Xavfsizlik', Team: 'Jamoa', 'Main Claude': 'Asosiy Claude',
  // store / live
  'Starting work': 'Ish boshlanmoqda', "Hi! I'm {name} 👋": 'Salom! Men {name} 👋', 'Joined the team: {name}': 'Jamoaga qo‘shildi: {name}',
  'is unhealthy': 'sog‘lom emas', 'keeps crashing': 'qayta-qayta yiqilmoqda', 'went down': 'to‘xtadi', '✅ {name} is back': '✅ {name} tiklandi',
  service: 'xizmat', action: 'harakat', 'Took a task: {task}': 'Vazifa oldi: {task}', '✓ Task done': '✓ Vazifa tugadi', 'Done!': 'Tayyor!',
  'Session started': 'Sessiya boshlandi', 'Session closed 👋': 'Sessiya yopildi 👋', 'Session closed': 'Sessiya yopildi',
  'New request': 'Yangi so‘rov', 'Request: {p}': 'So‘rov: {p}', Task: 'Vazifa', '→ handed to {agent}: {task}': '→ {agent}ga topshirdi: {task}',
  '{tool} failed: {err}': '{tool} yiqildi: {err}', 'Sub-agent ended with an error': 'Sub-agent xato bilan tugadi',
  'Sub-agent stopped': 'Sub-agent to‘xtadi', 'Answer ready ✓': 'Javob tayyor ✓', 'Answer ready': 'Javob tayyor',
  'Answer failed: {err}': 'Javob yiqildi: {err}', 'API error': 'API xatosi',
  // simulation
  'Users migration': 'Users migratsiyasi', 'JWT check': 'JWT tekshiruvi', 'Orders endpoint': 'Buyurtmalar endpointi', 'Cache layer': 'Kesh qatlami',
  'Login page': 'Login sahifasi', 'Dashboard table': 'Dashboard jadvali', 'Form validation': 'Forma validatsiyasi', 'Mobile menu': 'Mobil menyu',
  'Nginx config': 'Nginx sozlamasi', 'Backup script': 'Backup skripti', 'Login screen': 'Login ekrani', 'Push notifications': 'Push bildirishnomalar',
  'Offline cache': 'Offline kesh', 'E2E tests': 'E2E testlar', Regression: 'Regressiya', 'Login test': 'Login sinovi', 'Load test': 'Yuklama testi',
  'Model training': 'Model trening', 'Data cleaning': 'Ma’lumot tozalash', Refactoring: 'Refaktoring', 'Code review': 'Kod ko‘rib chiqish',
  'Writing docs': 'Hujjat yozish', 'Working on {task}': '{task} ustida ishlayapman', 'Task: {task}': 'Vazifa: {task}', '✓ {task} done': '✓ {task} tayyor',
  'Coffee break': 'Qahva tanaffusi', Meeting: 'Majlis', 'When do we ship?': 'Reliz qachon?', 'Did we agree on the API schema?': 'API sxemasi kelishildimi?',
  'Tests passed': 'Testlar o‘tdi', Planning: 'Rejalashtirish', 'Splitting up the work': 'Vazifalarni taqsimlamoqda', 'Talking to {name}': '{name} bilan gaplashish',
  '{name}, how is it going?': '{name}, holat qanday?', '{task} — almost done': '{task} — deyarli tayyor', 'Starting now': 'Hozir boshlayman',
  'Sync with {name}': '{name} bilan sinxronlash',
  // demo events
  'Open the premium office': 'Premium ofisni ochish', 'Premium 3D office: run /agent-office:premium': 'Premium 3D ofis: /agent-office:premium buyrug‘ini ishga tushiring',
  'Add a login page and an API': 'Login sahifasi va API qo‘sh', 'Write the login API': 'Login API yozish', 'Login form': 'Login formasi',
};

export function tr(text, vars) {
  let s = lang === 'uz' ? (UZ[text] ?? text) : text;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
  return s;
}

export const STATE_LABEL = (state) => tr({ panic: 'ERROR!', down: 'offline' }[state] ?? state);
const SV = { up: 'running', down: 'crashed', unhealthy: 'unhealthy', restarting: 'restarting', stopped: 'stopped', removed: 'removed' };
export const SERVICE_LABEL = (state) => (SV[state] ? tr(SV[state]) : state);
