import { useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { useOffice, selectProject } from '../store/useOffice';
import { AGENT_IDS, type AgentId, type Task } from '../core/types';
import { PROFILES } from '../core/agents';
import { AgentBadge, Btn, Progress, StatusPill } from './common';
import { CommsFeed } from './CommsPanel';

function Shell({ title, children, wide }: { title: string; children: ReactNode; wide?: boolean }) {
  const close = () => useOffice.getState().openModal(null);
  return (
    <motion.div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
      <motion.div className={`panel flex max-h-[85vh] w-full flex-col overflow-hidden shadow-2xl ${wide ? 'max-w-4xl' : 'max-w-md'}`}
        initial={{ y: 20, scale: 0.98 }} animate={{ y: 0, scale: 1 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-[15px] font-bold">{title}</h2>
          <button onClick={close} className="rounded-md px-2 py-1 text-muted hover:bg-white/8 hover:text-ink">✕</button>
        </div>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </motion.div>
    </motion.div>
  );
}

function Kanban({ tasks }: { tasks: Task[] }) {
  const cols: [string, Task[]][] = [
    ['Queued', tasks.filter((t) => t.status === 'queued')],
    ['Running', tasks.filter((t) => t.status === 'running' || t.status === 'paused')],
    ['Completed', tasks.filter((t) => t.status === 'completed')],
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {cols.map(([name, list]) => (
        <div key={name} className="rounded-xl bg-black/25 p-2">
          <div className="mb-2 flex justify-between px-1 text-[11px] font-semibold uppercase tracking-wider text-muted"><span>{name}</span><span>{list.length}</span></div>
          <div className="flex flex-col gap-1.5">
            {list.map((t) => (
              <div key={t.id} className="rounded-lg border border-line bg-white/[0.04] p-2">
                <div className="flex items-center gap-1.5"><AgentBadge id={t.assignee} size={18} /><span className="truncate text-[12px] font-semibold">{t.title}</span></div>
                {t.status !== 'queued' && <div className="mt-1.5"><Progress value={t.status === 'completed' ? 100 : t.progress} color={PROFILES[t.assignee].color} h={4} /></div>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function WhiteboardModal() {
  const project = useOffice(selectProject);
  const tasks = useOffice((s) => s.tasks);
  const list = project ? project.taskIds.map((i) => tasks[i]).filter(Boolean) : Object.values(tasks);
  return (
    <Shell title="Project whiteboard" wide>
      {project ? (
        <div className="mb-4">
          <div className="mb-1 flex justify-between text-[13px]"><span className="font-semibold">{project.title}</span><span className="font-mono">{Math.round(project.progress)}%</span></div>
          <Progress value={project.progress} h={10} color={project.status === 'completed' ? '#22c55e' : '#7c9cff'} />
        </div>
      ) : <p className="mb-3 text-[13px] text-muted">No project yet.</p>}
      <Kanban tasks={list} />
    </Shell>
  );
}

export function MeetingModal() {
  const agents = useOffice((s) => s.agents);
  const here = AGENT_IDS.filter((id) => agents[id].place === 'meeting');
  return (
    <Shell title="Meeting room">
      <div className="mb-3 flex items-center gap-2">
        {here.length ? here.map((id) => <AgentBadge key={id} id={id} size={26} />) : <span className="text-[12.5px] text-muted">Nobody is in the meeting room right now. Discussions below are from the team channel.</span>}
      </div>
      <CommsFeed height="max-h-[55vh]" />
    </Shell>
  );
}

export function AssignModal() {
  const s = useOffice();
  const [agent, setAgent] = useState<AgentId>(s.assignFor ?? 'developer');
  const [title, setTitle] = useState('');
  const go = () => { if (title.trim()) { s.assignTask(agent, title); s.openModal(null); s.select(agent, 'tasks'); } };
  return (
    <Shell title="Assign a task">
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted">Agent</label>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {AGENT_IDS.map((id) => (
          <button key={id} onClick={() => setAgent(id)} className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[12.5px] ${agent === id ? 'border-accent bg-accent/15' : 'border-line hover:bg-white/6'}`}>
            <AgentBadge id={id} size={18} /> {PROFILES[id].name}
          </button>
        ))}
      </div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted">Task</label>
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') go(); }}
        placeholder="e.g. Add a dark mode toggle"
        className="mb-3 w-full rounded-lg border border-line bg-black/30 px-3 py-2 text-[13px] outline-none focus:border-accent/60" />
      <Btn variant="primary" onClick={go} disabled={!title.trim()}>Assign to {PROFILES[agent].name}</Btn>
    </Shell>
  );
}

export function ManagerModal() {
  const s = useOffice();
  const project = selectProject(s);
  const list = Object.values(s.tasks).sort((a, b) => a.createdAt - b.createdAt);
  const [title, setTitle] = useState('');
  return (
    <Shell title="Manager office · Task management" wide>
      <div className="mb-4 grid grid-cols-5 gap-2">
        {AGENT_IDS.map((id) => (
          <button key={id} onClick={() => { s.openModal(null); s.select(id); }} className="rounded-xl bg-black/25 p-2 text-left hover:bg-white/6">
            <div className="flex items-center gap-1.5"><AgentBadge id={id} size={20} /><span className="text-[12.5px] font-semibold">{s.agents[id].name}</span></div>
            <div className="mt-1.5"><StatusPill status={s.agents[id].status} /></div>
          </button>
        ))}
      </div>
      {s.adapter.can.submit && (
        <div className="mb-4 flex gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.stopPropagation()} placeholder="New project for the team…"
            className="flex-1 rounded-lg border border-line bg-black/30 px-3 py-2 text-[13px] outline-none focus:border-accent/60" />
          <Btn variant="primary" disabled={!title.trim() || (!!project && project.status !== 'completed')} onClick={() => { s.submitProject(title); setTitle(''); s.openModal(null); }}>▶ Start project</Btn>
          {s.adapter.can.assign && <Btn onClick={() => s.openModal('assign')}>＋ Assign task</Btn>}
        </div>
      )}
      <table className="w-full text-left text-[12.5px]">
        <thead className="text-[11px] uppercase tracking-wider text-muted">
          <tr><th className="py-1.5">Task</th><th>Agent</th><th>Status</th><th className="w-32">Progress</th></tr>
        </thead>
        <tbody>
          {list.length === 0 && <tr><td colSpan={4} className="py-3 text-muted">No tasks yet.</td></tr>}
          {list.map((t) => (
            <tr key={t.id} className="border-t border-line">
              <td className="py-1.5 pr-2">{t.title}</td>
              <td><span className="flex items-center gap-1.5"><AgentBadge id={t.assignee} size={18} />{PROFILES[t.assignee].name}</span></td>
              <td className="uppercase text-[10.5px] font-bold text-muted">{t.status}</td>
              <td><Progress value={t.status === 'completed' ? 100 : t.progress} color={PROFILES[t.assignee].color} h={5} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Shell>
  );
}
