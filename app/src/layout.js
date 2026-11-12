// Ofis rejasi: hamma narsa W x H katakli to'rda. Har katak 1x1 metr.
// Devor, stol va mebel katakni band qiladi; A* faqat bo'sh kataklardan yuradi.

export const W = 32;
export const H = 22;

// Katak markazini dunyo koordinatasiga o'tkazish
export const toWorld = ([x, z]) => [x - W / 2 + 0.5, z - H / 2 + 0.5];

const blocked = Array.from({ length: H }, () => new Array(W).fill(false));
export const walls = []; // [x, z]
const block = (x, z) => { blocked[z][x] = true; };
const wall = (x, z) => { block(x, z); walls.push([x, z]); };

// Tashqi devorlar
for (let x = 0; x < W; x++) { wall(x, 0); wall(x, H - 1); }
for (let z = 1; z < H - 1; z++) { wall(0, z); wall(W - 1, z); }

// Ichki devorlar (eshik o'rinlari tashlab ketiladi)
const hDoors1 = new Set([5, 6, 15, 16, 25, 26]);
const hDoors2 = new Set([6, 7, 17, 18, 26, 27]);
for (let x = 1; x < W - 1; x++) {
  if (!hDoors1.has(x)) wall(x, 8);
  if (!hDoors2.has(x)) wall(x, 13);
}
for (let z = 1; z < 8; z++) { wall(11, z); wall(21, z); }
for (let z = 14; z < H - 1; z++) { wall(12, z); wall(22, z); }

export const rooms = [
  { id: 'manager', name: 'Manager', x: [1, 10], z: [1, 7], color: '#d9c7a7' },
  { id: 'backend', name: 'Backend', x: [12, 20], z: [1, 7], color: '#b9cbe0' },
  { id: 'frontend', name: 'Frontend', x: [22, 30], z: [1, 7], color: '#d6bfdc' },
  { id: 'corridor', name: '', x: [1, 30], z: [8, 13], color: '#c9ccd2' },
  { id: 'devops', name: 'DevOps', x: [1, 11], z: [14, 20], color: '#bcd8c3' },
  { id: 'meeting', name: 'Majlis xonasi', x: [13, 21], z: [14, 20], color: '#e3d3b5' },
  { id: 'lounge', name: 'Dam olish', x: [23, 30], z: [14, 20], color: '#e8c8b4' },
];

// Stollar: desk — stol katagi, seat — agent o'tiradigan katak (stolga -z tomonga qaraydi)
export const desks = {
  manager: { desk: [5, 3], seat: [5, 4] },
  backend: { desk: [16, 3], seat: [16, 4] },
  frontend: { desk: [26, 3], seat: [26, 4] },
  devops: { desk: [6, 17], seat: [6, 18] },
  spare1: { desk: [13, 3], seat: [13, 4] },
  spare2: { desk: [29, 3], seat: [29, 4] },
  spare3: { desk: [9, 17], seat: [9, 18] },
  spare4: { desk: [19, 3], seat: [19, 4] },
};
for (const d of Object.values(desks)) block(...d.desk);

// Majlis stoli
export const meetingTable = { x: [15, 19], z: [16, 17] };
for (let x = 15; x <= 19; x++) for (let z = 16; z <= 17; z++) block(x, z);
export const meetingSeats = [[15, 15], [17, 15], [19, 15], [15, 18], [17, 18], [19, 18]];

// Dam olish xonasi: divan va qahva mashinasi
export const couch = { x: [24, 28], z: 19 };
for (let x = 24; x <= 28; x++) block(x, 19);
export const coffee = [30, 14];
block(...coffee);
export const coffeeSpot = [29, 15];
export const loungeSpots = [[24, 17], [26, 17], [28, 17], [25, 15], [27, 15], [24, 15], [28, 15], [26, 15]];

export const coffeeTable = { x: [25, 27], z: 18 };
for (let x = 25; x <= 27; x++) block(x, 18);
export const beanBags = [[30, 17], [30, 19]];
for (const b of beanBags) block(...b);

// Dekor
export const bookshelf = { x: [7, 8], z: 1 };
for (let x = 7; x <= 8; x++) block(x, 1);
export const serverRack = { x: [2, 3], z: 14 };
for (let x = 2; x <= 3; x++) block(x, 14);

// Qo'shimcha detallar: har biri o'z katagini band qiladi
export const props = {
  armchairs: [[1, 5], [1, 6]], // Manager: kreslolar
  globe: [9, 6],
  floorLamps: [[10, 7], [22, 1]],
  printer: [20, 5],
  coatRack: [12, 7],
  loungeChair: [23, 5],
  easel: [30, 6],
  monitorWall: { x: [10, 11], z: 14 },
  ups: [4, 14],
  standBoard: [21, 16],
  fridge: [23, 14],
  arcade: [24, 14],
  waterCooler: [1, 9],
  vending: [30, 9],
  benches: [{ x: [10, 11], z: 12 }, { x: [20, 21], z: 12 }],
};
for (const c of [...props.armchairs, props.globe, ...props.floorLamps, props.printer, props.coatRack, props.loungeChair,
  props.easel, props.ups, props.standBoard, props.fridge, props.arcade, props.waterCooler, props.vending]) block(...c);
for (let x = 10; x <= 11; x++) block(x, 14);
for (const b of props.benches) for (let x = b.x[0]; x <= b.x[1]; x++) block(x, b.z);

// Ishlamay qolgan agentlar o'tiradigan joylar (divan)
export const couchSeats = [[25, 19], [27, 19], [24, 19], [26, 19], [28, 19]];

export const plants = [[1, 1], [10, 1], [12, 1], [20, 7], [22, 7], [30, 1], [1, 20], [11, 20], [13, 20], [21, 20], [30, 20]];
for (const p of plants) block(...p);

// Devor kataklaridan uzun segmentlar yasash (vizual uchun): har qator/ustundagi 2+ uzunlikdagi qatorlar
const isWall = (x, z) => x >= 0 && z >= 0 && x < W && z < H && walls.some(([wx, wz]) => wx === x && wz === z);
export const wallSegments = [];
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

export const isFree = (x, z) => x >= 0 && z >= 0 && x < W && z < H && !blocked[z][x];

export const roomOfCell = ([x, z]) =>
  rooms.find((r) => r.id !== 'corridor' && x >= r.x[0] && x <= r.x[1] && z >= r.z[0] && z <= r.z[1])?.id ?? 'corridor';
