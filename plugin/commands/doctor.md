---
description: Find out why the 3D Agent Office does not open (server, port, address, Docker)
allowed-tools: Bash(node:*)
---
Run exactly this command:

```
node "${CLAUDE_PLUGIN_ROOT}/office/ctl.mjs" doctor
```

Explain the result to the user in a few plain sentences: which address works (if any), what is
wrong (✖ lines) and the fix for each. Typical fixes:

- server not running → `node "${CLAUDE_PLUGIN_ROOT}/office/ctl.mjs" start --open`
- port 4777 busy or reserved by Windows → nothing to do, the server already uses the next free port
  shown in the output; open that address
- session runs in the cloud → run `claude` on the user's own computer
- errors in the server log → quote the relevant line

If the server is not running and nothing blocks it, offer to start it with the command above.
