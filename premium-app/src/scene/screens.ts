// What each agent's monitor shows: a role-specific app that moves with their real task progress.
import type { Agent, AgentId, Task } from '../core/types';
import { PROFILES } from '../core/agents';
import { roundRect, fitText, FONT, MONO } from './canvasTexture';

export interface ScreenState {
  agent: Agent;
  task?: Task;
  tasks: Task[];
  t: number; // seconds, for cursors and small animations
}

const BG = '#0f141f';
const CHROME = '#1a2130';

function chrome(ctx: CanvasRenderingContext2D, w: number, title: string, accent: string) {
  ctx.fillStyle = CHROME;
  ctx.fillRect(0, 0, w, 34);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(18 + i * 18, 17, 5.5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = '#9aa4b8';
  ctx.font = `500 15px ${FONT}`;
  ctx.fillText(fitText(ctx, title, w - 140), 80, 22);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 34, w, 2);
}

const slug = (s: string) => s.replace(/^[^:]*:\s*/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'index';
const pascal = (s: string) => slug(s).split('-').map((p) => p[0]?.toUpperCase() + p.slice(1)).join('') || 'App';

type Tok = [string, string];
function codeFor(name: string): Tok[][] {
  const K = '#c792ea', S = '#c3e88d', F = '#82aaff', T = '#ffcb6b', P = '#e2e8f0', C = '#637087', N = '#f78c6c';
  return [
    [[`import`, K], [` { useState } `, P], [`from`, K], [` 'react'`, S], [`;`, P]],
    [[`import`, K], [` { api } `, P], [`from`, K], [` '../lib/api'`, S], [`;`, P]],
    [],
    [[`// ${name}: built from the approved design`, C]],
    [[`export function`, K], [` ${name}`, F], [`() {`, P]],
    [[`  const`, K], [` [items, setItems] = `, P], [`useState`, F], [`<`, P], [`Item`, T], [`[]>([]);`, P]],
    [[`  const`, K], [` [loading, setLoading] = `, P], [`useState`, F], [`(`, P], [`false`, N], [`);`, P]],
    [],
    [[`  async function`, K], [` load`, F], [`() {`, P]],
    [[`    setLoading`, F], [`(`, P], [`true`, N], [`);`, P]],
    [[`    const`, K], [` res = `, P], [`await`, K], [` api.`, P], [`get`, F], [`(`, P], [`'/items'`, S], [`);`, P]],
    [[`    setItems`, F], [`(res.data);`, P]],
    [[`    setLoading`, F], [`(`, P], [`false`, N], [`);`, P]],
    [[`  }`, P]],
    [],
    [[`  return`, K], [` (`, P]],
    [[`    <`, P], [`section`, T], [` className=`, P], [`"grid gap-6"`, S], [`>`, P]],
    [[`      {items.`, P], [`map`, F], [`((it) => <`, P], [`Card`, T], [` key={it.id} {...it} />)}`, P]],
    [[`    </`, P], [`section`, T], [`>`, P]],
    [[`  );`, P]],
    [[`}`, P]],
  ];
}

function developer(ctx: CanvasRenderingContext2D, w: number, h: number, s: ScreenState) {
  const name = s.task ? pascal(s.task.title) : 'App';
  chrome(ctx, w, `${s.task ? slug(s.task.title) : 'app'}.tsx — Code`, PROFILES.developer.color);
  // file tree
  ctx.fillStyle = '#121826';
  ctx.fillRect(0, 36, 110, h - 36);
  ctx.font = `500 13px ${MONO}`;
  ['src', ' components', ' pages', ' lib', ' tests'].forEach((f, i) => {
    ctx.fillStyle = i === 2 ? '#e2e8f0' : '#6b7486';
    ctx.fillText(f, 12, 60 + i * 20);
  });
  const lines = codeFor(name);
  const progress = s.task ? s.task.progress / 100 : 0.6;
  const working = s.agent.status === 'working';
  const shown = Math.max(3, Math.floor(lines.length * progress));
  const top = Math.max(0, shown - 11);
  ctx.font = `500 14.5px ${MONO}`;
  for (let i = top; i < shown; i++) {
    const y = 60 + (i - top) * 21;
    ctx.fillStyle = '#4a5468';
    ctx.fillText(String(i + 1).padStart(2, ' '), 120, y);
    let x = 150;
    const typingLine = working && i === shown - 1;
    const chars = typingLine ? Math.floor((s.t * 14) % 40) : Infinity;
    let used = 0;
    for (const [text, color] of lines[i]) {
      const part = text.slice(0, Math.max(0, chars - used));
      used += text.length;
      ctx.fillStyle = color;
      ctx.fillText(part, x, y);
      x += ctx.measureText(part).width;
    }
    if (typingLine && Math.floor(s.t * 2) % 2 === 0) {
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(x + 1, y - 13, 8, 16);
    }
  }
  // status bar
  ctx.fillStyle = PROFILES.developer.color;
  ctx.fillRect(0, h - 22, w, 22);
  ctx.fillStyle = '#0b1220';
  ctx.font = `600 12px ${FONT}`;
  ctx.fillText(`main ✓   TypeScript   Ln ${shown}, Col ${working ? 4 + Math.floor((s.t * 14) % 30) : 1}`, 10, h - 7);
}

function designer(ctx: CanvasRenderingContext2D, w: number, h: number, s: ScreenState) {
  chrome(ctx, w, `${s.task ? s.task.title.replace(/^[^:]*:\s*/, '') : 'Design system'} — Design`, PROFILES.designer.color);
  ctx.fillStyle = '#1b1f2a';
  ctx.fillRect(0, 36, w, h - 36);
  // layers panel
  ctx.fillStyle = '#141824';
  ctx.fillRect(0, 36, 100, h - 36);
  ctx.font = `500 12px ${FONT}`;
  ['Frame', ' Header', ' Hero', ' Button', ' Cards', ' Footer'].forEach((l, i) => {
    ctx.fillStyle = i === 2 ? '#f9a8d4' : '#7b8396';
    ctx.fillText(l, 10, 58 + i * 19);
  });
  // artboard
  const ax = 125, ay = 52, aw = w - 150, ah = h - 72;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, ax, ay, aw, ah, 6);
  ctx.fill();
  const p = s.task ? s.task.progress / 100 : 0.7;
  const blocks: [number, number, number, number, string][] = [
    [0.04, 0.05, 0.92, 0.1, '#111827'],
    [0.04, 0.2, 0.55, 0.08, '#e5e7eb'],
    [0.04, 0.31, 0.4, 0.05, '#e5e7eb'],
    [0.04, 0.42, 0.22, 0.09, PROFILES.designer.color],
    [0.62, 0.2, 0.34, 0.31, '#fce7f3'],
    [0.04, 0.6, 0.29, 0.32, '#f3f4f6'],
    [0.355, 0.6, 0.29, 0.32, '#f3f4f6'],
    [0.67, 0.6, 0.29, 0.32, '#f3f4f6'],
  ];
  const shown = Math.max(2, Math.ceil(blocks.length * p));
  blocks.slice(0, shown).forEach(([x, y, bw, bh, c]) => {
    ctx.fillStyle = c;
    roundRect(ctx, ax + x * aw, ay + y * ah, bw * aw, bh * ah, 4);
    ctx.fill();
  });
  // selection box on the newest element, with handles
  const [x, y, bw, bh] = blocks[shown - 1];
  const wob = s.agent.status === 'working' ? Math.sin(s.t * 3) * 2 : 0;
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2;
  ctx.strokeRect(ax + x * aw - 3 + wob, ay + y * ah - 3, bw * aw + 6, bh * ah + 6);
  // cursor
  if (s.agent.status === 'working') {
    const cx = ax + (x + bw) * aw + 6 + wob * 2, cy = ay + (y + bh) * ah + 4;
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + 12, cy + 12);
    ctx.lineTo(cx + 4, cy + 13);
    ctx.closePath();
    ctx.fill();
  }
}

function research(ctx: CanvasRenderingContext2D, w: number, h: number, s: ScreenState) {
  chrome(ctx, w, 'Research — Browser', PROFILES.research.color);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 36, w, h - 36);
  const q = s.task ? s.task.title.replace(/^[^:]*:\s*/, '') : 'market overview';
  const typed = s.agent.status === 'working' ? q.slice(0, Math.min(q.length, Math.floor(s.t * 8) % (q.length + 25))) : q;
  ctx.fillStyle = '#e2e8f0';
  roundRect(ctx, 16, 46, w * 0.58, 30, 15);
  ctx.fill();
  ctx.fillStyle = '#334155';
  ctx.font = `500 14px ${FONT}`;
  ctx.fillText(fitText(ctx, '🔍 ' + typed, w * 0.58 - 24), 28, 66);
  const p = s.task ? s.task.progress / 100 : 0.5;
  const results = ['Top 10 competitors compared', 'What users expect in 2026', 'Pricing pages that convert', 'Accessibility checklist'];
  results.slice(0, 1 + Math.floor(p * 3.99)).forEach((r, i) => {
    const y = 102 + i * 50;
    ctx.fillStyle = '#1d4ed8';
    ctx.font = `600 14.5px ${FONT}`;
    ctx.fillText(r, 18, y);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(18, y + 9, w * 0.5, 6);
    ctx.fillRect(18, y + 20, w * 0.38, 6);
  });
  // notes panel
  const nx = w * 0.64;
  ctx.fillStyle = '#fef9c3';
  roundRect(ctx, nx, 46, w - nx - 14, h - 60, 8);
  ctx.fill();
  ctx.fillStyle = '#713f12';
  ctx.font = `700 14px ${FONT}`;
  ctx.fillText('Notes', nx + 12, 70);
  ctx.font = `500 12.5px ${FONT}`;
  ['Must load < 2s', 'Clear CTA above fold', 'Mobile first', 'Trust signals', 'Simple checkout'].slice(0, 1 + Math.floor(p * 4.99)).forEach((n, i) => {
    ctx.fillText('• ' + n, nx + 12, 96 + i * 22);
  });
}

function qa(ctx: CanvasRenderingContext2D, w: number, h: number, s: ScreenState) {
  chrome(ctx, w, 'Test runner', PROFILES.qa.color);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 36, w, h - 36);
  const feature = s.task ? s.task.title.replace(/^[^:]*:\s*/, '') : 'suite';
  const openBug = s.tasks.some((t) => t.source === 'qa' && t.status !== 'completed');
  const names = ['renders without errors', 'validates required fields', 'handles empty state', 'works on 375px screens', 'submits once on slow network', 'keyboard navigation', 'shows error message', 'loads under 2s'];
  const p = s.task ? s.task.progress / 100 : 1;
  const done = Math.max(1, Math.floor(names.length * p));
  ctx.font = `500 14px ${MONO}`;
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(fitText(ctx, `▸ ${feature}`, w - 30), 16, 60);
  names.forEach((n, i) => {
    const y = 86 + i * 22;
    if (i < done) {
      const fail = openBug && i === 4;
      ctx.fillStyle = fail ? '#f87171' : '#4ade80';
      ctx.fillText(fail ? '✗' : '✓', 18, y);
      ctx.fillStyle = fail ? '#fca5a5' : '#cbd5e1';
      ctx.fillText(n, 40, y);
    } else if (i === done && s.agent.status === 'working') {
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('⋯ ' + n, 18, y);
    }
  });
  ctx.fillStyle = openBug ? '#f87171' : '#4ade80';
  ctx.font = `700 14px ${MONO}`;
  ctx.fillText(`${done - (openBug && done > 4 ? 1 : 0)} passed${openBug && done > 4 ? ', 1 failed' : ''}`, 16, h - 14);
}

function manager(ctx: CanvasRenderingContext2D, w: number, h: number, s: ScreenState) {
  chrome(ctx, w, 'Sprint board', PROFILES.manager.color);
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 36, w, h - 36);
  const cols: [string, Task[]][] = [
    ['To do', s.tasks.filter((t) => t.status === 'queued')],
    ['In progress', s.tasks.filter((t) => t.status === 'running' || t.status === 'paused')],
    ['Done', s.tasks.filter((t) => t.status === 'completed')],
  ];
  const cw = (w - 40) / 3;
  cols.forEach(([name, list], ci) => {
    const x = 10 + ci * (cw + 10);
    ctx.fillStyle = '#e2e8f0';
    roundRect(ctx, x, 46, cw, h - 56, 8);
    ctx.fill();
    ctx.fillStyle = '#334155';
    ctx.font = `700 13px ${FONT}`;
    ctx.fillText(`${name}  ${list.length}`, x + 10, 66);
    list.slice(0, 5).forEach((t, i) => {
      const y = 76 + i * 44;
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, x + 8, y, cw - 16, 38, 6);
      ctx.fill();
      ctx.fillStyle = PROFILES[t.assignee].color;
      ctx.fillRect(x + 8, y, 4, 38);
      ctx.fillStyle = '#1e293b';
      ctx.font = `600 11.5px ${FONT}`;
      ctx.fillText(fitText(ctx, t.title, cw - 34), x + 18, y + 16);
      ctx.fillStyle = '#64748b';
      ctx.font = `500 11px ${FONT}`;
      ctx.fillText(PROFILES[t.assignee].name, x + 18, y + 31);
    });
  });
  if (!s.tasks.length) {
    ctx.fillStyle = '#64748b';
    ctx.font = `500 15px ${FONT}`;
    ctx.fillText('No tasks yet — waiting for a brief', 24, h / 2 + 10);
  }
}

function locked(ctx: CanvasRenderingContext2D, w: number, h: number, s: ScreenState) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#1e1b4b');
  g.addColorStop(1, '#0f172a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const d = new Date();
  ctx.fillStyle = '#e2e8f0';
  ctx.font = `300 54px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), w / 2, h / 2 - 6);
  ctx.font = `500 16px ${FONT}`;
  ctx.fillStyle = '#a5b4fc';
  ctx.fillText(`${s.agent.name} · ${s.agent.place === 'meeting' ? 'in a meeting' : s.agent.place === 'coffee' ? 'on a break' : s.agent.place === 'security' ? 'in Cyber Security' : 'away'}`, w / 2, h / 2 + 28);
  ctx.textAlign = 'left';
}

const APPS: Record<AgentId, (ctx: CanvasRenderingContext2D, w: number, h: number, s: ScreenState) => void> = {
  developer, designer, research, qa, manager,
};

export function drawScreen(ctx: CanvasRenderingContext2D, w: number, h: number, s: ScreenState) {
  ctx.clearRect(0, 0, w, h);
  if (s.agent.place !== 'desk' || s.agent.status === 'paused') return locked(ctx, w, h, s);
  APPS[s.agent.id](ctx, w, h, s);
}
