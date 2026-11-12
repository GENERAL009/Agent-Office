# Agent Office 3D — loyihaning to'liq prompti

Bu prompt butun loyihani noldan qayta qurish (yoki boshqa AI'ga tushuntirish) uchun yozilgan.
Uni Claude Code'ga to'g'ridan-to'g'ri berish mumkin. Bosqichma-bosqich bajarish tavsiya etiladi:
har bosqichdan keyin brauzerda ochib tekshiring.

---

## 0. Vazifa

**Claude Code uchun plugin** yarat: u Claude Code sessiyasini, sub-agentlarni, Docker
konteynerlarini, terminal buyruqlari va log fayllarni **brauzerdagi 3D ofisda** jonli ko'rsatadi.

- Har bir sub-agent (backend, frontend, flutter, devops, qa, ml …) — ofisda odamcha, o'z xonasi va stoli bor.
- Claude ish topshirsa — agent stoliga yuradi; har bir tool chaqiruvi (`Edit`, `Bash`, `Read` …) pufakchada ko'rinadi.
- Xato chiqsa — darajasiga qarab agent sariq/olovrang/qizil bo'ladi, chegaradan yuqorisida **panika** qiladi (sakraydi, qizil chiroq, sirena).
- Konteyner yiqilsa — agent **dam olish xonasidagi divanga** borib o'tiradi, tiklanganda ishiga qaytadi.
- **Boshliq rejimi**: foydalanuvchi o'zi ofis bo'ylab yuradi (WASD, 3-shaxs kamera), stol yonida `E` bosib agent terminalini o'qiydi.
- Osmon, quyosh nuri va chiroqlar foydalanuvchi joylashuvidagi **haqiqiy quyoshga** qarab o'zgaradi.
- Plugin GitHub'dan bitta buyruq bilan o'rnatiladi.

## 1. Cheklovlar (majburiy)

- Plugin serveri va skriptlari **faqat Node.js standart kutubxonasi** (npm paket yo'q). Node 18+.
- Hook skripti **≤1 soniya** ishlaydi va **doim exit 0** — ofis yopiq bo'lsa ham Claude sekinlashmaydi.
- 3D UI oldindan build qilinadi va pluginga `plugin/ui` sifatida qo'shiladi (foydalanuvchi `npm install` qilmaydi).
- Windows, macOS, Linux. Windows'da bola jarayonlar **`windowsHide: true`** (aks holda har 3 soniyada konsol oynasi chiqadi).
- Server faqat loopback'da tinglaydi (127.0.0.1 / ::1).
- Kod izohlari **o'zbekcha**, UI matnlari o'zbekcha; README inglizcha + qisqa o'zbekcha bo'lim; docs sahifasi ikki tilli.
- Pullik 3D modellar ishlatilmaydi — hamma narsa Three.js primitivlaridan; yog'och pol teksturasi canvas'da chiziladi.

## 2. Repo tuzilmasi

```
agent-office/
├── .claude-plugin/marketplace.json     # repo = marketplace; plugin manbasi "./plugin"
├── plugin/                             # Claude Code plugin
│   ├── .claude-plugin/plugin.json      # name: agent-office, version, icon
│   ├── .claude-plugin/icon.png         # 1024×1024
│   ├── hooks/hooks.json                # 10 hodisa → office/hook.mjs
│   ├── agents/backend.md frontend.md devops.md
│   ├── commands/office.md setup.md doctor.md office-watch.md office-stop.md
│   ├── office/                         # server va yordamchi skriptlar (faqat Node std)
│   │   ├── server.mjs  net.mjs  ctl.mjs  hook.mjs  run.mjs  scan.mjs  team.mjs
│   │   ├── watch-docker.mjs  watch-files.mjs  rate.mjs  common.mjs
│   │   └── severity.mjs  severity.test.mjs
│   ├── ui/                             # app/ build natijasi (commit qilinadi)
│   └── README.md
├── app/                                # Vite + React 18 + React Three Fiber + drei + Zustand
│   └── src/ main.jsx App.jsx store.js layout.js pathfinding.js Agent.jsx Person.jsx
│            Office.jsx Details.jsx Windows.jsx Boss.jsx sim.js live.js replay.js
│            sun.js sound.js severity.js styles.css
├── docs/index.html (+ skrinshotlar)    # GitHub Pages, EN/UZ
├── .github/workflows/ci.yml            # testlar, build, plugin/ui commit qilinganmi, server smoke test
├── .agent-office.example.json
├── README.md  LICENSE (MIT)
```

`app/vite.config.js`: `base: './'`, `build.outDir: '../plugin/ui'`, `emptyOutDir: true`.

## 3. Ma'lumot oqimi

```
Claude Code hook'lari ─┐
docker ps / logs ──────┼──> plugin/office/server.mjs (127.0.0.1:4777) ──SSE /events──> 3D ofis (brauzer)
run.mjs, log fayllar ──┘
```

## 4. Plugin manifestlari

- `marketplace.json`: `{ name: "agent-office", owner: {name}, plugins: [{ name: "agent-office", source: "./plugin", description }] }`.
- `plugin.json`: `name`, `displayName: "Agent Office 3D"`, `version`, `description`, `author`, `repository`, `license: MIT`, `keywords`, `icon: "./.claude-plugin/icon.png"`.
- `hooks/hooks.json` (wrapper `"hooks"` kaliti bilan): `SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PostToolUseFailure, SubagentStart, SubagentStop, Stop, StopFailure, SessionEnd` — hammasi
  `{"type":"command","command":"node \"${CLAUDE_PLUGIN_ROOT}/office/hook.mjs\"","timeout":3}`.
- `claude plugin validate ./plugin` va `claude plugin validate .` xatosiz o'tishi kerak (README'da o'rnatish qatori bo'lsin).
- O'rnatish: `/plugin install agent-office --marketplace <owner>/<repo>`.

## 5. Server (`plugin/office/server.mjs`)

Endpointlar:
- `POST /event` — bitta hodisa yoki massiv (`hook` maydoni majburiy), hammasi SSE'ga uzatiladi.
- `GET /events` — SSE. Ulanishda birinchi `Snapshot`: `{ services, logs (oxirgi 40), project, team, severity (sozlamalar) }`. Har 15 s `: ping`.
- `GET /team` — `{ team, project, severity }`.
- `GET /health` — `{ name: "agent-office", ok, pid, project, clients, docker, logs, config, services, port, urls, tried }`.
- `GET /*` — `plugin/ui` statik fayllar (SPA fallback `index.html`), path traversal himoyasi.
- CORS `*`.

**Port va manzilni o'zi tanlaydi:** 127.0.0.1 → ::1; `EADDRINUSE` yoki `EACCES` (Windows Hyper-V/WSL zaxira portlari) bo'lsa 4777 → 4778 … 4790 → tizim bergan bo'sh port. `EADDRINUSE` bo'lsa avval o'sha portda Agent Office ishlayotganini `/health` bilan tekshiradi — ishlayotgan bo'lsa jim chiqib ketadi. IPv4 bilan birga ::1 da ham tinglaydi. Tanlangan manzil `<tmp>/agent-office/server.json` ga yoziladi (`pid, port, host, urls, project`). `AGENT_OFFICE_PORT` birinchi sinaladigan port.

**Jamoa** (`team.mjs`): tartib bo'yicha — `.agent-office.json` → `team`; bo'lmasa loyihaning `.claude/agents/*.md` (frontmatter `name`); bo'lmasa `backend, frontend, devops`. Har 2 s fayllar imzosini tekshiradi; o'zgarsa `Team` va `Settings` hodisalarini yuboradi.

`net.mjs`: `findServer({thorough})` — avval state fayl, keyin 127.0.0.1/localhost/[::1] × portlar; `post(events)` shu orqali yuboradi. Hook, ctl, run.mjs hammasi shundan foydalanadi.

## 6. Boshqaruv (`ctl.mjs`)

`node ctl.mjs start [loyiha] [--open] | stop | status | open | doctor`
- `start`: server yo'q bo'lsa detached + `windowsHide` bilan ishga tushiradi, 4 s gacha kutadi; asosiy va zaxira manzilni chiqaradi; port almashgan bo'lsa sababini aytadi; `--open` brauzerni ochadi (win: `cmd /c start`, mac: `open`, linux: `xdg-open`).
- Loyiha papkasi mavjud bo'lmasa — aniq xabar ("Project folder not found"), yiqilmaydi; `child.on('error')` ushlanadi.
- `doctor`: Node versiyasi, OS, sessiya bulutdami (`CLAUDE_CODE_REMOTE=true` → "brauzeringiz bu serverga yeta olmaydi"), state fayl, qaysi manzil javob beradi, 4777 holati (free / in-use / reserved), server logining oxirgi 15 qatori, Docker bormi. Natija ✔/✖ bilan.

## 7. Hook (`hook.mjs`)

stdin JSON → kichraytirilgan hodisa: `hook, tool, input (file_path, command, pattern, url, query, description, subagent_type, path, prompt — qisqartirilgan), tool_use_id, prompt, session_id, agent_id, agent_type, error, is_interrupt, stderr (Bash tool_response.stderr oxirgi 3 qator), cwd`.
- `SessionStart` da serverni o'zi yoqadi (`AGENT_OFFICE_AUTOSTART=0` o'chiradi).
- Darajalar: stderr → `stderr_severity`; `PostToolUseFailure` → Bash `Exit code N≠0` bo'lsa `major`, boshqa tool `moderate`, xato matni jiddiyroq bo'lsa o'sha; `StopFailure` → `major`.
- 500 ms timeout, har qanday xatoda jim, `process.exit(0)`.

## 8. Kuzatuvchilar

- **Docker** (`watch-docker.mjs`): har 3 s `docker ps -a --format '{{json .}}'`. Holat: `up | unhealthy | restarting | down | stopped | removed` (exit 0/130/143 → stopped). Boshida faqat ishlayotganlar yoki sozlamada ko'rsatilganlar (`allContainers`, `ignoreContainers`). Ishlayotganlarga `docker logs -f --since 1s`. Docker yo'q bo'lsa holat `not installed / not reachable`, 15 s da qayta sinaydi.
- **Log fayllar** (`watch-files.mjs`): `tail -F` kabi, 700 ms; server boshida mavjud fayl — oxiridan, keyin paydo bo'lgan — boshidan; rotate'ni sezadi.
- **Terminal** (`run.mjs --agent <id> [--name] -- <buyruq>`): chiqishni terminalga ham yozadi, ANSI ranglarni tozalaydi, qatorlarni 250 ms da paket qilib yuboradi; exit ≠ 0 → xizmat `down` (major).
- **Rate limit** (`rate.mjs`): manba boshiga soniyasiga info/warn 4 ta, error 3 ta.
- **Agentga bog'lash** (`resolveAgent`): `.agent-office.json → containers` (compose servis nomi `shop-api-1` ichida `api` ham mos) → konteyner nomida rol id → tur (`api/db/worker` → backend, `web/next/vite` → frontend, `flutter/mobile/dart` → mobile, `nginx/redis/grafana` → devops …).

## 9. Xatolik darajalari (`severity.mjs`, UI ham shu faylni import qiladi)

| daraja | UI | rang | qachon |
|---|---|---|---|
| info | Oddiy | #64748B | oddiy log, 2xx/3xx/404 |
| minor | Mayda | #EAB308 | warning, deprecated, retrying, timeout, 4xx (404 dan tashqari) |
| moderate | O'rtacha | #F97316 | bitta ERROR qatori, ushlangan exception, yiqilgan tool, bitta 5xx |
| major | Katta | #DC2626 | Traceback, unhandled exception, `\w+Error:` / `\w+Exception:`, stack trace, `unhealthy`, buyruq exit ≠ 0 |
| critical | Kritik | #7F1D1D | FATAL, PANIC, CRITICAL, OOMKilled, segfault, konteyner xato bilan to'xtadi yoki 3 daqiqada 3+ restart, DB auth (`password authentication failed`, `role … does not exist`), bazaga `ECONNREFUSED` |

- Xato emas: `0 errors`, `no errors found`, `errors: 0`, `error_handler` va h.k.
- `severityOf(line, compiledRules)`; `legacyLevel` (minor→warn, moderate+→error) — eski `level` maydoni saqlanadi.
- **Takrorlanish** (`Repeats`): matn normallashtiriladi (vaqt, uuid, hex, raqamlar olib tashlanadi); bir xil qolip 2 daqiqada 5 marta → bir pog'ona yuqori; har chiqishda `key`, `count` — UI bitta qatorni yangilaydi (`×16`), spam yo'q.
- `RestartTracker` (3 daqiqa / 3 marta); `serviceSeverity(state, {restarts, exitCode})`.
- `.agent-office.json`: `"severity": { "panicAt", "sound", "colorMode", "feedMin", "rules": { "<daraja>": [regex], "ignore": [regex] } }`. `ignore` ga mos qator umuman ko'rsatilmaydi.
- **Testlar** (`node --test plugin/office/severity.test.mjs`): haqiqiy log namunalari (Celery CRITICAL, postgres FATAL, asyncpg InvalidPasswordError, IndexError, Traceback, ForkPoolWorker ERROR, Retrying, 500/404, "0 errors"), takrorlanish, docker holatlari, restart, qoidalar, sozlamalar.

## 10. 3D ofis (app/)

**Reja generatori** (`layout.js`, `buildLayout(team)`): to'r 1 katak = 1 m, balandligi 22. Har xona 10×7 katak + devor; ustun eni 11.
- Ustki qator: Manager, rol1, rol2, rol4 …; pastki: Dam olish, Majlis, rol3, rol5 …; o'rtada koridor; chap devorda **kirish eshigi**.
- Yangi rol qo'shilsa bino **o'ngga kengayadi**, eski xonalar siljimaydi; bo'sh slot — "Yashil zona".
- Har ish xonasida 3 stol (asosiy + 2 zaxira). Xona jihozi rol turiga qarab: mobile/flutter — telefonlar stoli + katta telefon maketi; devops/security — server rack (sirena bilan) + UPS + monitoring devori; data/ml — GPU rack + grafik doska; frontend/design — molbert, kreslo, stiker doska; qa — xatolar doskasi, printer; docs — kitob javoni; backend — printer, kiyim ilgich.
- Manager: kitob javoni, kreslolar, aylanuvchi globus, torsher. Dam olish: divan (o'tirish joylari), stolcha, bean bag, TV, qahva burchagi, muzlatgich, arkada. Majlis: uzun stol, 6 stul, devor ekrani. Koridor: suv kuleri, avtomat, skameykalar, gilam yo'lak, haqiqiy vaqtni ko'rsatuvchi soat, "AGENT OFFICE · <LOYIHA>" yozuvi.
- Devorlar: tashqi — oq + yog'och qoplama; ichki — qora ramkali shisha. Tashqi devorlarda derazalar, ichida osmon gradienti.
- Rol nomidan tur: `kindOf(id)`; ism: `prettyName` (devops → DevOps, qa → QA, ml → ML).

**Yo'l topish** (`pathfinding.js`): A*, 8 yo'nalish, burchakdan kesib o'tmaydi; band maqsadga (divan, stul) kirish mumkin; yetib bo'lmasa eng yaqin nuqtagacha.

**Odamcha** (`Person.jsx`): kapsula tana, bosh, soch, ko'z, tabassum, naushnik (Manager'da galstuk), qo'l/oyoq; har rol uchun rang, teri/soch rangi id'dan. Animatsiyalar: yurish/yugurish, o'tirib yozish, gaplashish, o'ylash, qo'l silkitish, panika (sakrash + titrash), ishlamay qolgan (divanda boshi egilgan).

**Agent** (`Agent.jsx`): yo'l bo'ylab vaqtga mos yurish (past FPS'da ham), yorliq (ism · holat · xatolar soni), pufakcha; daraja rangidagi halqa va nur — daraja qancha yuqori bo'lsa shuncha tez miltillaydi.

**Stol monitori**: chap monitorda agentning oxirgi loglari canvas-terminal sifatida (daraja ranglari, `×N`).

## 11. Holat (`store.js`, Zustand)

- `team, layout, agents, feed, services, issues, settings, mode ('sim'|'live'), conn, sky, sunInfo, boss …`. Pozitsiyalar store'dan tashqarida (`positions`) — har kadr re-render bo'lmasin.
- `setTeam(list, {replace})`: birinchi yuklashda aynan loyiha jamoasi; keyin faqat qo'shiladi, yangi xodim eshikdan kirib "Salom!" deydi.
- `ensureAgent(id)`: noma'lum sub-agent → jamoaga qo'shiladi (xona quriladi). Plugin agentlari `agent-office:backend` → `backend`.
- `goTo / goToDesk / goToLounge / arrived / setState / say / log(id, text, severity, source, {key, count})` — `key` bo'yicha guruhlash.
- `alert(id, severity, text, source, {key, count})`: muammo (`issues`) yangilanadi; `severity ≥ panicAt` bo'lsa `startPanic` (critical uzunroq); aks holda "holat bo'yicha" rejimida rangli pufakcha; `severity ≥ sound` bo'lsa ovoz (darajaga qarab har xil signal). Takror qatorlar har safar sakratmaydi.
- `recomputeSev` (agent darajasi = faol muammolar va xizmatlar maksimumi), `decayTick` (2 daqiqa jim → har 20 s bir pog'ona pasayadi).
- `setService(ev)`: xizmat holati va darajasi; `recomputeDown`: `≥ panicAt` darajadagi nosoz xizmat → agent divanga; tiklansa stoliga qaytadi.
- Sozlamalar: `localStorage` (`agent-office-severity`) > `.agent-office.json` standarti > umumiy standart (`panicAt: major, sound: critical, colorMode: status, feedMin: info`).

## 12. Live rejim (`live.js`)

Server manzilini o'zi topadi (ofis serverdan ochilgan bo'lsa `location.origin`, aks holda 127.0.0.1/localhost × 4777–4790). EventSource `/events`. Hodisalar:
- `Snapshot/Team/Settings` — jamoa, xizmatlar, sozlamalar.
- `SessionStart` — Manager stoliga; `UserPromptSubmit` — Manager o'ylaydi, so'rov pufakchada.
- `PreToolUse Task/Agent` — sub-agent topshiriq oladi, stoliga yuradi; boshqa tool — egasi (`agent_type`, bo'lmasa oxirgi ishga tushgan sub-agent) ishlaydi, pufakchada `Edit auth.ts`.
- `PostToolUse Task/Agent` — "Tayyor!", dam olishga; stderr → daraja bo'yicha alert.
- `PostToolUseFailure`, `StopFailure` — alert; `Stop` — "Javob tayyor ✓"; `Service`, `Log` — xizmat/log.
- Panelda "Sinov hodisalari" tugmasi — Claude'siz butun zanjirni tekshiradi.

## 13. Simulyatsiya (`sim.js`)

Claude'siz: har rol o'z ishiga mos vazifa va amallar (Flutter: `flutter test`, `.dart` fayllar …), qahva tanaffusi, majlis; Manager xonalarni aylanib chiqadi. Nosozliklar navbat bilan to'rt darajaning hammasi (Retrying → ERROR → IndexError → takrorlanuvchi postgres FATAL), keyin `unhealthy` konteyner (major), keyin yiqilgan konteyner (critical → divan) va tiklanish. Panelda "+ xodim" maydoni — yangi rol qo'shib xona qurilishini ko'rish.

## 14. Boshliq rejimi (`Boss.jsx`)

`B` — kirish eshigi yonida boshliq (qora kostyum, galstuk, ko'zoynak, oltin halqa, ismi panelda o'zgartiriladi). WASD/strelkalar (kameraga nisbatan), Shift — yugurish, sichqoncha — kamera, to'qnashuv devor/mebel bilan. Kamera orqadan ergashadi. Yaqin monitor: stol (agent terminali), monitoring devori (barcha xizmatlar), majlis ekrani (umumiy lenta) — `E` to'liq ekran terminal ochadi, `Esc` yopadi/chiqadi. Yaqinlashganda agentlar o'giriladi, qo'l silkitadi, salomlashadi; muammosi bor agent nima buzilganini aytadi.

## 15. Haqiqiy quyosh (`sun.js`)

Joylashuv: brauzer GPS → IP (ipapi.co, ipwho.is) → saqlangan → Toshkent. Quyosh chiqishi/botishi: sunrise-sunset.org, ishlamasa lokal hisob. Quyosh balandligi/azimuti har 30 s (SunCalc formulasi) → osmon gradienti (tun → shafaq → oltin soat → kun), quyosh nuri yo'nalishi va rangi, oy nuri, xona lampalari, stol chiroqlari, derazalar. Panelda Avto/Kun/Tun va ±12 soat vaqt slayderi.

## 16. Panel (UI)

Qorong'i "glass" panel: sarlavha, ishlayotganlar soni, **darajalar hisoblagichi** (● 2 kritik ● 1 katta ● 4 mayda), ovoz tugmasi, Simulyatsiya/Live, ulanish holati, Boshliq rejimi tugmasi va ismi, **Xatolar** bo'limi (panika chegarasi, rang rejimi "Holat bo'yicha"/"Faqat qizil", ovoz, lenta filtri, rang izohi, "Standartga qaytarish"), Quyosh bo'limi, agentlar ro'yxati (holat belgisi daraja rangida, xatolar soni — bosib tozalanadi), Xizmatlar (daraja rangi, restart soni), Hodisalar lentasi (daraja belgisi, manba, `×N`). Sahna ustida ogohlantirish bannerlari (darajasi bo'yicha, kritik — tebranadi). Mobil ekranda panel pastga tushadi.

## 17. Qayta o'ynatish (`replay.js`)

`?replay=fayl.json` yoki `window.__AO_REPLAY` — `{ title, recordedAt, events: [{ t, ev }] }` faylini oraliqlarni cho'zib qayta o'ynatadi va takrorlaydi; panelda progress. SSE oqimini yozib olib, sessiyani ulashish uchun.

## 18. Buyruqlar (`plugin/commands`)

- `/agent-office:office` — `ctl.mjs start --open`; natijani 1–2 qatorda, zaxira manzil bilan; xato bo'lsa diagnozni oddiy tilda.
- `/agent-office:setup` — `scan.mjs` loyihani skanerlaydi (pubspec.yaml, package.json, go.mod, Cargo.toml, pyproject/requirements, Dockerfile, docker-compose servislari, CI, test papkalari, notebooklar, log fayllar) → Claude manifestlarni o'qib 2–6 rol tanlaydi, har biriga `.claude/agents/<id>.md` (haqiqiy papkalar, stek, test buyruqlari, 2–4 loyiha qoidasi; mavjud faylni so'ramasdan qayta yozmaydi) va `.agent-office.json` (team, containers, logs) yozadi; ofis 2 s ichida xonalarni quradi.
- `/agent-office:doctor` — `ctl.mjs doctor` natijasini tushuntiradi.
- `/agent-office:office-watch <agent> <buyruq>` — `run.mjs` ni fonda ishga tushiradi.
- `/agent-office:office-stop`.

## 19. Hujjatlar

- README (EN): ikonka, badge'lar, skrinshotlar, imkoniyatlar, o'rnatish, tezkor boshlash, Claude'siz sinash, buyruqlar, boshliq rejimi tugmalari, kuzatuvlar, **xatolik darajalari jadvali va sozlamalar**, `.agent-office.json`, muhit o'zgaruvchilari, joylashuv/osmon, muammolarni hal qilish (port band, Windows oynasi, `Cannot find module`, bulut sessiyasi), arxitektura, develop, o'zbekcha qisqacha.
- `docs/index.html`: GitHub Pages, EN/UZ almashtirgich (localStorage), "osmon + bino ro'yxati" hero, uchta kuzatuv manbai, nosozliklar (qorong'i qizil bo'lim), boshliq rejimi, loyiha xonalarni belgilaydi (ketma-ket qadamlar), xatolik darajalari, osmon, ma'lumotnoma, savol-javob. Mobilga mos, gorizontal skroll yo'q.

## 20. Qabul mezonlari

1. `node plugin/office/ctl.mjs start --open` — brauzerda ofis ochiladi; Simulyatsiya hamma imkoniyatni ko'rsatadi.
2. 4777 band bo'lsa server 4778'ni oladi, hook va brauzer uni o'zi topadi.
3. Lokal Claude Code sessiyasida sub-agentlar o'z xonasiga yuradi, tool chaqiruvlari pufakchada.
4. `/agent-office:setup` Flutter + backend loyihasida flutter/backend/devops xonalarini quradi.
5. Docker konteyner `unhealthy` → katta, xato bilan to'xtasa → kritik, agent divanga; `up` → qaytadi.
6. `node --test plugin/office/severity.test.mjs` — hammasi o'tadi.
7. `claude plugin validate ./plugin` va `.` — o'tadi; CI yashil.
8. Windows'da hech qanday konsol oynasi ochilmaydi.
9. `B` → boshliq rejimi, stol yonida `E` → agent terminali.

## Muhim eslatma

Ofis faqat **Claude Code foydalanuvchining o'z kompyuterida** ishlaganda jonli bo'ladi. claude.ai chat yoki bulut sessiyasida server bulutda yonadi va foydalanuvchi brauzeri `127.0.0.1`/`localhost` orqali unga yeta olmaydi. Qoida: **Claude, ofis serveri, Docker va brauzer bitta kompyuterda bo'lsin.**
