// Demo chat: answers built from the agent's real simulated state (task, progress, queue, bugs).
// A real adapter would send the question to a model instead.
import type { OfficeSnapshot } from '../adapter';
import type { AgentId, Lang, Task } from '../types';
import { PROFILES, STATUS_LABEL } from '../agents';

export type ChatAction = { type: 'assign'; title: string } | { type: 'pause' } | { type: 'resume' };
export interface Reply { text: string; action?: ChatAction }

const UZ_HINTS = /\b(salom|assalom|nima|qanday|qachon|qancha|necha|hozir|muammo|xato|yordam|rahmat|qil|kim|bor|yo['‘’]q|men|sen|siz|ish|vazifa|keyin|tayyor|davom|to['‘’]xta)\w*/i;
export const detectLang = (text: string, fallback: Lang): Lang => (UZ_HINTS.test(text) || /[og]['‘’]/i.test(text) ? 'uz' : /[a-z]/i.test(text) ? 'en' : fallback);

const INTENTS: [string, RegExp][] = [
  ['assign', /^(task|vazifa|new task|yangi vazifa)\s*[:\-]\s*(.+)$/i],
  ['pause', /\b(pause|stop|to['‘’]xta)\w*/i],
  ['resume', /\b(resume|continue|davom)\w*/i],
  ['problem', /\b(problem|issue|bug|error|blocker|stuck|muammo|xato|xatolik|qiyin|to['‘’]siq)\w*/i],
  ['progress', /\b(progress|percent|how far|how much|done yet|qancha|necha|foiz|tayyor)\w*/i],
  ['eta', /\b(when|eta|how long|finish|qachon|vaqt|tugat)\w*/i],
  ['next', /\b(next|after that|keyin|navbat)\w*/i],
  ['team', /\b(team|who|colleague|jamoa|kim)\w*/i],
  ['done', /\b(finished|completed|results?|did you do|bajar|natija|qilding)\w*/i],
  ['doing', /\b(doing|working on|status|up to|nima qil|nima ish|hozir|holat|band)\w*/i],
  ['help', /\b(help|what can you|yordam|nima qila olasan)\w*/i],
  ['thanks', /\b(thanks|thank you|rahmat|raxmat|tashakkur)\w*/i],
  ['greet', /\b(hi|hello|hey|salom|assalom)\w*/i],
];

export function replyTo(id: AgentId, raw: string, lang: Lang, s: OfficeSnapshot, tasks: Task[]): Reply {
  const text = raw.trim();
  const uz = lang === 'uz';
  const me = s.agents[id];
  const name = PROFILES[id].name;
  const mine = tasks.filter((t) => t.assignee === id);
  const current = mine.find((t) => t.id === me.currentTaskId);
  const queued = mine.filter((t) => t.status === 'queued');
  const done = mine.filter((t) => t.status === 'completed');
  const openBug = tasks.find((t) => t.source === 'qa' && t.status !== 'completed');
  const pct = current ? Math.round(current.progress) : 0;
  const etaSec = current ? Math.max(5, Math.round(((100 - current.progress) / 100) * current.effort * 1.1)) : 0;
  const intent = INTENTS.find(([, re]) => re.test(text))?.[0] ?? 'default';

  if (intent === 'assign') {
    const title = text.match(INTENTS[0][1])![2].trim();
    return { text: uz ? `Qabul qildim: "${title}". Navbatimga qo‘shdim.` : `Got it: "${title}". It's in my queue.`, action: { type: 'assign', title } };
  }
  if (intent === 'pause') return { text: uz ? 'Mayli, to‘xtayman.' : 'Okay, pausing now.', action: { type: 'pause' } };
  if (intent === 'resume') return { text: uz ? 'Ishga qaytdim.' : 'Back to work.', action: { type: 'resume' } };

  if (me.status === 'paused' && intent !== 'thanks' && intent !== 'greet') {
    return { text: uz ? 'Hozir pauzadaman. "Davom et" desangiz, ishni davom ettiraman.' : "I'm paused right now. Say \"resume\" and I'll continue." };
  }

  switch (intent) {
    case 'greet':
      return { text: uz ? `Salom! Men ${name}, ${PROFILES[id].role}. ${current ? `Hozir "${current.title}" ustida ishlayapman.` : 'Hozir bo‘shman.'}` : `Hi! I'm ${name}, the ${PROFILES[id].role}. ${current ? `I'm working on "${current.title}".` : "I'm free right now."}` };
    case 'doing':
      if (me.place === 'meeting') return { text: uz ? 'Hozir meeting room’damiz, rejani muhokama qilyapmiz.' : "We're in the meeting room, going through the plan." };
      if (me.place === 'coffee') return { text: uz ? 'Kofe-breykdaman, bir daqiqada stolimga qaytaman.' : "I'm on a coffee break, back at my desk in a minute." };
      if (me.place === 'security') return { text: uz ? 'Kiberxavfsizlik bo‘limidaman, tahdidlar xaritasini ko‘ryapman. Tez orada stolimga qaytaman.' : "I'm in Cyber Security, looking at the threat map. Back at my desk soon." };
      if (current) return { text: uz ? `Men hozir "${current.title}" ustida ishlayapman. Taxminan ${pct}% tayyor.` : `I'm working on "${current.title}". About ${pct}% done.` };
      return { text: uz ? `Hozir vazifam yo‘q (${STATUS_LABEL[me.status]}). ${queued.length ? `Navbatda ${queued.length} ta vazifa bor, oldingi bosqich tugashini kutyapman.` : 'Yangi vazifa bersangiz, darrov boshlayman.'}` : `No active task (${STATUS_LABEL[me.status]}). ${queued.length ? `${queued.length} task(s) queued, waiting for the previous step.` : 'Give me a task and I start right away.'}` };
    case 'progress':
      if (current) return { text: uz ? `"${current.title}" — ${pct}% tayyor. Jami bajarganlarim: ${done.length} ta.` : `"${current.title}" is ${pct}% done. Finished so far: ${done.length}.` };
      return { text: uz ? `Hozir faol vazifa yo‘q. Bajarganlarim: ${done.length} ta.` : `No active task. Finished so far: ${done.length}.` };
    case 'problem':
      if (id === 'developer' && openBug) return { text: uz ? `Ha, QA xatolik topdi: ${openBug.title.replace(/^Tuzatish: /, '')}. ${openBug.status === 'running' ? 'Hozir tuzatyapman.' : 'Navbatdagi ish shu.'}` : `Yes, QA found a bug: ${openBug.title.replace(/^Fix: /, '')}. ${openBug.status === 'running' ? "I'm fixing it now." : "It's next in my queue."}` };
      if (id === 'qa' && openBug) return { text: uz ? `Bitta ochiq xatolik bor, Developer tuzatyapti. Keyin qayta test qilaman.` : `One open bug, the developer is fixing it. I'll re-test after.` };
      if (me.status === 'error') return { text: uz ? 'Ha, hozir xatolik ustidaman, tez orada tuzataman.' : "Yes, I'm on an error right now, fixing it shortly." };
      if (!current && queued.length) return { text: uz ? 'Katta muammo yo‘q, faqat oldingi bosqichni kutyapman.' : 'No real problem, just waiting for the previous step.' };
      return { text: uz ? 'Hozircha muammo yo‘q, hammasi rejadagidek.' : 'No problems so far, everything is on track.' };
    case 'eta':
      if (current) return { text: uz ? `${pct}% bo‘ldi, ${etaSec < 25 ? 'tez orada' : 'birozdan keyin'} tugataman.` : `I'm ${pct}% in, ${etaSec < 25 ? 'wrapping up shortly' : 'should be done in a bit'}.` };
      return { text: uz ? 'Hozir faol vazifa yo‘q.' : 'No active task right now.' };
    case 'next':
      if (queued.length) return { text: uz ? `Keyingisi: "${queued[0].title}".` : `Next up: "${queued[0].title}".` };
      return { text: uz ? 'Navbatimda boshqa vazifa yo‘q.' : 'Nothing else in my queue.' };
    case 'done':
      if (done.length) return { text: (uz ? 'Bajarganlarim: ' : 'Done so far: ') + done.slice(-3).map((t) => `"${t.title}"`).join(', ') + '.' };
      return { text: uz ? 'Hali yakunlangan vazifam yo‘q.' : "I haven't finished a task yet." };
    case 'team':
      return { text: (uz ? 'Jamoa: ' : 'Team: ') + Object.values(PROFILES).map((p) => `${p.name} (${p.role.replace(' Agent', '')})`).join(', ') + '.' };
    case 'help':
      return { text: uz ? 'Mendan holat, progress, muammolar yoki keyingi vazifa haqida so‘rang. Vazifa berish: "vazifa: ...". "To‘xta" / "davom et" ham ishlaydi.' : 'Ask me about status, progress, problems or my next task. Give a task with "task: ...". "Pause" and "resume" work too.' };
    case 'thanks':
      return { text: uz ? 'Arzimaydi! Yana savol bo‘lsa, shu yerdaman.' : "Anytime! I'm right here if you need me." };
    default:
      return { text: uz ? `Tushunarli. ${current ? `Hozir "${current.title}" ustida ishlayapman (${pct}%).` : 'Hozir bo‘shman.'} Aniqroq so‘rasangiz — holat, muammo yoki keyingi vazifa — batafsil aytaman.` : `Understood. ${current ? `I'm on "${current.title}" (${pct}%).` : "I'm free right now."} Ask me about status, problems or my next task for details.` };
  }
}
