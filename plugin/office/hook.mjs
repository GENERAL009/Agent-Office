#!/usr/bin/env node
// Claude Code har bir hodisada shu skriptni chaqiradi (stdin'da JSON).
// Hodisani ofis serveriga yuboradi. Hech qachon xato bilan chiqmaydi va
// ~1 soniyadan ortiq kutmaydi, shuning uchun Claude sekinlashmaydi.
import { post, trim, levelOf } from './common.mjs';
import { ensureServer } from './ctl.mjs';

const slimInput = (input) => {
  if (!input || typeof input !== 'object') return undefined;
  const out = {};
  for (const k of ['file_path', 'command', 'pattern', 'url', 'query', 'description', 'subagent_type', 'path']) {
    if (input[k] !== undefined) out[k] = trim(input[k], 200);
  }
  if (input.prompt) out.prompt = trim(input.prompt, 160);
  return out;
};

// Bash natijasida xato bormi (PostToolUse — buyruq ishladi, lekin stderr'da xato bo'lishi mumkin)
const bashTrouble = (resp) => {
  if (!resp || typeof resp !== 'object') return undefined;
  const err = typeof resp.stderr === 'string' ? resp.stderr.trim() : '';
  return err ? trim(err.split('\n').slice(-3).join(' | '), 200) : undefined;
};

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', async () => {
  try {
    const e = JSON.parse(raw);
    const hook = e.hook_event_name;

    if (hook === 'SessionStart' && process.env.AGENT_OFFICE_AUTOSTART !== '0') {
      const dir = process.env.CLAUDE_PROJECT_DIR || e.cwd || process.cwd();
      await ensureServer(dir, 1200);
    }

    const ev = {
      hook,
      tool: e.tool_name,
      input: slimInput(e.tool_input),
      tool_use_id: e.tool_use_id,
      prompt: trim(e.prompt, 200),
      session_id: e.session_id,
      agent_id: e.agent_id,
      agent_type: e.agent_type,
      error: trim(e.error, 300),
      is_interrupt: e.is_interrupt,
      stderr: e.tool_name === 'Bash' ? bashTrouble(e.tool_response) : undefined,
      cwd: e.cwd,
    };
    if (ev.stderr) ev.stderr_level = levelOf(ev.stderr);
    await post(ev);
  } catch {} // ofis yopiq yoki kirish buzuq: Claude ishlayveradi
  process.exit(0);
});
