// Render mode (?render=arrive,flyover&fps=30): plays camera shots on a fixed clock and sends every frame to
// tools/capture.mjs, which encodes them to MP4. Frames are stepped by hand (frameloop "never"), so a slow or
// throttled browser still gives smooth video. The demo simulation is stepped on the same clock.
//
// Besides shot ids, the list can hold:
//   submit           start a project (title from &project=…)
//   wait12.5         let 12.5 s pass without recording
//   speed3           run the simulation 3× faster (speed1 to go back)
//   coffee-research  send an agent on a coffee break now (back at the desk 70 s later)
//   until-research   let time pass until that agent is working on a task (max 10 min)
//   desk-research    send that agent to their desk and keep them there for 90 s; seated-research waits until they sit
//   pov1 … pov6      first-person walks from povScript.ts (use with &ui=life&ext=1 so the HUD is in the frame)
// Other options:
//   &still=0.2,0.8   only grab single frames at these fractions of each shot (for framing checks)
//   &ext=1           don't post frames; a headless-browser driver screenshots the page after each frame instead
//   &tag=b           add this suffix to every output name (to keep a second take of a shot)
//   &fov=58          vertical field of view for every shot and the walk (e.g. for a 4:5 render, &w=1080&h=1350)
//   &ui=full         keep the whole interface (panels, labels) on screen while shots play; use with &ext=1
//   &dpr=2           render at 2× the pixel size (w=1920&h=1080&dpr=2 gives 3840 × 2160 frames, same framing)
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { useOffice } from '../store/useOffice';
import { findShot } from './shots';
import { POV, povAt, type PovSegment } from './povScript';
import { player } from '../world/runtime';
import { SimulationAdapter } from '../core/simulation/SimulationAdapter';
import type { AgentId } from '../core/types';
import { replayAdvance } from '../core/plugin/PluginAdapter';

export const RENDER = (() => {
  const p = new URLSearchParams(location.search);
  const list = p.get('render');
  if (!list) return null;
  return {
    shots: list.split(','), fps: Number(p.get('fps') ?? 30), w: Number(p.get('w') ?? 1920), h: Number(p.get('h') ?? 1080),
    still: p.get('still')?.split(',').map(Number) ?? null, ext: p.get('ext') === '1', ui: p.get('ui'),
    project: p.get('project') ?? 'Landing page for a coffee shop', tag: p.get('tag') ?? '',
    fov: p.get('fov') ? Number(p.get('fov')) : null, dpr: Number(p.get('dpr') ?? 1),
  };
})();

const CAPTURE = 'http://127.0.0.1:4790';
/** Progress, readable from the console as window.__render. */
export const renderStatus = { stage: 'loading', shot: '', frame: 0, frames: 0, done: [] as string[], error: '', simTime: 0 };
type Ext = { __render: typeof renderStatus; __frameReady: null | { shot: string; frame: number }; __frameDone: () => void };
const win = window as unknown as Ext;
win.__render = renderStatus;
win.__frameReady = null;

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

/** Hand one frame to the outside driver (ext mode) and wait until it has taken its screenshot. */
const handOff = (shot: string, frame: number) => new Promise<void>((resolve) => {
  win.__frameDone = () => { win.__frameReady = null; resolve(); };
  win.__frameReady = { shot, frame };
});

function setInput(text: string) {
  const el = document.querySelector<HTMLInputElement>('form input');
  if (!el) return;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, text);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

export function RenderController() {
  const get = useThree((s) => s.get);
  useEffect(() => {
    if (!RENDER) return;
    let cancelled = false;
    const labels = document.getElementById('label-layer');
    if (labels && RENDER.ui !== 'life' && RENDER.ui !== 'full') labels.style.display = 'none';
    const run = async () => {
      const { gl, advance } = get();
      const dt = 1 / RENDER.fps;
      let t = 0, simAcc = 0;
      const sim = () => useOffice.getState().adapter as unknown as SimulationAdapter;
      const step = (d = dt) => {
        t += d;
        simAcc += d;
        while (simAcc >= SimulationAdapter.TICK) { simAcc -= SimulationAdapter.TICK; sim().tick?.(); renderStatus.simTime += SimulationAdapter.TICK; }
        replayAdvance(t);
        advance(t);
      };
      const grab = async (shotId: string, i: number) => {
        const id = shotId + RENDER.tag;
        if (RENDER.ext) return handOff(id, i);
        const blob = await new Promise<Blob | null>((r) => gl.domElement.toBlob(r, 'image/jpeg', 0.95));
        await fetch(`${CAPTURE}/frame/${id}/${i}`, { method: 'POST', body: blob });
      };
      const encode = async (shotId: string) => {
        const id = shotId + RENDER.tag;
        if (RENDER.ext || RENDER.still) return;
        renderStatus.stage = 'encoding';
        const res = await fetch(`${CAPTURE}/encode/${id}/${RENDER.fps}`, { method: 'POST' }).then((r) => r.json());
        if (!res.ok) renderStatus.error += `${id}: ${res.err}\n`;
      };

      // Let the models load and the office settle before the first shot.
      await tick(4000);
      for (let i = 0; i < RENDER.fps * 3; i++) { step(); await tick(); }

      for (const id of RENDER.shots) {
        if (cancelled) return;
        Object.assign(renderStatus, { stage: 'rendering', shot: id, frame: 0, frames: 0 });
        if (id === 'submit') { useOffice.getState().submitProject(RENDER.project); continue; }
        if (/^speed[\d.]+$/.test(id)) { sim().setSpeed(Number(id.slice(5))); continue; }
        if (id.startsWith('coffee-')) { sim().stageCoffee(id.slice(7) as AgentId, 70); continue; }
        if (id.startsWith('desk-')) { sim().stageDesk(id.slice(5) as AgentId, 90); continue; }
        if (id.startsWith('seated-')) {
          const who = id.slice(7) as AgentId;
          const seated = () => { const a = useOffice.getState().agents[who]; return a.place === 'desk' && !!a.arrived; };
          for (let i = 0; i < RENDER.fps * 120 && !seated(); i++) { step(); renderStatus.frame = i + 1; if (i % 4 === 0) await tick(); }
          continue;
        }
        if (id.startsWith('until-')) {
          const who = id.slice(6) as AgentId;
          const busy = () => {
            const st = useOffice.getState();
            const task = st.agents[who].currentTaskId ? st.tasks[st.agents[who].currentTaskId!] : undefined;
            return task?.status === 'running' && st.agents[who].place === 'desk' && !!st.agents[who].arrived;
          };
          for (let i = 0; i < RENDER.fps * 600 && !busy(); i++) { step(); renderStatus.frame = i + 1; if (i % 4 === 0) await tick(); }
          continue;
        }
        if (/^wait[\d.]+$/.test(id)) {
          const n = Math.round(Number(id.slice(4)) * RENDER.fps);
          renderStatus.frames = n;
          for (let i = 0; i < n; i++) { step(); renderStatus.frame = i + 1; if (i % 4 === 0) await tick(); }
          continue;
        }
        const pov = POV.find((p) => p.id === id);
        if (pov) { await playPov(pov); renderStatus.done.push(id); continue; }

        const shot = findShot(id);
        if (!shot) { renderStatus.error += `unknown item ${id}\n`; continue; }
        useOffice.getState().playShot(id);
        await tick(50); // let the camera pick the shot up
        const total = Math.ceil(shot.seconds * RENDER.fps) + 1;
        renderStatus.frames = total;
        if (RENDER.still) {
          // Jump to each requested moment of the shot and grab one frame there.
          let at = 0;
          for (const [k, f] of RENDER.still.entries()) {
            const target = f * shot.seconds;
            step(Math.max(dt, target - at));
            at = target;
            await grab(`still-${id}`, k + 1);
          }
        } else {
          for (let i = 0; i < total; i++) {
            if (cancelled) return;
            step();
            renderStatus.frame = i + 1;
            await grab(id, i + 1);
          }
        }
        useOffice.getState().playShot(null);
        await encode(id);
        renderStatus.done.push(id);
        await tick(50);
      }
      renderStatus.stage = 'finished';

      async function playPov(seg: PovSegment) {
        const st = useOffice.getState();
        if (st.mode !== 'life') {
          st.setMode('life');
          st.setCameraStyle('first');
          await tick(100);
        }
        const place = (time: number) => {
          const p = povAt(seg, time);
          if (player.seat) { player.pitch = p.pitch; return; }
          Object.assign(player, { x: p.x, z: p.z, y: 0, vy: 0, yaw: p.yaw, facing: p.yaw, pitch: p.pitch });
        };
        // Settle the first-person camera on the start of the walk before recording.
        place(0);
        for (let i = 0; i < RENDER!.fps * 1.6; i++) { place(0); step(); if (i % 4 === 0) await tick(); }
        const total = Math.ceil(seg.seconds * RENDER!.fps) + 1;
        renderStatus.frames = total;
        const events = [...seg.events];
        let typing: { t: number; text: string; seconds: number; shown: number } | null = null;
        for (let i = 0; i < total; i++) {
          if (cancelled) return;
          const time = i / RENDER!.fps;
          while (events.length && events[0].t <= time) {
            const e = events.shift()!;
            const s = useOffice.getState();
            if (e.kind === 'chat') s.openChat(e.agent);
            if (e.kind === 'close') s.openChat(null);
            if (e.kind === 'send') { typing = null; document.querySelector<HTMLFormElement>('form')?.requestSubmit(); }
            if (e.kind === 'sit') Object.assign(player, { seat: e.seat, x: e.seat.x, z: e.seat.z, facing: e.seat.rot, yaw: e.seat.rot });
            if (e.kind === 'stand') player.seat = null;
            if (e.kind === 'type') typing = { ...e, shown: 0 };
          }
          if (typing) {
            // One character at a time over `seconds`, as the frames go by.
            const n = Math.min(typing.text.length, Math.ceil(((time - typing.t) / typing.seconds) * typing.text.length));
            if (n !== typing.shown) { typing.shown = n; setInput(typing.text.slice(0, n)); }
          }
          place(time);
          step();
          renderStatus.frame = i + 1;
          await tick(); // let React commit HUD changes before the screenshot
          await grab(seg.id, i + 1);
        }
        await encode(seg.id);
      }
    };
    run().catch((e) => { renderStatus.stage = 'error'; renderStatus.error = String(e); });
    return () => { cancelled = true; };
  }, [get]);
  return null;
}
