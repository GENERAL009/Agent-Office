import { motion } from 'motion/react';
import { useOffice, type PanelTab } from '../store/useOffice';
import { PROFILES } from '../core/agents';
import type { AgentId } from '../core/types';
import { AgentBadge, Btn, Progress, StatusPill, clock } from './common';
import { CommsFeed } from './CommsPanel';

const PLACE: Record<string, string> = { desk: 'At the desk', meeting: 'Meeting room', whiteboard: 'At the whiteboard', coffee: 'Coffee bar', visit: 'Visiting a teammate', security: 'Cyber Security' };
const TABS: { id: PanelTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'activity', label: 'Activity' },
  { id: 'comms', label: 'Comms' },
];

export function AgentPanel({ id }: { id: AgentId }) {
  const s = useOffice();
  const a = s.agents[id];
  const tasks = Object.values(s.tasks).filter((t) => t.assignee === id).sort((x, y) => x.createdAt - y.createdAt);
  const current = a.currentTaskId ? s.tasks[a.currentTaskId] : undefined;
  const done = tasks.filter((t) => t.status === 'completed');
  const logs = s.logs.filter((l) => l.agentId === id).slice(-80).reverse();
  const can = s.adapter.can;

  return (
    <motion.aside key={id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.22 }}
      className="panel pointer-events-auto flex max-h-full w-[360px] flex-col overflow-hidden">
      <div className="flex items-start gap-3 border-b border-line p-3">
        <AgentBadge id={id} size={42} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-[16px] font-bold">{a.name}</h2>
            <StatusPill status={a.status} />
          </div>
          <div className="text-[12px] text-muted">{a.role} · {PLACE[a.place] ?? a.place}</div>
        </div>
        <button onClick={() => s.select(null)} className="rounded-md px-2 py-1 text-muted hover:bg-white/8 hover:text-ink" aria-label="Close">✕</button>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-line p-3">
        <Btn variant="primary" onClick={() => s.openChat(id)} disabled={!can.chat}>💬 Talk</Btn>
        <Btn onClick={() => s.setTab('tasks')}>View Tasks</Btn>
        <Btn onClick={() => s.setTab('activity')}>View Activity</Btn>
        <Btn onClick={() => s.openModal('assign', id)} disabled={!can.assign}>＋ Assign Task</Btn>
        <Btn variant={a.status === 'paused' ? 'primary' : 'danger'} onClick={() => s.togglePause(id)} disabled={!can.pause}>
          {a.status === 'paused' ? '▶ Resume' : '❚❚ Pause'}
        </Btn>
      </div>

      <div className="flex gap-1 px-3 pt-2">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => s.setTab(t.id)}
            className={`rounded-md px-2.5 py-1 text-[12px] font-semibold ${s.tab === t.id ? 'bg-white/12 text-ink' : 'text-muted hover:text-ink'}`}>{t.label}</button>
        ))}
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
        {s.tab === 'overview' && (
          <div className="flex flex-col gap-3">
            <p className="text-[12.5px] text-ink/80">{PROFILES[id].bio}</p>
            <div className="rounded-lg border border-line bg-black/20 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">Current task</div>
              <div className="mt-1 text-[13.5px] font-semibold">{current ? current.title : 'No active task'}</div>
              {current && (
                <>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted"><span>Progress</span><span className="font-mono">{Math.round(current.progress)}%</span></div>
                  <Progress value={current.progress} color={a.color} h={7} />
                </>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[['Assigned', tasks.length], ['Done', done.length], ['Queued', tasks.filter((t) => t.status === 'queued').length]].map(([l, v]) => (
                <div key={l} className="rounded-lg bg-white/5 py-2"><div className="text-[18px] font-bold">{v}</div><div className="text-[10.5px] uppercase tracking-wider text-muted">{l}</div></div>
              ))}
            </div>
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Results</div>
              {done.length === 0 && <p className="text-[12px] text-muted">No finished work yet.</p>}
              {done.slice(-6).reverse().map((t) => (
                <div key={t.id} className="mb-1.5 rounded-lg bg-emerald-400/[0.06] px-2.5 py-1.5">
                  <div className="text-[12.5px] font-semibold text-emerald-200">✓ {t.title}</div>
                  {t.result && <div className="text-[11.5px] text-ink/70">{t.result}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {s.tab === 'tasks' && (
          <div className="flex flex-col gap-1.5">
            {tasks.length === 0 && <p className="text-[12px] text-muted">No tasks assigned yet.</p>}
            {tasks.map((t) => (
              <div key={t.id} className="rounded-lg border border-line bg-black/20 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] font-semibold">{t.title}</span>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${t.status === 'completed' ? 'bg-emerald-400/15 text-emerald-300' : t.status === 'running' ? 'bg-amber-400/15 text-amber-300' : t.status === 'paused' ? 'bg-violet-400/15 text-violet-300' : t.status === 'error' ? 'bg-red-400/15 text-red-300' : 'bg-white/8 text-muted'}`}>{t.status}</span>
                </div>
                <div className="mt-1.5"><Progress value={t.status === 'completed' ? 100 : t.progress} color={a.color} h={4} /></div>
                <div className="mt-1 flex justify-between text-[10.5px] text-muted">
                  <span>{t.source === 'user' ? 'from you' : t.source === 'qa' ? 'bug fix from QA' : 'from the plan'}</span>
                  {t.dependsOn.length > 0 && t.status === 'queued' && <span>waiting for {t.dependsOn.length} step(s)</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {s.tab === 'activity' && (
          <div className="flex flex-col gap-1">
            {logs.length === 0 && <p className="text-[12px] text-muted">No activity yet.</p>}
            {logs.map((l) => (
              <div key={l.id} className="flex gap-2 text-[12px]">
                <span className="shrink-0 font-mono text-[10.5px] text-muted">{clock(l.ts)}</span>
                <span className={l.kind === 'error' ? 'text-red-300' : l.kind === 'result' ? 'text-emerald-300' : l.kind === 'task' ? 'text-amber-200' : 'text-ink/85'}>{l.text}</span>
              </div>
            ))}
          </div>
        )}

        {s.tab === 'comms' && <CommsFeed filter={id} height="max-h-[50vh]" />}
      </div>
    </motion.aside>
  );
}
