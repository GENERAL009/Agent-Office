// The plugin's team (from /agent-office:setup) mapped onto the premium office's five seats.
// The Manager is the main Claude session; every other role takes the seat that fits it best.
// Names are the same people as in the free office (app/src/crew.js), and each gets a
// Synty character of the matching gender.
import type { AgentId } from '../types';
import { PROFILES } from '../agents';

export interface TeamRole { id: string; name?: string; kind?: string }

type G = 'f' | 'm';
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const FIXED: Record<string, [string, G]> = {
  manager: ['Michael', 'm'], backend: ['Emma', 'f'], frontend: ['Jake', 'm'], qa: ['Olivia', 'f'], devops: ['Ryan', 'm'],
  mobile: ['Ava', 'f'], data: ['Ethan', 'm'], design: ['Sophia', 'f'], security: ['Noah', 'm'], docs: ['Grace', 'f'],
};
const POOL: [string, G][] = [
  ['Lucas', 'm'], ['Mia', 'f'], ['Daniel', 'm'], ['Chloe', 'f'], ['Henry', 'm'], ['Lily', 'f'], ['Owen', 'm'], ['Zoe', 'f'], ['Caleb', 'm'], ['Nora', 'f'],
];
export function person(roleId: string): [string, G] {
  const key = roleId.toLowerCase();
  if (FIXED[key]) return FIXED[key];
  return POOL[hash(key) % POOL.length];
}

const SPECIAL: Record<string, string> = { devops: 'DevOps', ios: 'iOS', ml: 'ML', ai: 'AI', qa: 'QA', ui: 'UI', ux: 'UX', sre: 'SRE', api: 'API' };
export const prettyRole = (id: string) => id.split(/[-_ ]/).map((w) => SPECIAL[w.toLowerCase()] ?? w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const KIND_COLOR: Record<string, string> = {
  backend: '#3b82f6', frontend: '#ec4899', devops: '#22c55e', mobile: '#0ea5e9', qa: '#a855f7',
  data: '#7c4dff', design: '#f472b6', docs: '#d97706', security: '#ef4444',
};

// Which seat suits a role. Seats come with their own desk and room in the office.
const PREFER: [RegExp, AgentId][] = [
  [/front|web|ui|design|ux|client|react|vue|mobile|ios|android/i, 'designer'],
  [/qa|test|quality|e2e|review/i, 'qa'],
  [/research|explore|doc|data|ml|ai|analy|writer/i, 'research'],
  [/.*/, 'developer'],
];
const SEATS: AgentId[] = ['developer', 'designer', 'qa', 'research'];

/** Synty character per seat; changed when the team arrives. */
export const SEAT_MODEL: Record<AgentId, string> = {
  manager: 'SK_Chr_Boss_Male_01',
  research: 'SK_Chr_Business_Male_02',
  developer: 'SK_Chr_Developer_Male_01',
  designer: 'SK_Chr_Developer_Female_01',
  qa: 'SK_Chr_Developer_Male_02',
};
const MODELS: Record<G, string[]> = {
  f: ['SK_Chr_Developer_Female_01', 'SK_Chr_Developer_Female_02', 'SK_Chr_Business_Female_02', 'SK_Chr_Business_Female_01'],
  m: ['SK_Chr_Developer_Male_01', 'SK_Chr_Developer_Male_02', 'SK_Chr_Business_Male_02', 'SK_Chr_Business_Male_01'],
};

/** role id (as Claude Code names the sub-agent) → seat */
export const roleSeat = new Map<string, AgentId>();
const seatRole = new Map<AgentId, string>();

export function seatFor(roleId: string | undefined | null): AgentId {
  if (!roleId) return 'manager';
  const id = roleId.replace(/^.*:/, '').toLowerCase();
  if (id === 'manager' || id === 'main') return 'manager';
  const known = roleSeat.get(id);
  if (known) return known;
  // a role the team file did not list: give it a free seat, or the one that fits
  return assign(id);
}

function assign(id: string): AgentId {
  const want = PREFER.find(([re]) => re.test(id))![1];
  const seat = !seatRole.has(want) ? want : SEATS.find((s) => !seatRole.has(s)) ?? want;
  roleSeat.set(id, seat);
  if (!seatRole.has(seat)) { seatRole.set(seat, id); dress(seat, id); }
  return seat;
}

function dress(seat: AgentId, roleId: string, label?: string) {
  const [name, g] = person(roleId);
  const role = label ?? prettyRole(roleId);
  const p = PROFILES[seat];
  p.name = name;
  p.role = role;
  p.color = KIND_COLOR[roleId] ?? p.color;
  p.bio = `Claude Code sub-agent "${roleId}". Its tool calls show up here live.`;
  const used = new Set(Object.entries(SEAT_MODEL).filter(([s]) => s !== seat && seatRole.has(s as AgentId)).map(([, m]) => m));
  SEAT_MODEL[seat] = MODELS[g].find((m) => !used.has(m)) ?? MODELS[g][0];
}

export const isVacant = (seat: AgentId) => seat !== 'manager' && !seatRole.has(seat);

/** Apply the team from the plugin server. Returns every seat (check isVacant). */
export function applyTeam(team: TeamRole[]): AgentId[] {
  roleSeat.clear();
  seatRole.clear();
  const [mName, mG] = person('manager');
  Object.assign(PROFILES.manager, { name: mName, role: 'Manager', bio: 'The main Claude Code session: reads your prompt, plans and hands work to the team.' });
  SEAT_MODEL.manager = mG === 'f' ? 'SK_Chr_Boss_Female_01' : 'SK_Chr_Boss_Male_01';
  for (const r of team) {
    const id = r.id.toLowerCase();
    if (id === 'manager') continue;
    const seat = assign(id);
    if (seatRole.get(seat) === id) dress(seat, id, r.name);
  }
  return ['manager', ...SEATS];
}
