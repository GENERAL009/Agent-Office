// Ofis jamoasi: qaysi rollar uchun xona qurilishini aniqlaydi.
//  1) <loyiha>/.agent-office.json ichidagi "team"
//  2) bo'lmasa <loyiha>/.claude/agents/*.md (name: maydoni)
//  3) bo'lmasa standart: backend, frontend, devops
import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_TEAM = [
  { id: 'backend', name: 'Backend', kind: 'backend' },
  { id: 'frontend', name: 'Frontend', kind: 'frontend' },
  { id: 'devops', name: 'DevOps', kind: 'devops' },
];

function frontmatter(text) {
  const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
  const out = {};
  if (!m) return out;
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].replace(/^["']|["']$/g, '').trim();
  }
  return out;
}

export function projectAgents(projectDir) {
  const dir = path.join(projectDir, '.claude', 'agents');
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')); } catch { return []; }
  return files.map((f) => {
    try {
      const fm = frontmatter(fs.readFileSync(path.join(dir, f), 'utf8'));
      return { id: fm.name || f.replace(/\.md$/, ''), description: fm.description };
    } catch { return null; }
  }).filter(Boolean);
}

export function computeTeam(projectDir, config) {
  if (Array.isArray(config.team) && config.team.length) {
    return config.team.map((r) => (typeof r === 'string' ? { id: r } : r)).filter((r) => r.id && r.id !== 'manager');
  }
  const agents = projectAgents(projectDir);
  if (agents.length) return agents;
  return DEFAULT_TEAM;
}

// Sozlama yoki agentlar papkasi o'zgarganini bilish uchun "imzo"
export function signature(projectDir) {
  const parts = [];
  for (const f of [path.join(projectDir, '.agent-office.json')]) {
    try { parts.push(`${f}:${fs.statSync(f).mtimeMs}`); } catch { parts.push(`${f}:-`); }
  }
  const dir = path.join(projectDir, '.claude', 'agents');
  try {
    for (const f of fs.readdirSync(dir).sort()) {
      try { parts.push(`${f}:${fs.statSync(path.join(dir, f)).mtimeMs}`); } catch {}
    }
  } catch {}
  return parts.join('|');
}
