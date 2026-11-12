// Log oqimi ofisni ko'mib yubormasligi uchun: oddiy qatorlar manba boshiga
// soniyasiga ko'pi bilan 4 ta, xatolar soniyasiga 3 ta (ulardan keyingilari sanaladi).
export class RateLimit {
  constructor(info = 4, err = 3) { this.max = { info, warn: info, error: err }; this.b = new Map(); }
  allow(source, level) {
    const now = Math.floor(Date.now() / 1000);
    let s = this.b.get(source);
    if (!s || s.sec !== now) { s = { sec: now, info: 0, warn: 0, error: 0 }; this.b.set(source, s); }
    s[level] += 1;
    return s[level] <= this.max[level];
  }
}
