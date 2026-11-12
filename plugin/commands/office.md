---
description: Open the 3D Agent Office in your browser (starts its local server if needed)
allowed-tools: Bash(node:*)
---
Start the Agent Office server if it is not running and open it in the user's browser.

Run exactly this command:

```
node "${CLAUDE_PLUGIN_ROOT}/office/ctl.mjs" start --open
```

The server picks a working address by itself: 127.0.0.1 first, then localhost / [::1], and
port 4777 or the next free one if 4777 is taken or reserved. The output names the address it
chose and alternatives.

- If it succeeded: tell the user in one or two short lines which address opened, mention the
  alternative address from the output in case the browser did not open, and that they should
  switch the panel to **Live**.
- If it printed "could not start" with a diagnosis: summarize the ✖ lines in plain words and the
  fix each one suggests. If it says the session runs in the cloud, explain that the office only
  works when Claude Code runs on their own computer.

Do not do anything else.
