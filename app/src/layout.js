// Ofis rejasi generatori. Jamoa (rollar ro'yxati) berilsa, har bir rol uchun alohida xona yasaydi.
// Xonalar "slot"larga joylashadi va faqat oxiriga qo'shiladi, shuning uchun yangi agent kelganda
// bino o'ngga kengayadi, mavjud xonalar esa joyidan siljimaydi.
//
//   ustki qator:  [Manager] [rol1] [rol2] [rol4] ...
//   koridor       ======== kirish eshigi chapda ========
//   pastki qator: [Dam olish] [Majlis] [rol3] [rol5] ...

export const COL = 11; // bitta xona eni (10 katak ichki + 1 devor)
export const H = 22;
const TOP = { z0: 1, z1: 7, deskZ: 3 };
const BOTTOM = { z0: 14, z1: 20, deskZ: 17 };
export const ENTRANCE = [[0, 10], [0, 11]];

// Rol nomidan xona turi
export function kindOf(id = '') {
  const n = id.toLowerCase();
  if (/flutter|mobile|ios|android|dart|react-?native|expo|kotlin|swift/.test(n)) return 'mobile';
  if (/front|web|ui(?!x)|client|react|vue|angular|svelte|next/.test(n)) return 'frontend';
  if (/devops|infra|ops|sre|platform|deploy|cloud|k8s|docker/.test(n)) return 'devops';
  if (/qa|test|tester|quality|e2e/.test(n)) return 'qa';
  if (/\bml\b|^ml|ai|data|analyt|science|llm/.test(n)) return 'data';
  if (/design|ux|figma/.test(n)) return 'design';
  if (/doc|writer|content/.test(n)) return 'docs';
  if (/sec|auth|pentest/.test(n)) return 'security';
  if (/back|api|server|db|database|go|rust|java|python|node/.test(n)) return 'backend';
  return 'generic';
}

export const KIND_COLOR = {
  backend: '#3b82c4', frontend: '#b05cc2', devops: '#2f9e64', mobile: '#0ea5e9', qa: '#e8684a',
  data: '#7c4dff', design: '#ec4899', docs: '#a0784a', security: '#d9534f', generic: '#14b8a6',
};
const RUG = {
  manager: '#b9a48a', lounge: '#c99a86', meeting: '#c4b394', garden: '#a9b98f',
  backend: '#8fa4b8', frontend: '#b29bbd', devops: '#8fae99', mobile: '#8fb7c9', qa: '#c9a08f',
  data: '#a39bc4', design: '#c99bb2', docs: '#b9a68a', security: '#b99393', generic: '#93b8b0',
};
export const KIND_UZ = {
  backend: 'Backend', frontend: 'Frontend', devops: 'DevOps', mobile: 'Mobil', qa: 'QA', data: 'Data / ML',
  design: 'Dizayn', docs: 'Hujjatlar', security: 'Xavfsizlik', generic: 'Jamoa',
};

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const SPECIAL = { devops: 'DevOps', ios: 'iOS', ml: 'ML', ai: 'AI', qa: 'QA', ui: 'UI', ux: 'UX', sre: 'SRE', api: 'API', dba: 'DBA' };
export const prettyName = (id) => id.split(/[-_ ]/).map((w) => SPECIAL[w.toLowerCase()] ?? cap(w)).join(' ');

// slot raqami -> [ustun, qator]
function slotPos(i) {
  if (i === 0) return [0, 'top'];
  if (i === 1) return [0, 'bottom'];
  if (i === 2) return [1, 'bottom'];
  const k = i - 3; // 0,1,2,3...
  // rol1: ustun1 ust, rol2: ustun2 ust, rol3: ustun2 past, rol4: ustun3 ust, rol5: ustun3 past...
  if (k === 0) return [1, 'top'];
  const col = 2 + Math.floor((k - 1) / 2);
  return [col, (k - 1) % 2 === 0 ? 'top' : 'bottom'];
}

export function buildLayout(team) {
  const roles = team.filter((r) => r.id !== 'manager');
  const slots = [{ kind: 'manager', id: 'manager', name: 'Manager' }, { kind: 'lounge', id: 'lounge', name: 'Dam olish' },
    { kind: 'meeting', id: 'meeting', name: 'Majlis xonasi' },
    ...roles.map((r) => ({ kind: r.kind || kindOf(r.id), id: r.id, name: r.name || prettyName(r.id), role: true }))];
  const placed = slots.map((s, i) => ({ ...s, pos: slotPos(i) }));
  const cols = Math.max(2, ...placed.map((s) => s.pos[0] + 1));
  // bo'sh qolgan slotlar — yashil zona
  for (let c = 0; c < cols; c++) for (const row of ['top', 'bottom']) {
    if (!placed.some((s) => s.pos[0] === c && s.pos[1] === row)) placed.push({ kind: 'garden', id: `garden-${c}`, name: 'Yashil zona', pos: [c, row] });
  }

  const W = cols * COL + 1;
  const blocked = Array.from({ length: H }, () => new Array(W).fill(false));
  const wallSet = new Set();
  const walls = [];
  const inB = (x, z) => x >= 0 && z >= 0 && x < W && z < H;
  const block = (x, z) => { if (inB(x, z)) blocked[z][x] = true; };
  const wall = (x, z) => { block(x, z); const k = z * W + x; if (!wallSet.has(k)) { wallSet.add(k); walls.push([x, z]); } };
  const toWorld = ([x, z]) => [x - W / 2 + 0.5, z - H / 2 + 0.5];

  // tashqi devorlar (chapda kirish eshigi)
  for (let x = 0; x < W; x++) { wall(x, 0); wall(x, H - 1); }
  for (let z = 1; z < H - 1; z++) { if (!ENTRANCE.some(([, ez]) => ez === z)) wall(0, z); wall(W - 1, z); }
  // xonalar orasidagi devorlar
  for (let c = 1; c < cols; c++) {
    const x = c * COL;
    for (let z = 1; z < 8; z++) wall(x, z);
    for (let z = 14; z < H - 1; z++) wall(x, z);
  }

  const rooms = [];
  const desks = {};
  const decor = [];
  const plants = [];
  const windows = [];
  const lounge = {};
  const meeting = {};
  const doorsTop = new Set();
  const doorsBottom = new Set();
  const add = (type, cells, extra = {}) => { decor.push({ type, cells, ...extra }); for (const c of cells) block(...c); };
  const plant = (x, z) => { plants.push([x, z]); block(x, z); };

  for (const s of placed) {
    const [c, row] = s.pos;
    const x0 = c * COL + 1;
    const R = row === 'top' ? TOP : BOTTOM;
    const room = { id: s.id, kind: s.kind, name: s.name, role: !!s.role, row, x: [x0, x0 + 9], z: [R.z0, R.z1], rug: RUG[s.kind] ?? RUG.generic };
    rooms.push(room);
    const door = row === 'top' ? [x0 + 4, x0 + 5] : [x0 + 5, x0 + 6];
    (row === 'top' ? doorsTop : doorsBottom).add(door[0]).add(door[1]);
    room.door = door.map((x) => [x, row === 'top' ? 8 : 13]);
    const T = row === 'top';

    if (s.kind === 'manager') {
      desks.manager = { desk: [x0 + 4, 3], seat: [x0 + 4, 4], room: s.id };
      add('bookshelf', [[x0 + 6, 1], [x0 + 7, 1]]);
      add('armchairs', [[x0, 5], [x0, 6]]);
      add('globe', [[x0 + 8, 6]]);
      add('floorLamp', [[x0 + 9, 7]]);
      plant(x0, 1); plant(x0 + 9, 1);
      windows.push(['top', x0 + 1.6], ['top', x0 + 3.6], ['top', x0 + 8.8]);
      if (c === 0) windows.push(['left', 2.6], ['left', 4.2]);
    } else if (s.kind === 'lounge') {
      Object.assign(lounge, {
        couch: { x: [x0 + 3, x0 + 7], z: 19 },
        couchSeats: [[x0 + 4, 19], [x0 + 6, 19], [x0 + 3, 19], [x0 + 5, 19], [x0 + 7, 19]],
        coffeeTable: { x: [x0 + 4, x0 + 6], z: 18 },
        beanBags: [[x0 + 9, 17], [x0 + 9, 19]],
        coffee: [x0 + 9, 14],
        coffeeSpot: [x0 + 8, 15],
        spots: [[x0 + 2, 17], [x0 + 3, 16], [x0 + 7, 16], [x0 + 8, 17], [x0 + 1, 16], [x0 + 3, 15], [x0 + 7, 15], [x0 + 2, 18]],
      });
      for (let x = x0 + 3; x <= x0 + 7; x++) block(x, 19);
      for (let x = x0 + 4; x <= x0 + 6; x++) block(x, 18);
      lounge.beanBags.forEach((b) => block(...b));
      block(...lounge.coffee);
      add('fridge', [[x0, 14]]);
      add('arcade', [[x0 + 1, 14]]);
      if (c === 0) { lounge.tv = { side: 'left', z: 16.6 }; windows.push(['left', 19.2]); }
      plant(x0, 20);
    } else if (s.kind === 'meeting') {
      Object.assign(meeting, {
        table: { x: [x0 + 2, x0 + 6], z: [16, 17] },
        seats: [[x0 + 2, 15], [x0 + 4, 15], [x0 + 6, 15], [x0 + 2, 18], [x0 + 4, 18], [x0 + 6, 18]],
        screen: { x: x0 + 2.2, z: 13 },
      });
      for (let x = x0 + 2; x <= x0 + 6; x++) for (let z = 16; z <= 17; z++) block(x, z);
      add('standBoard', [[x0 + 8, 16]]);
      plant(x0, 20); plant(x0 + 9, 20);
    } else if (s.kind === 'garden') {
      const zs = T ? [1, 3, 5] : [15, 17, 19];
      for (const [i, z] of zs.entries()) { plant(x0 + 1 + (i % 2) * 2, z); plant(x0 + 7 + (i % 2), z); }
      add('bench', [[x0 + 4, T ? 3 : 17], [x0 + 5, T ? 3 : 17]]);
      if (T) windows.push(['top', x0 + 4.5]);
    } else {
      // ish xonasi: 3 ta stol (asosiy + 2 zaxira)
      const dz = R.deskZ;
      [2, 5, 8].forEach((dx, i) => {
        desks[i === 0 ? s.id : `${s.id}#${i + 1}`] = { desk: [x0 + dx, dz], seat: [x0 + dx, dz + 1], room: s.id };
        block(x0 + dx, dz);
      });
      furnishWork(s.kind, x0, T, add, plant, windows, s.id);
    }
  }

  // ichki gorizontal devorlar (eshik joylari ochiq)
  for (let x = 1; x < W - 1; x++) {
    if (!doorsTop.has(x)) wall(x, 8);
    if (!doorsBottom.has(x)) wall(x, 13);
  }

  // koridor
  const corridor = { id: 'corridor', kind: 'corridor', name: '', x: [1, W - 2], z: [9, 12] };
  rooms.push(corridor);
  add('waterCooler', [[1, 12]]);
  add('vending', [[W - 2, 9]]);
  for (let c = 1; c < cols; c++) add('bench', [[c * COL + 2, 12], [c * COL + 3, 12]]);
  decor.push({ type: 'clock', at: [8.6, 8] });
  decor.push({ type: 'sign', at: [COL + 8, 8] });
  decor.push({ type: 'runner' });
  decor.push({ type: 'entrance' });
  windows.push(['right', 10.5]);
  if (placed.some((s) => s.pos[0] === cols - 1 && s.pos[1] === 'top')) windows.push(['right', 2.6], ['right', 5.4]);
  if (placed.some((s) => s.pos[0] === cols - 1 && s.pos[1] === 'bottom')) windows.push(['right', 16.4], ['right', 19.0]);

  // devor segmentlari (vizual)
  const isWall = (x, z) => inB(x, z) && wallSet.has(z * W + x);
  const wallSegments = [];
  for (let z = 0; z < H; z++) {
    let s = null;
    for (let x = 0; x <= W; x++) {
      if (x < W && isWall(x, z)) { if (s === null) s = x; }
      else { if (s !== null && x - s >= 2) wallSegments.push({ dir: 'h', a: s, b: x - 1, at: z, outer: z === 0 || z === H - 1 }); s = null; }
    }
  }
  for (let x = 0; x < W; x++) {
    let s = null;
    for (let z = 0; z <= H; z++) {
      if (z < H && isWall(x, z)) { if (s === null) s = z; }
      else { if (s !== null && z - s >= 2) wallSegments.push({ dir: 'v', a: s, b: z - 1, at: x, outer: x === 0 || x === W - 1 }); s = null; }
    }
  }

  const isFree = (x, z) => inB(x, z) && !blocked[z][x];
  const roomOf = (id) => rooms.find((r) => r.id === id);
  const roomAt = ([x, z]) => rooms.find((r) => r.kind !== 'corridor' && x >= r.x[0] && x <= r.x[1] && z >= r.z[0] && z <= r.z[1]) ?? corridor;

  return {
    W, H, cols, toWorld, isFree, walls, wallSegments, rooms, desks, decor, plants, windows, lounge, meeting,
    roomOf, roomAt, entrance: ENTRANCE, bossStart: [1, 10.5], key: rooms.map((r) => r.id).join('|'),
  };
}

// Rol turiga qarab xona jihozlari
function furnishWork(kind, x0, T, add, plant, windows, id) {
  const back = T ? 1 : 14; // kameradan uzoq qator (devor tomonda)
  const side = T ? [5, 6, 7] : [15, 16, 19];
  plant(x0, T ? 1 : 20);
  if (T) plant(x0 + 9, 7); else plant(x0 + 9, 14);
  const wallItems = []; // ustki xonalarda orqa devorga osiladiganlar

  switch (kind) {
    case 'devops':
    case 'security':
      add('serverRack', [[x0 + 1, back], [x0 + 2, back]], { alert: true });
      add('ups', [[x0 + 3, back]]);
      add('monitorWall', [[x0 + 7, back], [x0 + 8, back]]);
      if (T) windows.push(['top', x0 + 5.0]);
      break;
    case 'data':
      add('serverRack', [[x0 + 1, back], [x0 + 2, back]], { gpu: true });
      add('standBoard', [[x0 + 9, side[1]]], { chart: true });
      if (T) windows.push(['top', x0 + 6.6]);
      break;
    case 'mobile':
      add('deviceLab', [[x0 + 6, back], [x0 + 7, back]]);
      add('phoneStand', [[x0 + 9, side[1]]]);
      add('beanBag', [[x0, side[2]]]);
      if (T) { wallItems.push(['stickyBoard', x0 + 2.6]); windows.push(['top', x0 + 9.0]); }
      break;
    case 'frontend':
    case 'design':
      add('easel', [[x0 + 9, side[0]]]);
      add('loungeChair', [[x0, side[1]]]);
      if (T) { wallItems.push(['stickyBoard', x0 + 5]); windows.push(['top', x0 + 1.6], ['top', x0 + 8.4]); }
      else add('standBoard', [[x0 + 9, side[2]]]);
      break;
    case 'qa':
      add('standBoard', [[x0 + 9, side[0]]], { bugs: true });
      add('printer', [[x0, side[1]]]);
      if (T) { wallItems.push(['stickyBoard', x0 + 5, { bugs: true }]); windows.push(['top', x0 + 1.6], ['top', x0 + 8.4]); }
      break;
    case 'docs':
      add('bookshelf', [[x0 + 6, back], [x0 + 7, back]]);
      add('armchairs', [[x0, side[1]]]);
      if (T) windows.push(['top', x0 + 2.4]);
      break;
    case 'backend':
    default:
      add('printer', [[x0 + 9, side[0]]]);
      add('coatRack', [[x0, side[1]]]);
      if (T) { wallItems.push(['stickyBoard', x0 + 5]); windows.push(['top', x0 + 1.6], ['top', x0 + 8.4]); }
      else add('standBoard', [[x0 + 9, side[2]]]);
      break;
  }
  for (const [type, x, extra] of wallItems) add(type, [], { at: [x, 0], room: id, ...extra });
}
