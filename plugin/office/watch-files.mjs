// Log fayllarini kuzatish (tail -F kabi). .agent-office.json ichida:
//   "logs": [{ "path": "logs/api.log", "agent": "backend" }]
import fs from 'node:fs';
import path from 'node:path';
import { trim } from './common.mjs';
import { RateLimit } from './rate.mjs';

export function startFiles(config, projectDir, emit, status, resolve, sev) {
  const limit = new RateLimit();
  for (const entry of config.logs || []) {
    const file = path.resolve(projectDir, entry.path);
    const name = entry.name || path.basename(file);
    const agent = entry.agent || resolve(name);
    const id = `file:${file}`;
    let pos = 0;
    let rest = '';
    let present = null;
    status.logs += 1;

    const read = () => {
      let st;
      try { st = fs.statSync(file); } catch {
        if (present !== false) {
          present = false;
          emit({ hook: 'Service', id, name, kind: 'file', agent, state: 'stopped', severity: 'info', detail: 'Fayl topilmadi' });
        }
        return;
      }
      if (present !== true) {
        // Server ishga tushganda mavjud fayl: eski qatorlarni o'tkazib yuboramiz.
        // Keyinroq paydo bo'lgan fayl: boshidan o'qiymiz.
        if (present === null) pos = st.size;
        present = true;
        emit({ hook: 'Service', id, name, kind: 'file', agent, state: 'up', severity: 'info', detail: entry.path });
      }
      if (st.size < pos) pos = 0; // fayl qisqartirildi (rotate)
      if (st.size === pos) return;
      const fd = fs.openSync(file, 'r');
      const buf = Buffer.alloc(Math.min(st.size - pos, 512_000));
      fs.readSync(fd, buf, 0, buf.length, pos);
      fs.closeSync(fd);
      pos += buf.length;
      const lines = (rest + buf.toString()).split('\n');
      rest = lines.pop();
      for (const line of lines) {
        const text = line.trim();
        if (!text) continue;
        const c = sev.line(name, text);
        if (!c) continue;
        if (!limit.allow(id, c.level)) continue;
        emit({ hook: 'Log', source: name, kind: 'file', agent, level: c.level, severity: c.severity, key: c.key, count: c.count, escalated: c.escalated || undefined, text: trim(text, 280) });
      }
    };
    read();
    setInterval(read, 700);
  }
}
