# Agent Office 3D (plugin)

A 3D office in your browser that shows this Claude Code session live. Sub-agents walk to their
desks when Claude delegates work and every tool call appears as a speech bubble. The office also
follows your Docker containers, terminal commands and log files. Every problem is graded minor,
moderate, major or critical and shown in that colour; from the level you choose (default: major)
the agent panics with an alarm and siren, and a failing container sends its agent to the lounge.
Repeated lines are grouped with a counter. Press B in the office to walk around as the boss and read any agent's terminal on its
monitor. Sky and lighting follow the real sun at your location.

Install:

```
/plugin install agent-office --marketplace GENERAL009/Agent-Office
```

- `/agent-office:setup` — read the project, create one sub-agent per area and build a room for each
- `/agent-office:office` — open the office in your browser (starts the local server if needed)
- `/agent-office:doctor` — explain why the office does not open (server, port, address)
- `/agent-office:office-stop` — stop the server
- `/agent-office:office-watch <agent> <command…>` — run a command and stream its output to an agent

The server starts automatically on SessionStart (set `AGENT_OFFICE_AUTOSTART=0` to turn that
off) and listens on `127.0.0.1:4777`, moving to the next free port if 4777 is taken or reserved (`AGENT_OFFICE_PORT` sets the first one). Optional project config lives in
`.agent-office.json`. See the repository README for details.
