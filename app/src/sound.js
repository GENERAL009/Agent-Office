// Qisqa signal (WebAudio). Brauzer foydalanuvchi sahifani bosmaguncha ovozni bloklaydi.
let ctx = null;
let last = 0;
export function alarmSound() {
  const now = Date.now();
  if (now - last < 2500) return;
  last = now;
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    [880, 620, 880, 620].forEach((f, i) => o.frequency.setValueAtTime(f, t + i * 0.14));
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.02);
    g.gain.setValueAtTime(0.06, t + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.62);
  } catch {}
}
