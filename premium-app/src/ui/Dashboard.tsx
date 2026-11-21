import { useMemo, useState } from 'react';
import { useOffice, selectProject } from '../store/useOffice';
import { AGENT_IDS } from '../core/types';
import { PROFILES } from '../core/agents';
import { AgentBadge, Btn, Progress, Section, StatusPill, clock } from './common';

const EXAMPLES = ['Create a modern e-commerce website.', 'Build an admin dashboard with charts', 'Landing page for a coffee brand'];

function TaskInput() {
  const [text, setText] = useState('');
  const submit = useOffice((s) => s.submitProject);
  const project = useOffice(selectProject);
  const can = useOffice((s) => s.adapter.can.submit);
  const busy = !!project && project.status !== 'completed';
  const go = () => { if (text.trim() && !busy) { submit(text); setText(''); } };
  return (
    <Section title="New task for the team">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} disabled={!can}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); } }}
        placeholder={can ? 'e.g. Create a modern e-commerce website.' : 'Live mode: give tasks to Claude Code in your terminal'}
        className="w-full resize-none rounded-lg border border-line bg-black/30 px-3 py-2 text-[13px] outline-none placeholder:text-muted/70 focus:border-accent/60" />
      <div className="mt-2 flex items-center gap-2">
        <Btn variant="primary" onClick={go} disabled={!text.trim() || busy || !can} title={busy ? 'A project is already running' : ''}>▶ Start</Btn>
        {busy && <span className="text-[11px] text-muted">Project in progress…</span>}
      </div>
      {can && !busy && (
        <div className="mt-2 flex flex-wrap gap-1">
          {EXAMPLES.map((e) => (
            <button key={e} onClick={() => setText(e)} className="rounded-md bg-white/5 px-2 py-1 text-[11px] text-muted hover:bg-white/10 hover:text-ink">{e}</button>
          ))}
        </div>
      )}
    </Section>
  );
}

function Stats() {
  const agents = useOffice((s) => s.agents);
  const tasks = useOffice((s) => s.tasks);
  const project = useOffice(selectProject);
  const list = Object.values(tasks);
  const active = AGENT_IDS.filter((id) => !agents[id].vacant && ['working', 'thinking', 'error'].includes(agents[id].status)).length;
  const staffed = AGENT_IDS.filter((id) => !agents[id].vacant).length;
  const running = list.filter((t) => t.status === 'running').length;
  const completed = list.filter((t) => t.status === 'completed').length;
  const pct = Math.round(project?.progress ?? 0);
  const cards = [
    { label: 'Active Agents', value: `${active}/${staffed}`, color: '#22c55e' },
    { label: 'Running Tasks', value: running, color: '#fbbf24' },
    { label: 'Completed Tasks', value: completed, color: '#38bdf8' },
    { label: 'Project Progress', value: `${pct}%`, color: '#7c9cff' },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {cards.map((c) => (
        <div key={c.label} className="panel px-3 py-2.5">
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted">{c.label}</div>
          <div className="mt-0.5 text-[22px] font-bold tabular-nums" style={{ color: c.color }}>{c.value}</div>
        </div>
      ))}
      <div className="panel col-span-2 px-3 py-2.5">
        <div className="mb-1.5 flex items-center justify-between text-[12px]">
          <span className="truncate font-semibold">{project ? project.title : 'No project yet'}</span>
          <span className="ml-2 shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-bold uppercase text-muted">{project?.status ?? 'idle'}</span>
        </div>
        <Progress value={pct} color={project?.status === 'completed' ? '#22c55e' : '#7c9cff'} h={8} />
      </div>
    </div>
  );
}

function AgentActivity() {
  const agents = useOffice((s) => s.agents);
  const tasks = useOffice((s) => s.tasks);
  const select = useOffice((s) => s.select);
  const selected = useOffice((s) => s.selectedId);
  return (
    <Section title="Agent Activity">
      <div className="flex flex-col gap-1">
        {AGENT_IDS.filter((id) => !agents[id].vacant).map((id) => {
          const a = agents[id];
          const t = a.currentTaskId ? tasks[a.currentTaskId] : undefined;
          return (
            <button key={id} onClick={() => select(id)}
              className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/6 ${selected === id ? 'bg-white/8' : ''}`}>
              <AgentBadge id={id} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-semibold">{a.name} <span className="font-normal text-muted">· {PROFILES[id].role.replace(' Agent', '')}</span></span>
                  <StatusPill status={a.status} />
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="truncate text-[11px] text-muted">{t ? t.title : a.place === 'meeting' ? 'In the meeting room' : a.place === 'coffee' ? 'Coffee break' : a.place === 'security' ? 'In Cyber Security' : '—'}</span>
                </div>
                {t && <div className="mt-1"><Progress value={t.progress} color={a.color} h={4} /></div>}
              </div>
            </button>
          );
        })}
      </div>
    </Section>
  );
}

function Timeline() {
  const tasks = useOffice((s) => s.tasks);
  const project = useOffice(selectProject);
  const select = useOffice((s) => s.select);
  const list = useMemo(() => (project ? project.taskIds.map((i) => tasks[i]).filter(Boolean) : Object.values(tasks)), [project, tasks]);
  if (!list.length) return <Section title="Task Timeline"><p className="text-[12px] text-muted">Tasks appear here once the manager splits the project.</p></Section>;
  const start = Math.min(...list.map((t) => t.startedAt ?? t.createdAt));
  const end = Math.max(Date.now(), ...list.map((t) => t.completedAt ?? Date.now()));
  const span = Math.max(1, end - start);
  return (
    <Section title="Task Timeline" right={<span className="text-[11px] text-muted">{list.filter((t) => t.status === 'completed').length}/{list.length} done</span>}>
      <div className="scroll-thin flex max-h-56 flex-col gap-1 overflow-y-auto pr-1">
        {list.map((t) => {
          const s0 = t.startedAt ? ((t.startedAt - start) / span) * 100 : 0;
          const s1 = t.startedAt ? (((t.completedAt ?? Date.now()) - start) / span) * 100 : 0;
          const color = PROFILES[t.assignee].color;
          return (
            <button key={t.id} onClick={() => select(t.assignee, 'tasks')} className="group grid grid-cols-[1fr_92px] items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-white/5">
              <span className="truncate text-[11.5px]">
                <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: color }} />
                <span className={t.status === 'completed' ? 'text-muted line-through decoration-white/20' : ''}>{t.title}</span>
              </span>
              <span className="relative h-2.5 rounded-full bg-white/6">
                {t.startedAt && (
                  <span className="absolute top-0 h-full rounded-full" style={{ left: `${s0}%`, width: `${Math.max(3, s1 - s0)}%`, background: t.status === 'completed' ? color : `${color}aa`, outline: t.status === 'running' ? `1px solid ${color}` : undefined }} />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </Section>
  );
}

function RecentLog() {
  const logs = useOffice((s) => s.logs);
  const recent = logs.filter((l) => l.kind !== 'status').slice(-7).reverse();
  return (
    <Section title="Recent activity">
      <div className="flex flex-col gap-1">
        {recent.length === 0 && <p className="text-[12px] text-muted">Nothing yet.</p>}
        {recent.map((l) => (
          <div key={l.id} className="flex items-baseline gap-2 text-[11.5px]">
            <span className="shrink-0 font-mono text-[10.5px] text-muted">{clock(l.ts)}</span>
            <span className="shrink-0 font-semibold" style={{ color: PROFILES[l.agentId].color }}>{PROFILES[l.agentId].name}</span>
            <span className={`truncate ${l.kind === 'error' ? 'text-red-300' : l.kind === 'result' ? 'text-emerald-300' : 'text-ink/85'}`}>{l.text}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function Dashboard() {
  return (
    <div className="scroll-thin pointer-events-auto flex h-full w-[340px] flex-col gap-2 overflow-y-auto pb-3 pr-1">
      <Stats />
      <TaskInput />
      <AgentActivity />
      <Timeline />
      <RecentLog />
    </div>
  );
}
