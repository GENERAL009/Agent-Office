// Simulyatsiya rejimi: orqasida Claude yo'q. Vaqti-vaqti bilan xato va konteyner
// yiqilishi ham bo'ladi, shunda vahima va dam olish xonasi qanday ishlashi ko'rinadi.
import { useOffice } from './store.js';
import { coffeeSpot, meetingSeats, loungeSpots, desks } from './layout.js';

const S = () => useOffice.getState();
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const WORK = {
  backend: {
    tasks: ['Login API', 'Users migratsiyasi', 'JWT tekshiruvi', 'Buyurtmalar endpointi', 'Kesh qatlami'],
    acts: ['Read src/server/routes.ts', 'Edit src/server/auth.ts', 'Bash npm test -- auth', 'Grep "userId"', 'Write migrations/004_users.sql', 'Edit src/db/pool.ts'],
    errors: ['TypeError: Cannot read properties of undefined (reading \'id\')', 'ECONNREFUSED 127.0.0.1:5432', 'Test failed: auth.spec.ts (3 failing)'],
  },
  frontend: {
    tasks: ['Login sahifasi', 'Dashboard jadvali', 'Dark mode', 'Forma validatsiyasi', 'Mobil menyu'],
    acts: ['Read src/pages/Login.tsx', 'Edit src/components/Table.tsx', 'Bash npm run lint', 'Write src/hooks/useAuth.ts', 'Edit src/styles/theme.css'],
    errors: ['Module not found: Can\'t resolve \'./Button\'', 'Hydration failed: server/client mismatch', 'ESLint: 4 errors'],
  },
  devops: {
    tasks: ['Docker image', 'CI pipeline', 'Nginx sozlamasi', 'Monitoring', 'Backup skripti'],
    acts: ['Edit Dockerfile', 'Write .github/workflows/ci.yml', 'Bash docker build .', 'Edit deploy/nginx.conf', 'Bash kubectl get pods'],
    errors: ['docker build failed: exit code 2', 'nginx: [emerg] unknown directive', 'CI job "test" failed'],
  },
};

const SERVICES = [
  { id: 'docker:shop-api-1', name: 'shop-api-1', kind: 'docker', agent: 'backend' },
  { id: 'docker:shop-db-1', name: 'shop-db-1', kind: 'docker', agent: 'backend' },
  { id: 'docker:shop-web-1', name: 'shop-web-1', kind: 'docker', agent: 'frontend' },
  { id: 'docker:nginx', name: 'nginx', kind: 'docker', agent: 'devops' },
  { id: 'term:dev', name: '$ npm run dev', kind: 'terminal', agent: 'frontend' },
];

let token = 0;

export function startSim() {
  const my = ++token;
  const alive = () => my === token && S().mode === 'sim';
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const busy = (id) => S().agents[id]?.down || S().isPanicking(id);
  const settle = async (id) => {
    while (alive() && (S().agents[id]?.state === 'walking' || busy(id))) await wait(150);
  };
  const walk = async (id, cell, after) => { S().goTo(id, cell, after); await settle(id); };
  const toDesk = async (id) => { S().goToDesk(id); await settle(id); };

  async function worker(id, delay) {
    await wait(delay);
    const w = WORK[id];
    while (alive()) {
      await settle(id);
      if (!alive()) return;
      const task = pick(w.tasks);
      S().patch(id, { task });
      await toDesk(id);
      if (!alive()) return;
      S().say(id, `${task} ustida ishlayapman`);
      S().log(id, `Vazifa: ${task}`);
      const steps = Math.floor(rand(3, 7));
      for (let i = 0; i < steps && alive(); i++) {
        await wait(rand(1500, 3200));
        if (!alive()) return;
        if (busy(id)) { await settle(id); continue; }
        const act = pick(w.acts);
        S().log(id, act);
        if (Math.random() < 0.35) S().say(id, act.split(' ')[0] + '…', 1800);
      }
      if (!alive()) return;
      if (busy(id)) continue;
      S().log(id, `✓ ${task} tayyor`);
      S().say(id, 'Tayyor!', 2000, 'ok');
      await wait(1200);
      if (!alive()) return;
      if (busy(id)) continue;

      const r = Math.random();
      if (r < 0.35) {
        S().patch(id, { task: 'Qahva tanaffusi' });
        await walk(id, coffeeSpot, { state: 'idle' });
        if (!busy(id)) S().say(id, '☕', 2500);
        await wait(rand(3000, 5000));
        if (!busy(id)) await walk(id, pick(loungeSpots), { state: 'idle' });
        await wait(rand(2000, 4000));
      } else if (r < 0.6) {
        S().patch(id, { task: 'Majlis' });
        await walk(id, pick(meetingSeats), { state: 'talking' });
        if (!busy(id)) S().say(id, pick(['Reliz qachon?', 'API sxemasi kelishildimi?', 'Testlar o‘tdi']), 3000);
        await wait(rand(4000, 6500));
      }
    }
  }

  async function manager() {
    const id = 'manager';
    await toDesk(id);
    while (alive()) {
      S().setState(id, 'thinking');
      S().patch(id, { task: 'Rejalashtirish' });
      S().log(id, 'Vazifalarni taqsimlamoqda');
      await wait(rand(5000, 9000));
      if (!alive()) return;
      const candidates = ['backend', 'frontend', 'devops'].filter((x) => !S().agents[x]?.down);
      const target = pick(candidates.length ? candidates : ['devops']);
      const t = S().agents[target];
      const seat = desks[t.deskId].seat;
      S().patch(id, { task: `${t.name} bilan gaplashish` });
      await walk(id, [seat[0] + 1, seat[1] + 1], { state: 'talking' });
      if (!alive()) return;
      S().say(id, `${t.name}, holat qanday?`, 2500);
      await wait(2200);
      if (!alive()) return;
      if (!busy(target)) S().say(target, t.task ? `${t.task} — deyarli tayyor` : 'Hozir boshlayman', 2500);
      S().log(id, `${t.name} bilan sinxronlash`);
      await wait(2600);
      await toDesk(id);
      S().setState(id, 'working');
      S().patch(id, { task: 'Kod ko‘rib chiqish' });
      await wait(rand(4000, 7000));
    }
  }

  // Namunaviy xizmatlar va nosozliklar
  async function incidents() {
    for (const sv of SERVICES) S().setService({ hook: 'Service', ...sv, state: 'up', detail: 'Up 3 minutes' });
    await wait(rand(14000, 20000));
    while (alive()) {
      if (Math.random() < 0.55) {
        const id = pick(['backend', 'frontend', 'devops']);
        if (!S().agents[id]?.down) S().panic(id, pick(WORK[id].errors), 'sim');
      } else {
        const sv = pick(SERVICES.filter((x) => x.kind === 'docker'));
        const bad = Math.random() < 0.7 ? 'down' : 'unhealthy';
        S().setService({ hook: 'Service', ...sv, state: bad, detail: bad === 'down' ? 'Exited (1) 1 second ago' : 'Up (unhealthy)' });
        const logs = { 'shop-api-1': 'FATAL: database connection lost', 'shop-db-1': 'PANIC: could not write to file "pg_wal"', 'shop-web-1': 'Error: listen EADDRINUSE :::3000', nginx: '[emerg] host not found in upstream "api"' };
        S().log(sv.agent, logs[sv.name], 'error', sv.name);
        await wait(rand(12000, 18000));
        if (!alive()) return;
        S().setService({ hook: 'Service', ...sv, state: 'up', detail: 'Up 1 second' });
      }
      await wait(rand(22000, 38000));
    }
  }

  manager();
  worker('backend', 300);
  worker('frontend', 900);
  worker('devops', 1500);
  incidents();
}

export function stopSim() { token++; }
