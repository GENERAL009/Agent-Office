// UI uchun xatolik darajalari: qoidalar plugin bilan umumiy (plugin/office/severity.mjs).
export { LEVELS, rank, bump, maxSev, severityOf, normalize, DEFAULT_SETTINGS, serviceSeverity } from '../../plugin/office/severity.mjs';
import { LEVELS, rank, DEFAULT_SETTINGS } from '../../plugin/office/severity.mjs';
import { tr } from './i18n.js';

// fill — 3D sahna va belgilar; text — qorong'i panelda o'qiladigan matn rangi
export const SEV = {
  info: { label: tr('Info'), fill: '#64748B', text: '#94A3B8' },
  minor: { label: tr('Minor'), fill: '#EAB308', text: '#FACC15' },
  moderate: { label: tr('Moderate'), fill: '#F97316', text: '#FB923C' },
  major: { label: tr('Major'), fill: '#DC2626', text: '#F87171' },
  critical: { label: tr('Critical'), fill: '#7F1D1D', text: '#FCA5A5', glow: '#B91C1C' },
};
export const SEV_LOWER = { minor: tr('minor'), moderate: tr('moderate'), major: tr('major'), critical: tr('critical') };

// Eski hodisalarda faqat `level` bo'ladi
export const fromLegacy = (level) => (level === 'error' ? 'moderate' : level === 'warn' ? 'minor' : 'info');

// Sozlamalar: brauzer tanlovi (localStorage) > loyiha standarti (.agent-office.json) > umumiy standart
const LS = 'agent-office-severity';
export function loadLocalSettings() {
  try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; }
}
export function saveLocalSettings(s) {
  try { localStorage.setItem(LS, JSON.stringify(s)); } catch { /* maxfiy oyna */ }
}
export function mergeSettings(serverDefaults = {}, local = {}) {
  return { ...DEFAULT_SETTINGS, ...serverDefaults, ...local };
}

// Rang rejimida ko'rinadimi: "status" — minor'dan boshlab; "red" — faqat panika chegarasidan
export function visibleSev(sev, settings) {
  if (!sev || rank(sev) === 0) return null;
  if (settings.colorMode === 'red') return rank(sev) >= rank(settings.panicAt) ? 'major' : null;
  return sev;
}
export const colorOf = (sev, settings, part = 'fill') => {
  const v = visibleSev(sev, settings);
  return v ? SEV[v][part] : null;
};
export const atLeast = (sev, min) => min !== 'off' && rank(sev) >= rank(min);
export const isLevel = (s) => LEVELS.includes(s);
