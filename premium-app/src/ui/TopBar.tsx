import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useOffice, type CameraPreset } from '../store/useOffice';
import { SHOTS } from '../scene/shots';

const PRESET_LABEL: Record<CameraPreset, string> = { overview: 'Overview', workspace: 'Workspace', meeting: 'Meeting room', manager: 'Manager office', lounge: 'Lounge', kitchen: 'Kitchen', security: 'Cyber Security' };

/** Data source and simulation speed live in a small settings menu, out of the way. */
function Settings() {
  const s = useOffice();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="panel flex h-[38px] w-[38px] items-center justify-center text-[16px] hover:bg-white/8" title="Settings">⚙</button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="panel absolute right-0 top-11 z-50 w-64 p-3 text-[12.5px]">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Agent source</div>
            <select value={s.source} onChange={(e) => s.setSource(e.target.value as 'demo' | 'claude-code')}
              className="mb-3 w-full rounded-lg border border-line bg-black/30 px-2 py-1.5 outline-none">
              <option value="demo">Built-in team</option>
              <option value="claude-code">Claude Code (live hooks)</option>
            </select>
            {s.adapter.can.speed && (
              <>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Speed</div>
                <div className="mb-3 flex gap-1">
                  {[1, 2, 4].map((x) => (
                    <button key={x} onClick={() => s.setSpeed(x)} className={`flex-1 rounded-md py-1 font-semibold ${s.speed === x ? 'bg-white/14' : 'bg-white/5 text-muted hover:bg-white/10'}`}>{x}×</button>
                  ))}
                </div>
                <button onClick={() => s.setRunning(!s.running)} className="mb-3 w-full rounded-md bg-white/6 py-1.5 font-semibold hover:bg-white/12">
                  {s.running ? 'Freeze the office' : 'Unfreeze the office'}
                </button>
              </>
            )}
            <label className="flex cursor-pointer items-center justify-between">
              <span>Read replies aloud</span>
              <input type="checkbox" checked={s.voiceOn} onChange={(e) => s.setVoice(e.target.checked)} />
            </label>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Camera shots for recording: the UI hides while one plays, Esc stops it. */
function Shots() {
  const playShot = useOffice((s) => s.playShot);
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="panel flex h-[38px] items-center gap-1.5 px-3 text-[13px] font-semibold hover:bg-white/8" title="Camera shots for video">🎬 Shots</button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="panel absolute right-0 top-11 z-50 w-64 p-2 text-[12.5px]">
            {SHOTS.map((sh) => (
              <button key={sh.id} onClick={() => { setOpen(false); playShot(sh.id); }}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-white/10">
                <span>{sh.label}</span><span className="text-muted">{sh.seconds}s</span>
              </button>
            ))}
            <div className="px-2 pt-1.5 text-[11px] text-muted">The interface hides during a shot. Esc stops it.</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function TopBar() {
  const s = useOffice();
  return (
    <header className="pointer-events-auto flex flex-wrap items-center gap-2 px-4 pt-3">
      <div className="panel flex items-center gap-3 px-3 py-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-400 to-fuchsia-500 text-sm font-black text-slate-950">AI</div>
        <div className="leading-tight">
          <div className="text-[14px] font-bold">Agent Office</div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{Object.values(s.agents).filter((a) => !a.vacant).length} agents online</div>
        </div>
        {!s.adapter.isSimulated && (
          <span className="ml-1 rounded-md border border-emerald-400/40 bg-emerald-400/15 px-2 py-1 text-[11px] font-bold tracking-wide text-emerald-300">
            LIVE · CLAUDE CODE {s.liveStatus === 'open' ? '● connected' : s.liveStatus === 'error' ? '○ not reachable' : '…'}
          </span>
        )}
      </div>

      <div className="panel flex items-center gap-1 p-1">
        {(['overview', 'life'] as const).map((m) => (
          <button key={m} onClick={() => s.setMode(m)}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition ${s.mode === m ? 'bg-accent text-slate-950' : 'text-ink hover:bg-white/8'}`}>
            {m === 'overview' ? 'Overview' : 'Walk in'}
          </button>
        ))}
      </div>

      {s.mode === 'overview' && (
        <div className="panel flex items-center gap-1 p-1">
          {(Object.keys(PRESET_LABEL) as CameraPreset[]).map((p) => (
            <button key={p} onClick={() => s.goPreset(p)}
              className={`rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition ${s.preset === p ? 'bg-white/14 text-ink' : 'text-muted hover:bg-white/8 hover:text-ink'}`}>
              {PRESET_LABEL[p]}
            </button>
          ))}
        </div>
      )}
      {s.mode === 'life' && (
        <div className="panel flex items-center gap-1 p-1">
          {(['third', 'first'] as const).map((c) => (
            <button key={c} onClick={() => s.setCameraStyle(c)}
              className={`rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition ${s.cameraStyle === c ? 'bg-white/14 text-ink' : 'text-muted hover:bg-white/8'}`}>
              {c === 'third' ? '3rd person' : '1st person'}
            </button>
          ))}
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        {s.mode === 'overview' && <Shots />}
        <Settings />
      </div>
    </header>
  );
}
