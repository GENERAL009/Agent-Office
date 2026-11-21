// Grid A* over the floor plan, plus circle-vs-box collision for the player.
import { FLOOR, OBSTACLES, type Box } from './layout';

const CELL = 0.25;
const AGENT_R = 0.3;
const COLS = Math.round((FLOOR.maxX - FLOOR.minX) / CELL);
const ROWS = Math.round((FLOOR.maxZ - FLOOR.minZ) / CELL);
const blocked = new Uint8Array(COLS * ROWS);

for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const x = FLOOR.minX + (c + 0.5) * CELL;
    const z = FLOOR.minZ + (r + 0.5) * CELL;
    if (OBSTACLES.some((b) => x > b.minX - AGENT_R && x < b.maxX + AGENT_R && z > b.minZ - AGENT_R && z < b.maxZ + AGENT_R)) blocked[r * COLS + c] = 1;
  }
}

const cellOf = (x: number, z: number) => [Math.min(COLS - 1, Math.max(0, Math.floor((x - FLOOR.minX) / CELL))), Math.min(ROWS - 1, Math.max(0, Math.floor((z - FLOOR.minZ) / CELL)))] as const;
const center = (c: number, r: number) => ({ x: FLOOR.minX + (c + 0.5) * CELL, z: FLOOR.minZ + (r + 0.5) * CELL });
const free = (c: number, r: number) => c >= 0 && r >= 0 && c < COLS && r < ROWS && !blocked[r * COLS + c];

function nearestFree(c: number, r: number): [number, number] {
  if (free(c, r)) return [c, r];
  for (let rad = 1; rad < 12; rad++) {
    for (let dc = -rad; dc <= rad; dc++) for (let dr = -rad; dr <= rad; dr++) {
      if (Math.max(Math.abs(dc), Math.abs(dr)) === rad && free(c + dc, r + dr)) return [c + dc, r + dr];
    }
  }
  return [c, r];
}

function lineFree(a: { x: number; z: number }, b: { x: number; z: number }) {
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (CELL * 0.5));
  for (let i = 0; i <= steps; i++) {
    const [c, r] = cellOf(a.x + ((b.x - a.x) * i) / steps, a.z + ((b.z - a.z) * i) / steps);
    if (!free(c, r)) return false;
  }
  return true;
}

export interface P { x: number; z: number; }

/** Walkable path from a to b (b itself is the last point, even if it sits next to furniture). */
export function findPath(a: P, b: P): P[] {
  const [sc, sr] = nearestFree(...cellOf(a.x, a.z));
  const [gc, gr] = nearestFree(...cellOf(b.x, b.z));
  const start = sr * COLS + sc, goal = gr * COLS + gc;
  const g = new Float32Array(COLS * ROWS).fill(Infinity);
  const came = new Int32Array(COLS * ROWS).fill(-1);
  const closed = new Uint8Array(COLS * ROWS);
  const open: number[] = [start];
  const f = new Float32Array(COLS * ROWS).fill(Infinity);
  g[start] = 0;
  const h = (i: number) => Math.hypot((i % COLS) - gc, Math.floor(i / COLS) - gr);
  f[start] = h(start);

  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur === goal) break;
    closed[cur] = 1;
    const cc = cur % COLS, cr = Math.floor(cur / COLS);
    for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
      if (!dc && !dr) continue;
      const nc = cc + dc, nr = cr + dr;
      if (!free(nc, nr) || (dc && dr && (!free(cc + dc, cr) || !free(cc, cr + dr)))) continue;
      const ni = nr * COLS + nc;
      if (closed[ni]) continue;
      const ng = g[cur] + (dc && dr ? 1.4142 : 1);
      if (ng < g[ni]) {
        g[ni] = ng;
        f[ni] = ng + h(ni);
        came[ni] = cur;
        if (!open.includes(ni)) open.push(ni);
      }
    }
  }

  const cells: P[] = [];
  if (came[goal] === -1 && goal !== start) return [b];
  for (let i = goal; i !== -1; i = came[i]) cells.push(center(i % COLS, Math.floor(i / COLS)));
  cells.reverse();

  // String-pulling: keep only the corners we need.
  const path: P[] = [];
  let anchor: P = a;
  for (let i = 1; i < cells.length; i++) {
    if (!lineFree(anchor, cells[i])) {
      anchor = cells[i - 1];
      path.push(anchor);
    }
  }
  path.push(b);
  return path;
}

/** Pushes a circle out of every box it overlaps. Returns the corrected position. */
export function collide(x: number, z: number, radius: number, boxes: Box[] = OBSTACLES): P {
  for (let pass = 0; pass < 2; pass++) {
    for (const b of boxes) {
      const nx = Math.max(b.minX, Math.min(x, b.maxX));
      const nz = Math.max(b.minZ, Math.min(z, b.maxZ));
      const dx = x - nx, dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          x = nx + (dx / d) * radius;
          z = nz + (dz / d) * radius;
        } else {
          // Center is inside the box: push out along the shallowest axis.
          const pushes = [x - b.minX + radius, b.maxX - x + radius, z - b.minZ + radius, b.maxZ - z + radius];
          const m = Math.min(...pushes);
          if (m === pushes[0]) x = b.minX - radius;
          else if (m === pushes[1]) x = b.maxX + radius;
          else if (m === pushes[2]) z = b.minZ - radius;
          else z = b.maxZ + radius;
        }
      }
    }
  }
  return {
    x: Math.min(FLOOR.maxX - radius, Math.max(FLOOR.minX + radius, x)),
    z: Math.min(FLOOR.maxZ - radius, Math.max(FLOOR.minZ + radius, z)),
  };
}

/** True if the straight segment a→b crosses a full-height wall (used to keep the 3rd-person camera inside). */
export function segmentHitsBox(a: P, b: P, boxes: Box[]): number {
  let best = 1;
  for (const bx of boxes) {
    let t0 = 0, t1 = 1;
    const dx = b.x - a.x, dz = b.z - a.z;
    const clip = (p: number, q: number) => {
      if (p === 0) return q >= 0;
      const r = q / p;
      if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
      else { if (r < t0) return false; if (r < t1) t1 = r; }
      return true;
    };
    if (clip(-dx, a.x - bx.minX) && clip(dx, bx.maxX - a.x) && clip(-dz, a.z - bx.minZ) && clip(dz, bx.maxZ - a.z)) best = Math.min(best, t0);
  }
  return best;
}
