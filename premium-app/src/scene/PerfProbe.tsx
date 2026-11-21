// Frame-time probe for the Ep7 "it used to stutter" segment: ?perf=<shot id> plays that camera shot in real time
// (after the office has loaded) and records every frame's duration and draw calls into window.__perf.
// Add &legacy to measure the first version, before static props were merged (see StaticBatch).
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useOffice } from '../store/useOffice';
import { findShot } from './shots';

export const PERF_SHOT = new URLSearchParams(location.search).get('perf');

type Perf = { stage: string; shot: string; legacy: boolean; frames: { t: number; ms: number; calls: number; scene: number; tris: number }[] };
const perf: Perf = { stage: 'loading', shot: PERF_SHOT ?? '', legacy: new URLSearchParams(location.search).has('legacy'), frames: [] };
(window as unknown as { __perf: Perf }).__perf = perf;

let scenePass = 0;

export function PerfProbe() {
  const gl = useThree((s) => s.gl);
  const last = useRef(0);
  const start = useRef(0);
  useEffect(() => {
    if (!PERF_SHOT || !findShot(PERF_SHOT)) return;
    gl.info.autoReset = false;
    // Also note the biggest single render() of each frame: that is the main scene pass (the rest are post effects).
    const render = gl.render.bind(gl);
    gl.render = (scene, camera) => {
      const before = gl.info.render.calls;
      render(scene, camera);
      scenePass = Math.max(scenePass, gl.info.render.calls - before);
    };
    const timer = setTimeout(() => {
      perf.stage = 'recording';
      start.current = performance.now();
      last.current = start.current;
      gl.info.reset();
      useOffice.getState().playShot(PERF_SHOT);
    }, 9000);
    return () => { clearTimeout(timer); gl.info.autoReset = true; gl.render = render; };
  }, [gl]);
  // Runs before the frame is drawn: what is in gl.info now is everything the previous frame drew.
  useFrame(() => {
    if (perf.stage !== 'recording') return;
    const now = performance.now();
    perf.frames.push({ t: (now - start.current) / 1000, ms: now - last.current, calls: gl.info.render.calls, scene: scenePass, tris: gl.info.render.triangles });
    last.current = now;
    gl.info.reset();
    scenePass = 0;
    if (!useOffice.getState().shot && perf.frames.length > 5) perf.stage = 'done';
  }, -1000);
  return null;
}
