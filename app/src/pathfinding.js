// A* yo'l topish: 8 yo'nalish, burchakni kesib o'tmaydi.
import { W, isFree } from './layout.js';

const key = (x, z) => z * W + x;
const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];
const h = (a, b) => {
  const dx = Math.abs(a[0] - b[0]), dz = Math.abs(a[1] - b[1]);
  return dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz);
};

export function findPath(start, goal) {
  const s = [Math.round(start[0]), Math.round(start[1])];
  if (s[0] === goal[0] && s[1] === goal[1]) return [goal];
  const open = [{ c: s, f: h(s, goal) }];
  const g = new Map([[key(...s), 0]]);
  const came = new Map();
  const closed = new Set();

  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const { c } = open.splice(bi, 1)[0];
    const ck = key(...c);
    if (closed.has(ck)) continue;
    if (c[0] === goal[0] && c[1] === goal[1]) {
      const path = [c];
      let k = ck;
      while (came.has(k)) { const p = came.get(k); path.unshift(p); k = key(...p); }
      path.shift(); // boshlang'ich katak kerak emas
      return path;
    }
    closed.add(ck);
    for (const [dx, dz, cost] of DIRS) {
      const n = [c[0] + dx, c[1] + dz];
      const isGoal = n[0] === goal[0] && n[1] === goal[1];
      if (!isFree(...n) && !isGoal) continue;
      if (dx && dz && (!isFree(c[0] + dx, c[1]) || !isFree(c[0], c[1] + dz))) continue;
      const nk = key(...n);
      const ng = g.get(ck) + cost;
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng);
        came.set(nk, c);
        open.push({ c: n, f: ng + h(n, goal) });
      }
    }
  }
  return [goal]; // yo'l topilmasa to'g'ri boradi (bo'lmasligi kerak)
}
