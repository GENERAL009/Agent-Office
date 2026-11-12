// Yozib olingan sessiyani qayta o'ynatish: { events: [{ t, ev }] } faylidan hodisalarni
// vaqt oralig'i bilan handleEvent'ga beradi. Oxirida biroz kutib, boshidan boshlaydi.
import { useOffice } from './store.js';
import { handleEvent } from './live.js';

let token = 0;

export function replayUrl() {
  try {
    return new URLSearchParams(location.search).get('replay') || window.__AO_REPLAY || null;
  } catch {
    return window.__AO_REPLAY || null;
  }
}

export async function startReplay(url) {
  const my = ++token;
  const S = useOffice.getState;
  S().setConn('connecting');
  let data;
  try {
    data = await (await fetch(url)).json();
  } catch {
    S().setConn('error');
    return;
  }
  const events = data.events ?? data;
  useOffice.setState({ replayInfo: { title: data.title, recordedAt: data.recordedAt, total: events.length, at: 0 } });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  while (my === token) {
    S().setMode('live');
    S().setConn('replay');
    if (data.project) useOffice.setState({ project: data.project });
    await wait(800);
    let prev = 0;
    for (let i = 0; i < events.length && my === token; i++) {
      const { t, ev } = events[i];
      // haqiqiy oraliqlar juda qisqa — agentlar yurib ulgurishi uchun cho'zamiz
      const gap = Math.min(3200, Math.max(450, (t - prev) * 1.6));
      prev = t;
      await wait(gap);
      if (my !== token) return;
      handleEvent(ev);
      useOffice.setState({ replayInfo: { ...S().replayInfo, at: i + 1 } });
    }
    await wait(9000);
  }
}

export function stopReplay() { token++; }
