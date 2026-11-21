import type { AgentId, Lang } from '../types';

export interface PlannedTask {
  key: string;
  assignee: AgentId;
  title: string;
  effort: number;
  after: string[];
  /** Feature this task belongs to, used for handoff messages and bugs. */
  feature?: string;
  kind: 'research' | 'system' | 'design' | 'build' | 'test' | 'review';
}

interface Blueprint {
  match: RegExp;
  features: { en: string; uz: string }[];
}

const BLUEPRINTS: Blueprint[] = [
  {
    match: /e-?commerce|shop|store|market|do['‘’]?kon|savdo|магазин/i,
    features: [
      { en: 'Product catalog', uz: 'Mahsulotlar katalogi' },
      { en: 'Cart & checkout', uz: 'Savat va to‘lov' },
      { en: 'Login page', uz: 'Login sahifa' },
    ],
  },
  {
    match: /landing|lending|promo|portfolio/i,
    features: [
      { en: 'Hero section', uz: 'Hero bo‘limi' },
      { en: 'Pricing section', uz: 'Narxlar bo‘limi' },
      { en: 'Contact form', uz: 'Aloqa formasi' },
    ],
  },
  {
    match: /dashboard|admin|crm|analytics|panel/i,
    features: [
      { en: 'Login page', uz: 'Login sahifa' },
      { en: 'KPI charts', uz: 'KPI grafiklar' },
      { en: 'Data table', uz: 'Ma’lumotlar jadvali' },
    ],
  },
  {
    match: /mobile|ios|android|ilova/i,
    features: [
      { en: 'Onboarding', uz: 'Onboarding' },
      { en: 'Home screen', uz: 'Bosh ekran' },
      { en: 'Profile screen', uz: 'Profil ekrani' },
    ],
  },
  {
    match: /api|backend|server|bot/i,
    features: [
      { en: 'Data model', uz: 'Ma’lumotlar modeli' },
      { en: 'REST endpoints', uz: 'REST endpointlar' },
      { en: 'Auth', uz: 'Avtorizatsiya' },
    ],
  },
  {
    match: /blog|news|yangilik|journal/i,
    features: [
      { en: 'Post list', uz: 'Maqolalar ro‘yxati' },
      { en: 'Post page', uz: 'Maqola sahifasi' },
      { en: 'Admin editor', uz: 'Admin muharrir' },
    ],
  },
];

const DEFAULT_FEATURES = [
  { en: 'Login page', uz: 'Login sahifa' },
  { en: 'Main page', uz: 'Asosiy sahifa' },
  { en: 'Settings', uz: 'Sozlamalar' },
];

const jitter = (n: number) => Math.round(n * (0.85 + Math.random() * 0.3));

/** Splits a brief into role-based tasks with dependencies. */
export function planProject(brief: string, lang: Lang): PlannedTask[] {
  const bp = BLUEPRINTS.find((b) => b.match.test(brief));
  const features = (bp ? bp.features : DEFAULT_FEATURES).map((f) => f[lang]);
  const t = lang === 'uz'
    ? { research: 'Tadqiqot: raqobatchilar va talablar', system: 'Design system va wireframe', design: 'UI dizayn', build: 'Kod', test: 'Test', review: 'Yakuniy ko‘rib chiqish va topshirish' }
    : { research: 'Research: competitors & requirements', system: 'Design system & wireframes', design: 'UI design', build: 'Build', test: 'Test', review: 'Final review & delivery' };

  const tasks: PlannedTask[] = [
    { key: 'research', assignee: 'research', title: t.research, effort: jitter(14), after: [], kind: 'research' },
    { key: 'system', assignee: 'designer', title: t.system, effort: jitter(11), after: ['research'], kind: 'system' },
  ];
  features.forEach((f, i) => {
    tasks.push({ key: `design${i}`, assignee: 'designer', title: `${t.design}: ${f}`, effort: jitter(9), after: ['system'], feature: f, kind: 'design' });
    tasks.push({ key: `build${i}`, assignee: 'developer', title: `${t.build}: ${f}`, effort: jitter(15), after: [`design${i}`], feature: f, kind: 'build' });
    tasks.push({ key: `test${i}`, assignee: 'qa', title: `${t.test}: ${f}`, effort: jitter(8), after: [`build${i}`], feature: f, kind: 'test' });
  });
  tasks.push({ key: 'review', assignee: 'manager', title: t.review, effort: jitter(6), after: features.map((_, i) => `test${i}`), kind: 'review' });
  return tasks;
}

export const BUGS: Record<Lang, string[]> = {
  en: [
    'the session token expires after 1 minute',
    'the form submits twice on a slow network',
    'the layout breaks on screens under 375px',
    'the total ignores the discount code',
  ],
  uz: [
    'session token 1 daqiqada tugab qolyapti',
    'sekin internetda forma ikki marta yuborilyapti',
    '375px dan kichik ekranda layout buzilyapti',
    'jami summa chegirma kodini hisobga olmayapti',
  ],
};
