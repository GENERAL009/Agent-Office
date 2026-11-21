import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useOffice } from '../store/useOffice';
import type { AgentId } from '../core/types';
import { Section, clock, speakerColor, speakerName } from './common';

export function CommsFeed({ filter, max = 60, height = 'max-h-72' }: { filter?: AgentId; max?: number; height?: string }) {
  const messages = useOffice((s) => s.messages);
  const list = messages
    .filter((m) => m.channel === 'team' && (!filter || m.from === filter || m.to === filter))
    .slice(-max);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight, behavior: 'smooth' }); }, [list.length]);
  return (
    <div ref={box} className={`scroll-thin flex ${height} flex-col gap-1.5 overflow-y-auto pr-1`}>
      {list.length === 0 && <p className="text-[12px] text-muted">No messages yet. Start a project to see the team talk.</p>}
      <AnimatePresence initial={false}>
        {list.map((m) => (
          <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
            className="rounded-lg bg-white/[0.035] px-2.5 py-1.5">
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="font-bold" style={{ color: speakerColor(m.from) }}>{speakerName(m.from)}</span>
              {m.to && m.to !== 'all' && <span className="text-muted">→ {m.to === 'user' ? 'You' : speakerName(m.to)}</span>}
              {m.inMeeting && <span className="rounded bg-indigo-400/15 px-1 text-[10px] font-semibold text-indigo-300">meeting</span>}
              <span className="ml-auto font-mono text-[10px] text-muted">{clock(m.ts)}</span>
            </div>
            <div className="mt-0.5 text-[12.5px] leading-snug text-ink/90">{m.text}</div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function CommsPanel() {
  return (
    <Section title="Agent Communication" right={<span className="flex items-center gap-1 text-[11px] text-emerald-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />team channel</span>}>
      <CommsFeed />
    </Section>
  );
}
