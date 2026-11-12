// Haqiqiy quyosh: joylashuvni aniqlaydi (GPS → IP → taxminiy), quyosh chiqishi/botishini
// ochiq API'dan oladi (sunrise-sunset.org) va quyosh balandligiga qarab osmon rangini hisoblaydi.
import { useOffice } from './store.js';

// ---------- Quyosh holati (SunCalc algoritmi asosida) ----------
const rad = Math.PI / 180;
const dayMs = 86400000;
const J1970 = 2440588;
const J2000 = 2451545;
const e = rad * 23.4397;
const toDays = (d) => d.valueOf() / dayMs - 0.5 + J1970 - J2000;

export function sunPosition(date, lat, lng) {
  const lw = rad * -lng;
  const phi = rad * lat;
  const d = toDays(date);
  const M = rad * (357.5291 + 0.98560028 * d);
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + rad * 102.9372 + Math.PI;
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const ra = Math.atan2(Math.sin(L) * Math.cos(e), Math.cos(L));
  const H = rad * (280.16 + 360.9856235 * d) - lw - ra;
  return {
    altitude: Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)) / rad,
    azimuth: Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) / rad, // janubdan g'arbga
  };
}

// API ishlamasa: quyosh chiqishi/botishini o'zimiz topamiz (daqiqama-daqiqa)
function localTimes(date, lat, lng) {
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  let rise = null, set = null, prev = sunPosition(start, lat, lng).altitude;
  for (let m = 2; m <= 1440; m += 2) {
    const t = new Date(start.getTime() + m * 60000);
    const a = sunPosition(t, lat, lng).altitude;
    if (prev < -0.833 && a >= -0.833 && !rise) rise = t;
    if (prev >= -0.833 && a < -0.833) set = t;
    prev = a;
  }
  return { sunrise: rise, sunset: set, source: 'hisob' };
}

// ---------- Ranglar ----------
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t));
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// [balandlik°, osmon tepasi, ufq]
const SKY = [
  [-18, '#04060d', '#0a0f1e'],
  [-10, '#0a1230', '#1a2550'],
  [-5, '#1c2858', '#7a4f78'],
  [-1, '#34508e', '#e8835a'],
  [3, '#4a76bd', '#f6a765'],
  [8, '#5c95da', '#ffd4a3'],
  [18, '#4e98e8', '#cfe7ff'],
  [45, '#3a87e6', '#e2f1ff'],
];

function skyAt(alt) {
  if (alt <= SKY[0][0]) return { top: SKY[0][1], horizon: SKY[0][2] };
  for (let i = 1; i < SKY.length; i++) {
    if (alt <= SKY[i][0]) {
      const [a0, t0, h0] = SKY[i - 1];
      const [a1, t1, h1] = SKY[i];
      const t = (alt - a0) / (a1 - a0);
      return { top: mix(t0, t1, t), horizon: mix(h0, h1, t) };
    }
  }
  const last = SKY[SKY.length - 1];
  return { top: last[1], horizon: last[2] };
}

export function computeSky(alt, az) {
  const { top, horizon } = skyAt(alt);
  const dayK = smooth(-4, 12, alt); // 0 tun, 1 to'liq kun
  const lamps = 1 - smooth(-6, 3, alt);
  const lightAlt = Math.max(alt, 6) * rad;
  const azr = az * rad;
  const sunDir = [-Math.sin(azr) * Math.cos(lightAlt), Math.sin(lightAlt), Math.cos(azr) * Math.cos(lightAlt)];
  const sunColor = alt < 10 ? mix('#ff7a3d', '#ffd9ae', smooth(0, 10, alt)) : mix('#ffd9ae', '#fff6ea', smooth(10, 30, alt));
  return {
    alt, az, top, horizon, lamps, night: alt < -2,
    sunDir, sunColor, sunI: 2.1 * dayK,
    moonI: 0.35 * lamps,
    ambient: 0.12 + 0.3 * dayK,
    ambientColor: mix('#7f95d8', '#ffffff', dayK),
    hemiTop: mix('#2c3a66', top, dayK),
    hemiBottom: mix('#0b0d12', '#c7b9a4', dayK),
    hemiI: 0.18 + 0.45 * dayK,
    ground: mix('#20242c', '#b8bec7', dayK),
  };
}

// ---------- Joylashuv ----------
const LS_KEY = 'agent-office-location';
const getJSON = async (url, ms = 6000) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(r.status);
  return r.json();
};

async function cityName(lat, lng) {
  try {
    const j = await getJSON(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=uz`);
    return j.city || j.locality || j.principalSubdivision || null;
  } catch { return null; }
}

function gps() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('no geolocation'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, source: 'GPS' }),
      reject,
      { timeout: 8000, maximumAge: 3600_000 },
    );
  });
}

async function byIp() {
  try {
    const j = await getJSON('https://ipapi.co/json/');
    if (j.latitude) return { lat: j.latitude, lng: j.longitude, city: j.city, source: 'IP' };
  } catch {}
  const j = await getJSON('https://ipwho.is/');
  if (j.success === false) throw new Error('ipwho');
  return { lat: j.latitude, lng: j.longitude, city: j.city, source: 'IP' };
}

async function locate() {
  try {
    const loc = await gps();
    loc.city = await cityName(loc.lat, loc.lng);
    return loc;
  } catch {}
  try { return await byIp(); } catch {}
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY));
    if (saved?.lat) return { ...saved, source: 'saqlangan' };
  } catch {}
  return { lat: 41.31, lng: 69.28, city: 'Toshkent', source: 'taxminiy' };
}

async function fetchTimes(lat, lng, date) {
  try {
    const d = date.toISOString().slice(0, 10);
    const j = await getJSON(`https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&date=${d}&formatted=0`);
    if (j.status === 'OK') return { sunrise: new Date(j.results.sunrise), sunset: new Date(j.results.sunset), source: 'sunrise-sunset.org' };
  } catch {}
  return localTimes(date, lat, lng);
}

// ---------- Sikl ----------
let started = false;
export function startSun() {
  if (started) return;
  started = true;
  const S = useOffice.getState;
  let loc = null;
  let times = null;
  let timesDay = '';

  const tick = async () => {
    const { themeMode, timeOffsetH } = S();
    const now = new Date(Date.now() + timeOffsetH * 3600_000);
    let alt, az;
    if (themeMode === 'day') { alt = 42; az = 25; }
    else if (themeMode === 'night') { alt = -25; az = 160; }
    else if (loc) ({ altitude: alt, azimuth: az } = sunPosition(now, loc.lat, loc.lng));
    else { alt = 30; az = 20; }

    if (loc && timesDay !== now.toDateString()) {
      timesDay = now.toDateString();
      times = await fetchTimes(loc.lat, loc.lng, now);
    }
    useOffice.setState({
      sky: computeSky(alt, az),
      sunInfo: loc ? { city: loc.city, source: loc.source, sunrise: times?.sunrise, sunset: times?.sunset, timesSource: times?.source, now } : null,
    });
  };

  tick();
  locate().then((l) => {
    loc = l;
    try { localStorage.setItem(LS_KEY, JSON.stringify({ lat: l.lat, lng: l.lng, city: l.city })); } catch {}
    tick();
  });
  setInterval(tick, 30_000);
  useOffice.subscribe((s, p) => { if (s.themeMode !== p.themeMode || s.timeOffsetH !== p.timeOffsetH) tick(); });
}
