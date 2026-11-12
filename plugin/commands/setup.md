---
description: Read this project, split it into a team of sub-agents and build their rooms in the 3D office
argument-hint: "[optional notes, e.g. 'add a QA agent']"
allowed-tools: Bash(node:*), Read, Glob, Grep, Write, Edit
---
Set up the Agent Office team for this project. The user's extra notes: $ARGUMENTS

1. Scan the project:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/office/scan.mjs" "$CLAUDE_PROJECT_DIR"
   ```

   It prints JSON with suggested `roles` (id, kind, evidence, paths, commands), `composeServices`,
   `containersHint`, `logFiles`, `existingAgents` and whether `.agent-office.json` exists.

2. Check the evidence yourself before deciding. Open the main manifests and one or two entry files
   per role (for example `pubspec.yaml` and `lib/main.dart`, `package.json`, `go.mod`, the Dockerfile)
   so each agent's instructions name the real folders, frameworks and commands. Keep it quick: only
   what you need to write accurate agents.

3. Decide the team: 2 to 6 roles. Use short lowercase ids (`backend`, `frontend`, `flutter`,
   `devops`, `qa`, `ml`, `docs` …). Merge roles that would have almost nothing to do. Follow the
   user's notes if they gave any.

4. For each role, write `.claude/agents/<id>.md` in the project:

   ```markdown
   ---
   name: <id>
   description: <one line: when Claude should delegate to this agent, naming the area and stack>
   ---
   You are the <role> engineer for <project>. You own <paths>.
   Stack: <frameworks and versions you saw>.
   - Work only inside <paths>; ask the main agent before touching other areas.
   - After changes run: <the project's real test/lint/build commands>.
   - <2–4 project-specific rules you noticed: state management, API style, folder conventions …>
   ```

   If a file with that name already exists, do not overwrite it — show the user a diff of what you
   would change and ask first.

5. Write (or merge into) `.agent-office.json` at the project root:

   ```json
   {
     "team": [{ "id": "flutter", "name": "Flutter" }, { "id": "backend" }],
     "containers": { "<compose service or container name>": "<role id>" },
     "logs": [{ "path": "<log file>", "agent": "<role id>" }]
   }
   ```

   Use `containersHint` and `logFiles` from the scan as a starting point and fix anything that is
   wrong. Keep any keys the file already has.

6. The running office picks the changes up within a few seconds: every new role gets its own room
   and its agent walks in through the entrance. If the office is not running, start it with
   `node "${CLAUDE_PLUGIN_ROOT}/office/ctl.mjs" start`.

7. Finish with a short table: role · what it owns · test command · containers/logs it watches,
   then one line telling the user to delegate with phrases like "give this to the flutter agent".
