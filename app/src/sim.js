// Simulyatsiya rejimi: orqasida Claude yo'q. Jamoadagi har bir rol o'z xonasida ishlaydi,
// vaqti-vaqti bilan xato va konteyner yiqilishi bo'ladi.
import { useOffice } from './store.js';

const S = () => useOffice.getState();
const L = () => S().layout;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const WORK = {
  backend: {
    tasks: ['Login API', 'Users migratsiyasi', 'JWT tekshiruvi', 'Buyurtmalar endpointi', 'Kesh qatlami'],
    acts: ['Read src/server/routes.ts', 'Edit src/server/auth.ts', 'Bash npm test -- auth', 'Grep "userId"', 'Write migrations/004_users.sql'],
    errors: ['TypeError: Cannot read properties of undefined (reading \'id\')', 'ECONNREFUSED 127.0.0.1:5432', 'Test failed: auth.spec.ts (3 failing)'],
  },
  frontend: {
    tasks: ['Login sahifasi', 'Dashboard jadvali', 'Dark mode', 'Forma validatsiyasi', 'Mobil menyu'],
    acts: ['Read src/pages/Login.tsx', 'Edit src/components/Table.tsx', 'Bash npm run lint', 'Write src/hooks/useAuth.ts'],
    errors: ['Module not found: Can\'t resolve \'./Button\'', 'Hydration failed: server/client mismatch', 'ESLint: 4 errors'],
  },
  devops: {
    tasks: ['Docker image', 'CI pipeline', 'Nginx sozlamasi', 'Monitoring', 'Backup skripti'],
    acts: ['Edit Dockerfile', 'Write .github/workflows/ci.yml', 'Bash docker build .', 'Edit deploy/nginx.conf'],
    errors: ['docker build failed: exit code 2', 'nginx: [emerg] unknown directive', 'CI job "test" failed'],
  },
  mobile: {
    tasks: ['Login ekrani', 'Push bildirishnomalar', 'Offline kesh', 'Riverpod state', 'Android build'],
    acts: ['Edit lib/screens/login_screen.dart', 'Bash flutter test', 'Read pubspec.yaml', 'Bash flutter analyze', 'Write lib/providers/auth_provider.dart'],
    errors: ['RenderFlex overflowed by 42 pixels', 'Gradle task assembleDebug failed', 'Null check operator used on a null value'],
  },
  qa: {
    tasks: ['E2E testlar', 'Regressiya', 'Login sinovi', 'Yuklama testi'],
    acts: ['Bash npx playwright test', 'Write tests/e2e/login.spec.ts', 'Read reports/junit.xml'],
    errors: ['3 tests failed in login.spec.ts', 'Timeout 30000ms exceeded'],
  },
  data: {
    tasks: ['Model trening', 'Ma\'lumot tozalash', 'Feature engineering', 'Eval'],
    acts: ['Bash python train.py', 'Edit notebooks/eda.ipynb', 'Read data/schema.json'],
    errors: ['CUDA out of memory', 'KeyError: \'label\''],
  },
  generic: {
    tasks: ['Vazifa', 'Refaktoring', 'Kod ko‘rib chiqish', 'Hujjat yozish'],
    acts: ['Read README.md', 'Edit src/index.ts', 'Bash npm test', 'Grep "TODO"'],
    errors: ['Command failed with exit code 1'],
  },
};
const workFor = (kind) => WORK[kind] ?? (kind === 'design' || kind === 'docs' ? WORK.frontend : kind === 'security' ? WORK.devops : WORK.generic);

let token = 0;

export function startSim() {
  const my = ++token;
  const alive = () => my === token && S().mode === 'sim';
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const busy = (id) => S().agents[id]?.down || S().isPanicking(id);
  const settle = async (id) => { while (alive() && (S().agents[id]?.state === 'walking' || busy(id))) await wait(150); };
  const walk = async (id, cell, after) => { S().goTo(id, cell, after); await settle(id); };
  const toDesk = async (id) => { S().goToDesk(id); await settle(id); };
  const workers = new Set();

  async function worker(id, delay) {
    workers.add(id);
    await wait(delay);
    while (alive()) {
      const a = S().agents[id];
      if (!a) return;
      const w = workFor(a.kind);
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
      if (!alive() || busy(id)) continue;
      const r = Math.random();
      if (r < 0.35) {
        S().patch(id, { task: 'Qahva tanaffusi' });
        await walk(id, L().lounge.coffeeSpot, { state: 'idle' });
        if (!busy(id)) S().say(id, '☕', 2500);
        await wait(rand(3000, 5000));
        if (!busy(id)) S().goToLounge(id);
        await settle(id);
        await wait(rand(2000, 4000));
      } else if (r < 0.6) {
        S().patch(id, { task: 'Majlis' });
        await walk(id, pick(L().meeting.seats), { state: 'talking' });
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
      const candidates = S().team.map((r) => r.id).filter((x) => S().agents[x] && !S().agents[x].down);
      if (!candidates.length) continue;
      const target = pick(candidates);
      const t = S().agents[target];
      const d = L().desks[t.deskId];
      if (!d) continue;
      S().patch(id, { task: `${t.name} bilan gaplashish` });
      await walk(id, [d.seat[0] + 1, d.seat[1] + 1], { state: 'talking' });
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

  const services = () => S().team.map((r) => ({ id: `docker:app-${r.id}-1`, name: `app-${r.id}-1`, kind: 'docker', agent: r.id }));

  async function incidents() {
    for (const sv of services()) S().setService({ hook: 'Service', ...sv, state: 'up', detail: 'Up 3 minutes' });
    await wait(rand(14000, 20000));
    while (alive()) {
      const ids = S().team.map((r) => r.id).filter((x) => S().agents[x]);
      if (Math.random() < 0.55) {
        const id = pick(ids);
        if (!S().agents[id]?.down) S().panic(id, pick(workFor(S().agents[id].kind).errors), 'sim');
      } else {
        const sv = pick(services());
        const bad = Math.random() < 0.7 ? 'down' : 'unhealthy';
        S().setService({ hook: 'Service', ...sv, state: bad, detail: bad === 'down' ? 'Exited (1) 1 second ago' : 'Up (unhealthy)' });
        S().log(sv.agent, 'FATAL: process crashed', 'error', sv.name);
        await wait(rand(12000, 18000));
        if (!alive()) return;
        S().setService({ hook: 'Service', ...sv, state: 'up', detail: 'Up 1 second' });
      }
      await wait(rand(22000, 38000));
    }
  }

  // Jamoaga yangi rol qo'shilsa, uning ishchisi ham ishga tushadi
  const unsub = useOffice.subscribe((s, p) => {
    if (!alive()) { unsub(); return; }
    if (s.team !== p.team) for (const r of s.team) if (!workers.has(r.id)) worker(r.id, 1500);
  });

  manager();
  S().team.forEach((r, i) => worker(r.id, 300 + i * 600));
  incidents();
}

export function stopSim() { token++; }
