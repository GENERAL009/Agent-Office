---
description: Build the premium 3D Agent Office from the user's own Synty POLYGON Office pack (zip or folder; found in Downloads/Desktop/Documents when no path is given), then open it
argument-hint: "[pack zip or folder] [--mixamo <folder>]"
allowed-tools: Bash(node:*)
---
Build the premium Agent Office from the user's own copy of the Synty POLYGON Office asset pack. Arguments: $ARGUMENTS

If the user said where the pack or the Mixamo clips are, pass them: the pack zip or folder first, then `--mixamo <folder>`.
Otherwise run it with no arguments: it searches Downloads, Desktop and Documents itself.

Run exactly this (it takes about a minute; Blender converts the pack on this computer):

```
node "${CLAUDE_PLUGIN_ROOT}/premium/build.mjs" $ARGUMENTS
```

Then:
- If it ended with "Premium office built": run `node "${CLAUDE_PLUGIN_ROOT}/office/ctl.mjs" start --open` and tell the user in two short lines that the premium office is open, and that `/agent-office:setup` gives their project a team if it has none.
- If it printed ✖ lines: tell the user what failed and the fix from the → line (for example: install Blender from blender.org, or give the pack's path).
- If it printed that no Mixamo clips were found: mention in one line that people use simple poses until they add the free Mixamo clips it listed (PREMIUM.md in the plugin's GitHub repository shows the download settings).

The pack's files never leave the user's computer: do not copy, upload or commit them.
