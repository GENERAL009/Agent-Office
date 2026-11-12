// A* yo'l topish: 8 yo'nalish, burchakni kesib o'tmaydi. L — joriy ofis rejasi.
const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];
const h = (a, b) => {
  const dx = Math.abs(a[0] - b[0]), dz = Math.abs(a[1] - b[1]);
  return dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz);
};

export function findPath(L, start, goal) {
  const { W, isFree } = L;
  const key = (x, z) => z * W + x;
  let s = [Math.round(start[0]), Math.round(start[1])];
  // boshlang'ich katak band bo'lsa (masalan divan), eng yaqin bo'sh qo'shnidan boshlaymiz
  if (!isFree(...s)) {
    const n = DIRS.map(([dx, dz]) => [s[0] + dx, s[1] + dz]).find((c) => isFree(...c));
    if (n) s = n;
  }
  if (s[0] === goal[0] && s[1] === goal[1]) return [goal];
  // maqsad band va unga hech bir qo'shnidan kirib bo'lmasa — eng yaqin bo'sh qo'shni maqsad bo'ladi
  const open = [{ c: s, f: h(s, goal) }];
  const g = new Map([[key(...s), 0]]);
  const came = new Map();
  const closed = new Set();
  let best = s, bestH = h(s, goal);

  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const { c } = open.splice(bi, 1)[0];
    const ck = key(...c);
    if (closed.has(ck)) continue;
    const hc = h(c, goal);
    if (hc < bestH) { best = c; bestH = hc; }
    if (c[0] === goal[0] && c[1] === goal[1]) return trace(came, c, key);
    closed.add(ck);
    for (const [dx, dz, cost] of DIRS) {
      const n = [c[0] + dx, c[1] + dz];
      const isGoal = n[0] === goal[0] && n[1] === goal[1];
      if (!isFree(...n) && !isGoal) continue;
      if (dx && dz && (!isFree(c[0] + dx, c[1]) || !isFree(c[0], c[1] + dz))) {
        // band maqsadga (divan, stul) diagonal kirishga ruxsat — burchakdagi to'siq maqsadning o'zi bo'lsa
        if (!isGoal) continue;
      }
      const nk = key(...n);
      const ng = g.get(ck) + cost;
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng);
        came.set(nk, c);
        open.push({ c: n, f: ng + h(n, goal) });
      }
    }
  }
  // yetib bo'lmadi: eng yaqin nuqtagacha, keyin maqsadga
  const p = best === s ? [] : trace(came, best, key);
  p.push(goal);
  return p;
}

function trace(came, c, key) {
  const path = [c];
  let k = key(...c);
  while (came.has(k)) { const p = came.get(k); path.unshift(p); k = key(...p); }
  path.shift();
  return path;
}
