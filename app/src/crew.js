// Each role gets a person: a first name and a look. Fixed for common roles, hashed for the rest,
// so the same project always shows the same people.
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

const SKIN = { fair: '#f6cfae', light: '#ecbd96', tan: '#d6a07a', olive: '#c8956b', brown: '#a56d4a', deep: '#7a4b33' };
const HAIR = { black: '#1d1a1a', dark: '#3a2a20', brown: '#6b4a32', auburn: '#8e4a2c', blond: '#d8b46a', gray: '#9a9aa0' };

const FIXED = {
  manager: { name: 'Michael', skin: SKIN.light, hair: HAIR.dark, style: 'side', beard: true, pants: '#2b2f3a', shoes: '#1c1c20' },
  backend: { name: 'Emma', skin: SKIN.fair, hair: HAIR.auburn, style: 'long', pants: '#34405a', shoes: '#f2f2f2' },
  frontend: { name: 'Jake', skin: SKIN.tan, hair: HAIR.black, style: 'curly', pants: '#3b3f46', shoes: '#f2f2f2' },
  qa: { name: 'Olivia', skin: SKIN.brown, hair: HAIR.black, style: 'bun', glasses: true, pants: '#2f3542', shoes: '#e9e4dc' },
  devops: { name: 'Ryan', skin: SKIN.light, hair: HAIR.blond, style: 'short', beard: true, pants: '#3c4436', shoes: '#2a2a2e' },
  mobile: { name: 'Ava', skin: SKIN.olive, hair: HAIR.brown, style: 'ponytail', pants: '#353c52', shoes: '#f2f2f2' },
  data: { name: 'Ethan', skin: SKIN.deep, hair: HAIR.black, style: 'buzz', glasses: true, pants: '#2c2f38', shoes: '#f2f2f2' },
  design: { name: 'Sophia', skin: SKIN.fair, hair: HAIR.blond, style: 'long', pants: '#3a3346', shoes: '#efe7f2' },
  security: { name: 'Noah', skin: SKIN.tan, hair: HAIR.dark, style: 'side', pants: '#24272e', shoes: '#1c1c20' },
  docs: { name: 'Grace', skin: SKIN.light, hair: HAIR.brown, style: 'bun', glasses: true, pants: '#40392f', shoes: '#e9e4dc' },
};
const POOL = [
  { name: 'Lucas', skin: SKIN.light, hair: HAIR.brown, style: 'short' },
  { name: 'Mia', skin: SKIN.tan, hair: HAIR.dark, style: 'ponytail' },
  { name: 'Daniel', skin: SKIN.brown, hair: HAIR.black, style: 'buzz', beard: true },
  { name: 'Chloe', skin: SKIN.fair, hair: HAIR.auburn, style: 'bun' },
  { name: 'Henry', skin: SKIN.olive, hair: HAIR.dark, style: 'side', glasses: true },
  { name: 'Lily', skin: SKIN.deep, hair: HAIR.black, style: 'curly' },
  { name: 'Owen', skin: SKIN.light, hair: HAIR.blond, style: 'short' },
  { name: 'Zoe', skin: SKIN.light, hair: HAIR.brown, style: 'long', glasses: true },
  { name: 'Caleb', skin: SKIN.tan, hair: HAIR.brown, style: 'curly', beard: true },
  { name: 'Nora', skin: SKIN.olive, hair: HAIR.black, style: 'long' },
];
const PANTS = ['#2f3542', '#34405a', '#3b3f46', '#3c4436', '#2b2f3a'];

export function crewFor(id) {
  const key = String(id).toLowerCase();
  const base = FIXED[key] ?? Object.entries(FIXED).find(([k]) => key.includes(k))?.[1];
  if (base && !FIXED[key] && key !== 'manager') {
    // "backend-api" style ids: same look family, but a different person
    const p = POOL[hash(key) % POOL.length];
    return { pants: PANTS[hash(key) % PANTS.length], shoes: '#f2f2f2', ...p };
  }
  if (base) return base;
  const h = hash(key);
  return { pants: PANTS[(h >> 4) % PANTS.length], shoes: '#f2f2f2', ...POOL[h % POOL.length] };
}

// "Emma" for people, the role stays on the room sign and in the tag.
export const personName = (id) => crewFor(id).name;
