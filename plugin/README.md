# Agent Office 3D (plugin)

A 3D office in your browser that shows this Claude Code session live. Sub-agents walk to their
desks when Claude delegates work and every tool call appears as a speech bubble. The office also
follows your Docker containers, terminal commands and log files: an error makes the matching
agent panic with a red status and alarm, and a stopped or unhealthy container sends its agent to
the lounge. Press B in the office to walk around as the boss and read any agent's terminal on its
monitor. Sky and lighting follow the real sun at your location.

Install:

```
/plugin install agent-office --marketplace YOUR_GITHUB_NAME/agent-office
```

- `/agent-office:setup` — read the project, create one sub-agent per area and build a room for each
- `/agent-office:office` — print the office URL (starts the local server if needed)
- `/agent-office:office-stop` — stop the server
- `/agent-office:office-watch <agent> <command…>` — run a command and stream its output to an agent

The server starts automatically on SessionStart (set `AGENT_OFFICE_AUTOSTART=0` to turn that
off) and listens on `127.0.0.1:4777` (`AGENT_OFFICE_PORT`). Optional project config lives in
`.agent-office.json`. See the repository README for details.
