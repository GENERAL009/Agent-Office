import type { ReactNode } from 'react';
import type { AgentId, AgentStatus, Speaker } from '../core/types';
import { PROFILES, STATUS_COLOR, STATUS_LABEL } from '../core/agents';

export function StatusPill({ status }: { status: AgentStatus }) {
  const c = STATUS_COLOR[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${c}22`, color: c }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function AgentBadge({ id, size = 28 }: { id: AgentId; size?: number }) {
  const p = PROFILES[id];
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ width: size, height: size, background: p.color, fontSize: size * 0.42 }}>
      {p.name[0]}
    </span>
  );
}

export function speakerName(s: Speaker) {
  if (s === 'user') return 'You';
  if (s === 'system') return 'System';
  return PROFILES[s].name;
}
export function speakerColor(s: Speaker) {
  if (s === 'user') return '#38bdf8';
  if (s === 'system') return '#8b93a7';
  return PROFILES[s].color;
}

export function Progress({ value, color = '#7c9cff', h = 6 }: { value: number; color?: string; h?: number }) {
  return (
    <div className="w-full overflow-hidden rounded-full bg-white/8" style={{ height: h }}>
      <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}

export function Section({ title, right, children, className = '' }: { title: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel p-3 ${className}`}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Btn({ children, onClick, variant = 'ghost', disabled, title, className = '' }: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; title?: string; className?: string;
}) {
  const styles = {
    primary: 'bg-accent text-slate-950 hover:brightness-110',
    ghost: 'bg-white/6 text-ink hover:bg-white/12 border border-line',
    danger: 'bg-red-500/15 text-red-300 hover:bg-red-500/25 border border-red-500/30',
  }[variant];
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}>
      {children}
    </button>
  );
}

export const clock = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
