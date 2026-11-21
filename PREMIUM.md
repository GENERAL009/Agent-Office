# Premium office: step by step

The free Agent Office works right after install. The **premium office** is a full 3D building: an open-plan workspace, a manager office, a meeting room, a kitchen, a lounge, a game room, a studio, a server room, reception and a Cyber Security room, with real furniture and animated people. It shows the same live Claude Code events, and you can walk in and talk to your agents.

The 3D models are a paid asset pack, so they can't be in this repository. You buy the pack once, and **Claude Code builds the office on your own computer** in about a minute. Nothing is uploaded anywhere.

---

## What you need

| | What | Cost | Where |
|---|---|---|---|
| 1 | Claude Code + Node 18 or newer | — | [Claude Code](https://github.com/anthropics/claude-code), [nodejs.org](https://nodejs.org) |
| 2 | **Synty POLYGON Office** (the "Source Files" download) | paid, once | [syntystore.com](https://syntystore.com) → search "POLYGON Office" |
| 3 | **Blender** 4.2 or newer | free | [blender.org/download](https://www.blender.org/download/) |
| 4 | 11 **Mixamo** animations (optional, recommended) | free, Adobe account | [mixamo.com](https://www.mixamo.com) |

### 2 · The Synty pack
1. Buy POLYGON Office on the Synty store.
2. In your Synty account, open **Downloads** and download **POLYGON_Office_SourceFiles** (a zip, about 45 MB).
3. Leave the zip in **Downloads**. You don't have to unzip it; the build finds it there. Inside you'll see `SourceFiles/` with `Characters/`, `FBX/` and `Textures/`.

### 3 · Blender
Download Blender for your system and install it like any app. On a Mac, drag it into **Applications**. You never have to open it: the build runs it in the background.

### 4 · Mixamo animations (optional)
Without these, people still work, sit and walk, but with simple built-in poses. With them they really type, walk, wave and drink coffee.

1. Sign in at mixamo.com with a free Adobe account.
2. Make a folder called **`mixamo`** in **Downloads**.
3. Search each name below. Click it and press **Download** with these settings, then save the file into that folder:
   - **Format:** FBX Binary (.fbx)
   - **Skin:** Without Skin
   - **Frames per Second:** 30
   - **Walking** and **Running**: tick **In Place**

   `Breathing Idle` · `Typing` · `Sitting Idle` · `Sitting Talking` · `Walking` · `Running` · `Talking` · `Waving` · `Drinking` · `Clapping` · `Jumping`

Keep Mixamo's file names (for example `Typing.fbx`).

---

## Build it

### Step 1 · Install the plugin (in your terminal)
```bash
claude plugin marketplace add GENERAL009/Agent-Office
claude plugin install agent-office@agent-office
```

### Step 2 · Let Claude build the office
Open Claude Code in any project folder (`claude`) and paste this prompt:

```text
Build my premium Agent Office. My Synty POLYGON Office zip is in Downloads and my Mixamo clips are in Downloads/mixamo. When it's built, open the office.
```

Claude runs the plugin's **premium** command. It:
1. finds your pack (the zip or the unzipped folder) in Downloads, Desktop or Documents,
2. finds Blender,
3. finds your Mixamo clips,
4. converts everything into the web format the office loads, saving it to `~/.agent-office/premium/models` on your computer,
5. opens the office in your browser.

You can also type the command yourself: `/agent-office:premium` (or `/agent-office:premium ~/Downloads/POLYGON_Office_SourceFiles_v4.zip`).

### Step 3 · Give it a team
In the same project, run:

```text
/agent-office:setup
```

Claude reads your project and writes a team of sub-agents (`.claude/agents/*.md`), for example backend, frontend and QA. Each one gets a seat, a name and a character in the office.

### Step 4 · Work as usual
Ask Claude for something real, for example *"Add due dates to the to-do app. Split the work between the backend, frontend and QA agents, in parallel."* Every sub-agent sits down at its desk, and its tool calls (Read, Edit, Write, Bash) show up live. Errors turn the agent's status red.

Later, `/agent-office:office` opens the premium office. The free one is still at the same address without `/premium`.

---

## Inside the office
- **Overview:** drag to orbit, scroll to zoom; room buttons at the top.
- **Walk in:** `W A S D` to walk, `Shift` to run. Walk up to an agent and press **E** to ask what they're working on.
- The left panel shows who is working on what, the task timeline and every tool call. The right panel shows the messages between Claude and its sub-agents.

## If something goes wrong
| Message | Fix |
|---|---|
| Could not find the Synty POLYGON Office pack | Give its path: `/agent-office:premium ~/path/to/the.zip` |
| Blender was not found | Install Blender into Applications, or pass `--blender /path/to/Blender` |
| No Mixamo clips found | Put the 11 FBX files in `~/Downloads/mixamo` and run the command again |
| The office still looks like the free one | Open `http://127.0.0.1:4777/premium/` (or the address `/agent-office:office` prints, with `/premium/`) |

## What's in this repository
- `plugin/premium/build.mjs`: the one command that finds your files and runs the conversion.
- `plugin/premium/synty_to_gltf.py`, `plugin/premium/mixamo_to_synty.py`: the Blender scripts it runs (pack → glTF, Mixamo → the pack's skeleton).
- `plugin/ui-premium/`: the premium office itself (source in `premium-app/`).
- Your pack's files are never in this repository and never leave your computer.

## Does it cost tokens?
The office itself makes no model calls: Claude Code's hooks send small events to a local server on your computer (127.0.0.1), and the browser draws them. Only the Claude Code work you ask for (like `/agent-office:setup` or your task) uses Claude.
