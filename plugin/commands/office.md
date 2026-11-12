---
description: Open the 3D Agent Office (starts its local server if needed)
allowed-tools: Bash(node:*)
---
Start the Agent Office server if it is not running, then tell the user where to open it.

Run exactly this command:

```
node "${CLAUDE_PLUGIN_ROOT}/office/ctl.mjs" start
```

It prints the office URL and what it is watching (Docker containers, log files). Relay that output to the user in one or two short lines, and tell them to open the URL in their browser. Do not do anything else.
