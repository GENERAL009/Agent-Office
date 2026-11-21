import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useOffice } from '../store/useOffice';
import type { AgentId } from '../core/types';
import { PROFILES } from '../core/agents';
import { AgentBadge, StatusPill } from './common';
import { useSpeechInput } from '../hooks/useSpeechInput';

const SUGGEST = {
  uz: ['Hozir nima qilyapsan?', 'Qanday muammolar bor?', 'Qancha qoldi?', 'Keyingi vazifang nima?'],
  en: ['What are you doing now?', 'Any problems?', 'How far along are you?', "What's next?"],
};

function SpeakingBars({ color }: { color: string }) {
  return (
    <span className="flex h-4 items-end gap-[3px]">
      {[0, 1, 2, 3].map((i) => (
        <motion.span key={i} className="w-[3px] rounded-full" style={{ background: color }}
          animate={{ height: ['30%', '100%', '45%', '80%', '30%'] }} transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.12 }} />
      ))}
    </span>
  );
}

export function ChatWindow({ id }: { id: AgentId }) {
  const s = useOffice();
  const a = s.agents[id];
  const [text, setText] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const messages = s.messages.filter((m) => m.channel === 'direct' && (m.to === id || m.from === id));
  const task = a.currentTaskId ? s.tasks[a.currentTaskId] : undefined;

  const send = useCallback((t: string) => {
    const q = t.trim();
    if (!q || useOffice.getState().chatPending) return;
    useOffice.getState().ask(id, q);
    setText('');
  }, [id]);
  const voice = useSpeechInput(s.lang, send);

  useEffect(() => { input.current?.focus(); }, [id]);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight, behavior: 'smooth' }); }, [messages.length, s.chatPending]);

  return (
    <motion.div initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24 }} transition={{ duration: 0.2 }}
      className="panel pointer-events-auto flex h-[460px] w-[420px] flex-col overflow-hidden shadow-2xl">
      <div className="flex items-center gap-3 border-b border-line p-3">
        <div className="relative">
          <AgentBadge id={id} size={38} />
          {a.speaking && <span className="absolute -inset-1 animate-ping rounded-full border-2" style={{ borderColor: a.color }} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold">{a.name}</span>
            <StatusPill status={a.status} />
            {a.speaking && <SpeakingBars color={a.color} />}
          </div>
          <div className="truncate text-[11.5px] text-muted">{PROFILES[id].role}{task ? ` · ${task.title} (${Math.round(task.progress)}%)` : ''}</div>
        </div>
        <button onClick={() => s.openChat(null)} className="rounded-md px-2 py-1 text-muted hover:bg-white/8 hover:text-ink" aria-label="Close chat">✕</button>
      </div>

      <div ref={box} className="scroll-thin flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
        {messages.length === 0 && (
          <div className="rounded-lg bg-white/[0.04] p-3 text-[12.5px] text-ink/80">
            {s.lang === 'uz' ? `${a.name} bilan gaplashing: nima ustida ishlayotgani, muammolar yoki keyingi vazifasi haqida so‘rang.` : `Say hi to ${a.name}. Ask what they're working on, any blockers, or what's next.`}
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-snug ${m.from === 'user' ? 'self-end bg-sky-500/90 text-slate-950' : 'self-start bg-white/8'}`}>
            {m.text}
          </div>
        ))}
        {s.chatPending && <div className="self-start rounded-2xl bg-white/8 px-3 py-2 text-[13px] text-muted">{a.name} is typing…</div>}
      </div>

      <div className="flex flex-wrap gap-1 px-3 pb-2">
        {SUGGEST[s.lang].map((q) => (
          <button key={q} onClick={() => send(q)} className="rounded-full bg-white/6 px-2.5 py-1 text-[11.5px] text-ink/80 hover:bg-white/12">{q}</button>
        ))}
      </div>

      {(voice.error || voice.interim) && <div className="px-3 pb-1 text-[11.5px] text-amber-300">{voice.error ?? `🎙 ${voice.interim}`}</div>}

      <form className="flex items-center gap-2 border-t border-line p-2.5" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <button type="button" onClick={voice.listening ? voice.stop : voice.start}
          title={voice.supported ? 'Speak to the agent' : 'Speech recognition is not supported in this browser'}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition ${voice.listening ? 'animate-pulse border-red-400 bg-red-500/30' : 'border-line bg-white/6 hover:bg-white/12'} ${voice.supported ? '' : 'opacity-40'}`}>
          🎙
        </button>
        <input ref={input} value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') s.openChat(null); e.stopPropagation(); }}
          placeholder={s.lang === 'uz' ? `${a.name}ga yozing…` : `Message ${a.name}…`}
          className="min-w-0 flex-1 rounded-lg border border-line bg-black/30 px-3 py-2 text-[13px] outline-none focus:border-accent/60" />
        <button type="button" onClick={() => s.setVoice(!s.voiceOn)} title="Read replies aloud"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line ${s.voiceOn ? 'bg-white/14' : 'bg-white/6 opacity-60'}`}>
          {s.voiceOn ? '🔊' : '🔈'}
        </button>
        <button type="submit" disabled={!text.trim() || s.chatPending} className="rounded-lg bg-accent px-3 py-2 text-[13px] font-bold text-slate-950 disabled:opacity-40">Send</button>
      </form>
    </motion.div>
  );
}
