# Agent Office 3D

A Claude Code plugin that turns your session into a living 3D office in the browser.
Sub-agents walk to their desks when Claude hands them work, every tool call shows up as a
speech bubble, and the office also watches your **Docker containers**, **terminal commands**
and **log files**:

- an error line or a failed tool call makes the agent **panic** — red status, flashing alarm light, siren on the server rack, an optional beep;
- a container that stops, crash-loops or turns `unhealthy` sends its agent to the **lounge** until it is back up;
- the sky, sunlight and office lamps follow the **real sun** at your location.

![Day](docs/day.png)
![Incident](docs/incident.png)

## Install

```bash
# inside Claude Code (2.1.275+)
/plugin install agent-office --marketplace YOUR_GITHUB_NAME/agent-office

# or in two steps
/plugin marketplace add YOUR_GITHUB_NAME/agent-office
/plugin install agent-office@agent-office
```

or from your shell:

```bash
claude plugin marketplace add YOUR_GITHUB_NAME/agent-office
claude plugin install agent-office@agent-office
```

Requires Node.js 18+. No npm install is needed for the plugin: the server uses only Node's
standard library and the 3D UI ships prebuilt in `plugin/ui`.

## Use

The office server starts by itself when a Claude Code session starts. Then:

| Command | What it does |
|---|---|
| `/agent-office:office` | prints the office URL (default `http://127.0.0.1:4777`), starts the server if needed |
| `/agent-office:office-stop` | stops the server |
| `/agent-office:office-watch backend npm run dev` | runs a command and streams its output to the backend agent |

Open the URL and switch the panel to **Live**. **Simulation** mode needs nothing and shows
every feature, including staged errors and container crashes.

The plugin ships three sub-agents — `backend`, `frontend`, `devops` — and each one has its
own desk. Any other sub-agent type Claude launches gets a spare desk.

### Terminal commands

Run anything through the wrapper; output still appears in your terminal as usual:

```bash
node ~/.claude/plugins/…/agent-office/office/run.mjs --agent backend -- npm run dev
```

(`/agent-office:office-watch` does this for you.) Lines that look like errors make the agent
panic; a non-zero exit sends it to the lounge.

### Docker

If `docker` is on your PATH, every container that is running while the office is open is
tracked automatically. Containers are mapped to agents by name (`api`, `db`, `worker` →
backend; `web`, `next`, `vite` → frontend; `nginx`, `redis`, `grafana` … → devops). Their
logs are followed with `docker logs -f`.

### Configuration (optional)

Put `.agent-office.json` in your project root:

```json
{
  "containers": { "shop-api-1": "backend", "shop-web-1": "frontend" },
  "ignoreContainers": ["buildx_buildkit_default"],
  "logs": [{ "path": "logs/api.log", "agent": "backend" }],
  "allContainers": false,
  "docker": true
}
```

| Environment variable | Default | Meaning |
|---|---|---|
| `AGENT_OFFICE_PORT` | `4777` | server port |
| `AGENT_OFFICE_AUTOSTART` | `1` | set to `0` to stop the SessionStart hook from starting the server |
| `AGENT_OFFICE_DEBUG` | — | print every event the server receives |

## Real sun

The office asks the browser for your location (GPS). If that is denied it falls back to IP
geolocation ([ipapi.co](https://ipapi.co), [ipwho.is](https://ipwho.is)). Sunrise and sunset
times come from [sunrise-sunset.org](https://sunrise-sunset.org/api); the sun's height for
the sky colour and the light direction is computed locally every 30 seconds. Use **Day** /
**Night** to force a look, or drag the time slider to preview the evening.

## How it works

```
Claude Code hooks ─┐
docker ps / logs ──┼─> plugin/office/server.mjs (127.0.0.1:4777) ──SSE──> 3D office (plugin/ui)
run.mjs / log files┘
```

Hook events used: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`,
`PostToolUseFailure`, `SubagentStart`, `SubagentStop`, `Stop`, `StopFailure`, `SessionEnd`.
The hook script never waits more than about a second and always exits 0, so Claude is never
slowed down when the office is closed.

## Develop

```
app/      React + Three.js (React Three Fiber) source of the office
plugin/   the Claude Code plugin (hooks, agents, commands, server, built UI)
```

```bash
cd app && npm install
npm run dev        # UI with hot reload at :5173, talks to the server at :4777
npm run build      # writes the production UI to plugin/ui — commit it
claude plugin validate ./plugin
```

Try the plugin locally without a marketplace: `claude --plugin-dir ./plugin`.

---

## O‘zbekcha qisqacha

Claude Code uchun plugin: agentlaringiz, Docker konteynerlari va terminal loglari brauzerdagi
3D ofisda ko‘rinadi. Xato chiqsa agent vahimaga tushadi (qizil holat, chiroq, signal),
konteyner to‘xtasa agent dam olish xonasiga ketadi. Osmon va yorug‘lik joylashuvingizdagi
haqiqiy quyoshga qarab o‘zgaradi.

O‘rnatish: `/plugin marketplace add YOUR_GITHUB_NAME/agent-office`, keyin
`/plugin install agent-office@agent-office`. Ofisni ochish: `/agent-office:office`.

## License

MIT
