// Where the Cyber Security room's screens hang and what they show: a threat map, alert feed, traffic, incidents and attack sources on the
// video wall, a SIEM event stream on the analysts' consoles, and the room sign. All of it is drawn from one clock `t`,
// so the alert on the screens, the red beacon and the room light stay in step.
import { roundRect, fitText, FONT, MONO } from './canvasTexture';
import { SOC_WALL } from '../world/layout';

/** Every 24 s an intrusion attempt comes in and is contained 7 s later. */
const ALERT_PERIOD = 24, ALERT_START = 16;
/** 0 when calm, 1 during an alert (eased in and out over half a second). */
export function socAlert(t: number) {
  const p = t % ALERT_PERIOD;
  if (p < ALERT_START) return 0;
  return Math.min(1, (p - ALERT_START) * 2, (ALERT_PERIOD - p) * 2);
}
/** The beacon: a slow glow when calm, a rotating double flash during an alert. */
export function beaconFlash(t: number) {
  const a = socAlert(t);
  const spin = t * Math.PI * 2 * 0.9;
  const flash = Math.max(0, Math.cos(spin)) ** 6 + Math.max(0, Math.cos(spin + Math.PI)) ** 6;
  return 0.18 + 0.07 * Math.sin(t * 2.2) + a * flash * 0.95;
}

const BG = '#050b16', PANEL = '#0b1426', LINE = '#1b2a44', CYAN = '#38e1ff', BLUE = '#4f7dff', DIM = '#6f83a6', TEXT = '#d8e3f5';
const RED = '#ff3b30', AMBER = '#ffb020', GREEN = '#2ee6a0';
const SEV: Record<string, string> = { CRITICAL: RED, HIGH: '#ff7a1a', MEDIUM: AMBER, LOW: BLUE, INFO: GREEN };
const rnd = (i: number) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const clock = (t: number) => {
  const s = Math.floor(21 * 3600 + 40 * 60 + t);
  return [Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60].map((n) => String(n).padStart(2, '0')).join(':');
};

/** Video wall canvas: the big middle screen, the four side screens and the door sign, each a region of one canvas. */
export const WALL_CANVAS = { w: 2048, h: 800 };
export const WALL_REGIONS = {
  main: [0, 0, 1024, 598], leftTop: [1024, 0, 512, 299], leftBottom: [1024, 299, 512, 299],
  rightTop: [1536, 0, 512, 299], rightBottom: [1536, 299, 512, 299], sign: [0, 600, 1024, 192],
  /** a plain white patch: the beacons sample it and take their colour from the mesh */
  white: [1984, 736, 64, 64],
} as const satisfies Record<string, readonly [number, number, number, number]>;
export type WallRegion = keyof typeof WALL_REGIONS;

/** TV_Wall_01 at scale 1: 1.55 × 1.02 m, with a 1.43 × 0.83 m picture whose front is 0.23 m off the wall. */
export const TV = { w: 1.55, h: 1.02, pw: 1.4286, ph: 0.834, front: 0.229 };
const W = SOC_WALL;
const SIDE_X = TV.w + TV.w / 2 + 0.05, SIDE_Y = TV.h / 2 + 0.01;
/** The video wall: one big screen in the middle, two smaller ones stacked either side. */
export const VIDEO_WALL: { region: WallRegion; x: number; y: number; s: number }[] = [
  { region: 'main', x: W.x, y: W.y, s: 2 },
  { region: 'leftTop', x: W.x - SIDE_X, y: W.y + SIDE_Y, s: 1 },
  { region: 'leftBottom', x: W.x - SIDE_X, y: W.y - SIDE_Y, s: 1 },
  { region: 'rightTop', x: W.x + SIDE_X, y: W.y + SIDE_Y, s: 1 },
  { region: 'rightBottom', x: W.x + SIDE_X, y: W.y - SIDE_Y, s: 1 },
];
export const TV_Z = W.z + 0.02;
/** Red beacons either side of the video wall, on Fire_Detector_01 plates. */
export const BEACONS: [number, number, number][] = [[W.x - 3.5, 2.62, W.z + 0.01], [W.x + 3.5, 2.62, W.z + 0.01]];
/** The room sign over the glass door, on the corridor side. */
export const SIGN = { x: 23.15, y: 2.62, z: -4.77, w: 1.3 };

// ------------------------------------------------------------------ threat map
/** Rough continent outlines (lon, lat), only good enough to fill with dots. */
const LAND: [number, number][][] = [
  [[-168, 65], [-140, 70], [-110, 72], [-85, 70], [-75, 62], [-60, 55], [-55, 48], [-65, 44], [-75, 38], [-80, 30], [-82, 25], [-90, 29], [-97, 26], [-97, 20], [-90, 16], [-84, 10], [-79, 8], [-85, 12], [-95, 16], [-105, 20], [-112, 28], [-117, 32], [-124, 40], [-125, 48], [-135, 58], [-150, 60], [-165, 58]],
  [[-50, 60], [-40, 62], [-22, 70], [-20, 80], [-40, 83], [-60, 80], [-70, 77], [-55, 70]],
  [[-80, 8], [-72, 12], [-60, 10], [-50, 0], [-35, -6], [-38, -15], [-42, -23], [-48, -28], [-58, -38], [-65, -42], [-68, -52], [-74, -50], [-73, -40], [-71, -30], [-70, -18], [-76, -12], [-81, -5], [-80, 2]],
  [[-10, 36], [-9, 43], [-2, 44], [-5, 48], [0, 50], [5, 54], [8, 57], [5, 62], [12, 66], [20, 70], [30, 71], [40, 68], [45, 60], [40, 50], [30, 46], [28, 41], [22, 40], [18, 40], [15, 38], [12, 44], [8, 44], [3, 42], [0, 38]],
  [[-6, 50], [2, 51], [0, 54], [-3, 58], [-6, 56]],
  [[-17, 15], [-17, 21], [-10, 30], [-5, 35], [10, 37], [20, 32], [32, 31], [35, 28], [43, 12], [51, 12], [45, 0], [40, -10], [40, -16], [35, -24], [32, -30], [20, -35], [17, -28], [12, -18], [13, -8], [9, -1], [8, 4], [-5, 5], [-12, 8]],
  [[28, 41], [35, 36], [35, 30], [45, 15], [55, 22], [58, 25], [62, 25], [67, 24], [72, 20], [77, 8], [80, 14], [88, 22], [92, 22], [98, 16], [100, 6], [104, 1], [106, 10], [109, 12], [108, 20], [118, 24], [122, 30], [120, 35], [122, 40], [128, 38], [130, 43], [140, 48], [142, 54], [135, 55], [140, 60], [155, 60], [163, 62], [180, 66], [180, 70], [160, 71], [140, 73], [110, 77], [90, 76], [70, 73], [60, 70], [50, 68], [45, 60], [40, 50], [30, 46]],
  [[130, 31], [135, 34], [140, 36], [141, 41], [142, 45], [140, 43], [136, 36], [131, 34]],
  [[95, 5], [105, -6], [115, -8], [125, -8], [131, -3], [141, -3], [150, -10], [140, -8], [130, -1], [119, 1], [117, 6], [110, 1], [104, -3]],
  [[114, -22], [122, -18], [130, -12], [137, -12], [142, -11], [145, -15], [153, -25], [151, -33], [146, -39], [138, -35], [132, -32], [124, -34], [115, -34], [113, -26]],
  [[172, -34], [178, -38], [174, -41], [170, -46], [167, -46], [172, -41]],
  [[44, -25], [47, -25], [50, -15], [49, -12], [44, -17]],
];
const inside = (poly: [number, number][], x: number, y: number) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
/** The office (Tashkent) and where the attempts come from. */
const HQ: [number, number] = [69.2, 41.3];
const SOURCES: [number, number][] = [[-74, 40.7], [-122.4, 37.8], [-46.6, -23.5], [2.35, 48.9], [37.6, 55.8], [116.4, 39.9], [139.7, 35.7], [77.2, 28.6], [-0.1, 51.5], [151.2, -33.9], [28, -26.2], [106.8, -6.2], [-99.1, 19.4], [126.9, 37.6], [55.3, 25.2], [13.4, 52.5]];

let dots: HTMLCanvasElement | null = null;
/** The dotted world map, drawn once. */
function mapLayer(w: number, h: number) {
  if (dots && dots.width === w && dots.height === h) return dots;
  dots = document.createElement('canvas');
  dots.width = w;
  dots.height = h;
  const ctx = dots.getContext('2d')!;
  const step = 9;
  for (let y = step / 2; y < h; y += step) for (let x = step / 2; x < w; x += step) {
    const lon = (x / w) * 360 - 180, lat = 84 - (y / h) * 140;
    if (!LAND.some((p) => inside(p, lon, lat))) continue;
    ctx.fillStyle = rnd(x * 7 + y) < 0.08 ? '#2d6cff' : '#17406e';
    ctx.beginPath();
    ctx.arc(x, y, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  return dots;
}

function header(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, title: string, color = CYAN, right?: string) {
  ctx.fillStyle = PANEL;
  ctx.fillRect(x, y, w, 40);
  ctx.fillStyle = color;
  ctx.fillRect(x, y + 38, w, 2);
  ctx.font = `700 21px ${MONO}`;
  ctx.fillText(title, x + 16, y + 27);
  if (right) {
    ctx.fillStyle = DIM;
    ctx.font = `500 18px ${MONO}`;
    ctx.fillText(right, x + w - 16 - ctx.measureText(right).width, y + 27);
  }
}

function threatMap(ctx: CanvasRenderingContext2D, [x0, y0, w, h]: readonly number[], t: number, alert: number) {
  ctx.fillStyle = BG;
  ctx.fillRect(x0, y0, w, h);
  const red = alert > 0 && Math.sin(t * 9) > -0.2;
  header(ctx, x0, y0, w, red ? '⚠ INTRUSION ATTEMPT · CONTAINING' : 'GLOBAL THREAT MAP', red ? RED : CYAN, `UTC ${clock(t)}`);
  const mx = x0 + 12, my = y0 + 52, mw = w - 24, mh = h - 112;
  ctx.drawImage(mapLayer(mw, mh), mx, my);
  const at = ([lon, lat]: [number, number]) => [mx + ((lon + 180) / 360) * mw, my + ((84 - lat) / 140) * mh] as const;
  const [hx, hy] = at(HQ);
  // attack arcs into the office: each flies for 2.6 s, then a ring where it is blocked
  for (let i = 0; i < 9; i++) {
    const life = 3.4, k = ((t + i * 0.77) % life) / life, n = Math.floor((t + i * 0.77) / life) * 9 + i;
    const [sx, sy] = at(SOURCES[Math.floor(rnd(n) * SOURCES.length)]);
    const color = alert && i % 3 === 0 ? RED : i % 4 === 0 ? AMBER : CYAN;
    const cx = (sx + hx) / 2, cy = Math.min(sy, hy) - 40 - Math.abs(sx - hx) * 0.18;
    const p = Math.min(1, k / 0.75);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.globalAlpha = 0.85 * (1 - Math.max(0, k - 0.75) / 0.25);
    ctx.beginPath();
    for (let s = 0; s <= 24; s++) {
      const u = Math.max(0, p - 0.45) + (s / 24) * Math.min(p, 0.45);
      const px = (1 - u) ** 2 * sx + 2 * (1 - u) * u * cx + u * u * hx, py = (1 - u) ** 2 * sy + 2 * (1 - u) * u * cy + u * u * hy;
      if (s) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(sx, sy, 4, 0, Math.PI * 2);
    ctx.fill();
    if (k > 0.75) {
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hx, hy, 8 + (k - 0.75) * 120, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = red ? RED : GREEN;
  ctx.beginPath();
  ctx.arc(hx, hy, 7 + Math.sin(t * 4) * 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `700 17px ${MONO}`;
  ctx.fillText('HQ · TASHKENT', hx + 14, hy - 10);
  // footer counters
  const blocked = 18432 + Math.floor(t * 1.7);
  const stats: [string, string, string][] = [
    ['BLOCKED TODAY', blocked.toLocaleString('en-US'), CYAN], ['ACTIVE THREATS', alert ? '4' : '3', alert ? RED : AMBER],
    ['ENDPOINTS OK', '1,284 / 1,290', GREEN], ['THREAT LEVEL', alert ? 'HIGH' : 'ELEVATED', alert ? RED : AMBER],
  ];
  stats.forEach(([label, value, color], i) => {
    const x = x0 + 16 + i * (w / 4);
    ctx.fillStyle = DIM;
    ctx.font = `600 14px ${MONO}`;
    ctx.fillText(label, x, y0 + h - 36);
    ctx.fillStyle = color;
    ctx.font = `800 22px ${MONO}`;
    ctx.fillText(value, x, y0 + h - 12);
  });
}

// ------------------------------------------------------------------ side screens
const ALERTS: [string, string][] = [
  ['HIGH', 'Brute-force login · VPN gateway'], ['MEDIUM', 'Port scan from 185.220.101.7'], ['LOW', 'New device on guest Wi-Fi'],
  ['HIGH', 'Phishing mail quarantined · 14 inboxes'], ['MEDIUM', 'Expired TLS cert · intranet'], ['INFO', 'Patch rollout 96% · workstations'],
  ['HIGH', 'Suspicious PowerShell · WS-0142'], ['LOW', 'Admin login outside hours · approved'], ['MEDIUM', 'DNS tunnelling pattern · blocked'],
  ['INFO', 'Backup verified · file server'], ['HIGH', 'Malware signature · USB stick, isolated'], ['LOW', 'Failed MFA x3 · user locked'],
];

function alertFeed(ctx: CanvasRenderingContext2D, [x0, y0, w, h]: readonly number[], t: number, alert: number, project?: string) {
  ctx.fillStyle = BG;
  ctx.fillRect(x0, y0, w, h);
  header(ctx, x0, y0, w, 'LIVE ALERTS', alert ? RED : CYAN, `${12 + Math.floor(t / 3) % 40} today`);
  const newest = Math.floor(t / 3);
  const rows: [string, string, number][] = [];
  if (alert) rows.push(['CRITICAL', 'Intrusion attempt · web server', newest]);
  for (let i = 0; rows.length < 7; i++) {
    const n = newest - i;
    rows.push(n % 5 === 0 && project ? ['INFO', `Code scan passed · ${project}`, n] : [...ALERTS[((n % ALERTS.length) + ALERTS.length) % ALERTS.length], n]);
  }
  rows.forEach(([sev, text, n], i) => {
    const y = y0 + 52 + i * 35;
    ctx.fillStyle = i % 2 ? '#081122' : '#0a162b';
    ctx.fillRect(x0 + 8, y, w - 16, 33);
    const c = SEV[sev];
    roundRect(ctx, x0 + 14, y + 6, 92, 21, 4);
    ctx.fillStyle = sev === 'CRITICAL' && Math.sin(t * 9) < 0 ? '#5a0d0a' : c;
    ctx.fill();
    ctx.fillStyle = '#04101f';
    ctx.font = `800 13px ${MONO}`;
    ctx.fillText(sev, x0 + 20, y + 21);
    ctx.fillStyle = TEXT;
    ctx.font = `500 16px ${FONT}`;
    ctx.fillText(fitText(ctx, text, w - 210), x0 + 116, y + 22);
    ctx.fillStyle = DIM;
    ctx.font = `500 14px ${MONO}`;
    ctx.fillText(clock(n * 3).slice(0, 5), x0 + w - 62, y + 22);
  });
}

function traffic(ctx: CanvasRenderingContext2D, [x0, y0, w, h]: readonly number[], t: number, alert: number) {
  ctx.fillStyle = BG;
  ctx.fillRect(x0, y0, w, h);
  const now = 4.2 + Math.sin(t * 0.7) * 0.4 + alert * 2.1;
  header(ctx, x0, y0, w, 'NETWORK TRAFFIC', CYAN, `in ${now.toFixed(1)} Gb/s`);
  const gx = x0 + 16, gy = y0 + 56, gw = w - 32, gh = h - 76;
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(gx, gy + (gh * i) / 4); ctx.lineTo(gx + gw, gy + (gh * i) / 4); ctx.stroke(); }
  const series = (base: number, amp: number, seed: number, color: string, spike: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const s = t * 2 - 60 + i;
      const v = base + amp * (Math.sin(s * 0.35 + seed) * 0.5 + rnd(Math.floor(s) + seed) * 0.5) + (i > 52 ? spike : 0);
      const px = gx + (gw * i) / 60, py = gy + gh - Math.min(1, v) * gh;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.stroke();
  };
  series(0.45, 0.25, 1, CYAN, alert * 0.35);
  series(0.18, 0.12, 7, BLUE, 0);
}

function incidents(ctx: CanvasRenderingContext2D, [x0, y0, w, h]: readonly number[], t: number, alert: number) {
  ctx.fillStyle = BG;
  ctx.fillRect(x0, y0, w, h);
  header(ctx, x0, y0, w, 'INCIDENTS', alert ? RED : CYAN, 'last 24 h');
  const cells: [string, string, string][] = [['OPEN', alert ? '4' : '3', alert ? RED : AMBER], ['CONTAINED', '12', GREEN], ['MEAN RESPONSE', '14 min', CYAN], ['PHISHING', '27', BLUE]];
  cells.forEach(([label, value, color], i) => {
    const cx = x0 + 16 + (i % 2) * (w / 2), cy = y0 + 58 + Math.floor(i / 2) * 116;
    roundRect(ctx, cx, cy, w / 2 - 28, 104, 10);
    ctx.fillStyle = PANEL;
    ctx.fill();
    ctx.fillStyle = DIM;
    ctx.font = `600 15px ${MONO}`;
    ctx.fillText(label, cx + 14, cy + 28);
    ctx.fillStyle = color;
    ctx.font = `800 44px ${FONT}`;
    ctx.fillText(value, cx + 14, cy + 82);
  });
  if (alert) {
    ctx.strokeStyle = RED;
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 9);
    roundRect(ctx, x0 + 16, y0 + 58, w / 2 - 28, 104, 10);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function sources(ctx: CanvasRenderingContext2D, [x0, y0, w, h]: readonly number[], t: number) {
  ctx.fillStyle = BG;
  ctx.fillRect(x0, y0, w, h);
  header(ctx, x0, y0, w, 'FIREWALL · TOP BLOCKED', CYAN, 'per hour');
  const rows: [string, number][] = [['TCP 22   ssh', 0.92], ['TCP 3389 rdp', 0.74], ['TCP 443  https', 0.55], ['UDP 53   dns', 0.41], ['TCP 445  smb', 0.33], ['TCP 23   telnet', 0.22]];
  rows.forEach(([label, v], i) => {
    const y = y0 + 58 + i * 38;
    const k = v * (0.85 + 0.15 * Math.sin(t * 0.9 + i));
    ctx.fillStyle = TEXT;
    ctx.font = `500 16px ${MONO}`;
    ctx.fillText(label, x0 + 16, y + 21);
    ctx.fillStyle = LINE;
    ctx.fillRect(x0 + 186, y + 6, w - 270, 20);
    ctx.fillStyle = i === 0 ? '#ff7a1a' : i === 1 ? AMBER : BLUE;
    ctx.fillRect(x0 + 186, y + 6, (w - 270) * k, 20);
    ctx.fillStyle = DIM;
    ctx.fillText(String(Math.round(k * 4100)), x0 + w - 74, y + 21);
  });
}

function sign(ctx: CanvasRenderingContext2D, [x0, y0, w, h]: readonly number[]) {
  ctx.fillStyle = '#0a1222';
  ctx.fillRect(x0, y0, w, h);
  ctx.fillStyle = CYAN;
  ctx.fillRect(x0, y0 + h - 8, w, 8);
  // a shield with a keyhole
  const sx = x0 + 96, sy = y0 + 92;
  ctx.beginPath();
  ctx.moveTo(sx, sy - 62);
  ctx.lineTo(sx + 52, sy - 42);
  ctx.quadraticCurveTo(sx + 50, sy + 32, sx, sy + 66);
  ctx.quadraticCurveTo(sx - 50, sy + 32, sx - 52, sy - 42);
  ctx.closePath();
  ctx.fillStyle = CYAN;
  ctx.fill();
  ctx.fillStyle = '#0a1222';
  ctx.beginPath();
  ctx.arc(sx, sy - 6, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(sx - 6, sy, 12, 30);
  ctx.fillStyle = '#eef4ff';
  ctx.font = `800 70px ${FONT}`;
  ctx.fillText('CYBER SECURITY', x0 + 186, y0 + 98);
  ctx.fillStyle = CYAN;
  ctx.font = `600 27px ${MONO}`;
  ctx.fillText('SECURITY OPERATIONS CENTRE · 24/7', x0 + 190, y0 + 148);
}

/** The whole video wall canvas at time `t`. `project` is the team's current project, scanned like any other code. */
export function drawVideoWall(ctx: CanvasRenderingContext2D, t: number, project?: string) {
  const alert = socAlert(t);
  const R = WALL_REGIONS;
  threatMap(ctx, R.main, t, alert);
  alertFeed(ctx, R.leftTop, t, alert, project);
  traffic(ctx, R.leftBottom, t, alert);
  incidents(ctx, R.rightTop, t, alert);
  sources(ctx, R.rightBottom, t);
  sign(ctx, R.sign);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(...R.white);
}

// ------------------------------------------------------------------ analyst consoles
const EVENTS = ['auth.failure', 'fw.deny', 'dns.query', 'proc.create', 'net.conn', 'file.write', 'auth.success', 'mail.quarantine', 'usb.mount', 'vpn.login'];

/** The SIEM event stream every analyst console shows (one shared canvas, see liveScreen). */
export function drawConsole(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const alert = socAlert(t);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, w, h);
  header(ctx, 0, 0, w, alert ? 'SIEM · CRITICAL ALERT' : 'SIEM · EVENT STREAM', alert ? RED : CYAN, clock(t));
  // event table on the left
  const tw = Math.round(w * 0.62);
  const top = Math.floor(t * 2.5);
  for (let i = 0; i < 13; i++) {
    const n = top - i, y = 52 + i * 39;
    const sev = alert && i < 2 ? 'CRITICAL' : (['INFO', 'LOW', 'INFO', 'MEDIUM', 'INFO', 'LOW', 'HIGH'] as const)[Math.floor(rnd(n) * 7)];
    ctx.fillStyle = i % 2 ? '#081122' : '#0a162b';
    ctx.fillRect(8, y, tw - 16, 37);
    ctx.fillStyle = SEV[sev];
    ctx.fillRect(8, y, 6, 37);
    ctx.font = `500 18px ${MONO}`;
    ctx.fillStyle = DIM;
    ctx.fillText(clock(n / 2.5), 24, y + 25);
    ctx.fillStyle = TEXT;
    ctx.fillText(EVENTS[Math.floor(rnd(n + 3) * EVENTS.length)], 140, y + 25);
    ctx.fillStyle = DIM;
    ctx.fillText(`10.0.${Math.floor(rnd(n + 5) * 40)}.${Math.floor(rnd(n + 9) * 250)}`, tw - 190, y + 25);
  }
  // events per second and severity bars on the right
  const rx = tw + 8, rw = w - tw - 16;
  roundRect(ctx, rx, 52, rw, 150, 10);
  ctx.fillStyle = PANEL;
  ctx.fill();
  ctx.fillStyle = DIM;
  ctx.font = `600 17px ${MONO}`;
  ctx.fillText('EVENTS / SEC', rx + 16, 82);
  ctx.fillStyle = alert ? RED : CYAN;
  ctx.font = `800 56px ${FONT}`;
  ctx.fillText((12400 + Math.floor(Math.sin(t * 1.3) * 380 + alert * 6100)).toLocaleString('en-US'), rx + 16, 150);
  ctx.strokeStyle = alert ? RED : CYAN;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 30; i++) {
    const v = 0.5 + 0.3 * Math.sin((t * 3 + i) * 0.6) * rnd(Math.floor(t * 3) + i);
    const px = rx + 16 + ((rw - 32) * i) / 30, py = 190 - v * 30;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.stroke();
  (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as const).forEach((sev, i) => {
    const y = 226 + i * 64;
    const v = [alert ? 0.35 : 0.04, 0.22, 0.46, 0.63, 0.9][i] * (0.9 + 0.1 * Math.sin(t + i));
    ctx.fillStyle = DIM;
    ctx.font = `600 16px ${MONO}`;
    ctx.fillText(sev, rx + 4, y + 16);
    ctx.fillStyle = LINE;
    ctx.fillRect(rx + 4, y + 26, rw - 8, 18);
    ctx.fillStyle = SEV[sev];
    ctx.fillRect(rx + 4, y + 26, (rw - 8) * v, 18);
  });
}
