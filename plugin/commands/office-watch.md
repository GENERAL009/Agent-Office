---
description: Run a terminal command and stream its output to an agent in the 3D office
argument-hint: <agent> <command...>
allowed-tools: Bash(node:*)
---
The user wants this command's output shown in the Agent Office: $ARGUMENTS

The first word is the agent name (backend, frontend, devops or any name), the rest is the command.
Start it in the background with:

```
node "${CLAUDE_PLUGIN_ROOT}/office/run.mjs" --agent <agent> -- <command...>
```

Use the Bash tool's background option so it keeps running. Then tell the user in one line which agent now shows that terminal.
