---
description: Build the premium 3D office from your own Synty POLYGON Office pack (one command, runs on your computer)
argument-hint: "<folder of your unzipped Synty POLYGON Office pack> [--mixamo <folder>]"
allowed-tools: Bash(node:*)
---
Build the premium Agent Office from the user's own copy of the Synty POLYGON Office asset pack. Arguments: $ARGUMENTS

If no folder was given, ask the user for the folder of their unzipped Synty POLYGON Office pack and stop.

Otherwise run exactly this command (it takes a few minutes; Blender converts the pack on this computer):

```
node "${CLAUDE_PLUGIN_ROOT}/premium/build.mjs" $ARGUMENTS
```

Then:
- If it ended with "Premium office built": run `node "${CLAUDE_PLUGIN_ROOT}/office/ctl.mjs" start --open` and tell the user in one or two lines that the premium office is open, and that the free office is still at the same address without /premium.
- If it printed ✖ lines: tell the user what failed and the fix from the → line (for example: install Blender from blender.org).
- If it printed that no Mixamo clips were found: mention, in one line, that people use simple poses until they add the free Mixamo clips it listed.

The pack's files never leave the user's computer: do not copy, upload or commit them.
