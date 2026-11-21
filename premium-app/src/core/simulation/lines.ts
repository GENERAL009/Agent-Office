// Everything the simulated agents say to each other, in English and Uzbek.
import type { AgentId, Lang } from '../types';
import { PROFILES } from '../agents';

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const n = (id: AgentId) => PROFILES[id].name;

type Lines = {
  received: (p: string) => string;
  planReady: (count: number) => string;
  meetingCall: string;
  assign: Record<Exclude<AgentId, 'manager'>, (task: string) => string>;
  ack: Record<Exclude<AgentId, 'manager'>, string>;
  kickoffEnd: string;
  start: Record<AgentId, (task: string) => string>;
  activity: Record<AgentId, string[]>;
  handoff: {
    research: string;
    system: string;
    design: (f: string) => string;
    build: (f: string) => string;
    testOk: (f: string) => string;
    bug: (f: string, bug: string) => string;
    fixed: (f: string) => string;
  };
  devError: (bug: string) => string;
  checkIn: (who: AgentId, task: string) => string;
  checkReply: (pct: number, task: string) => string;
  checkDone: (task: string) => string;
  board: string;
  coffee: string[];
  security: string[];
  done: (p: string, tasks: number) => string;
  userAssigned: (who: AgentId, task: string) => string;
  userAck: (task: string) => string;
  paused: string;
  resumed: string;
  result: Record<string, (f?: string) => string>;
};

export const LINES: Record<Lang, Lines> = {
  en: {
    received: (p) => `New project received: "${p}". Planning it now.`,
    planReady: (c) => `Plan is ready: ${c} tasks. Everyone to the meeting room!`,
    meetingCall: 'Quick kickoff, two minutes.',
    assign: {
      research: (t) => `${n('research')}, you start: ${t}.`,
      designer: (t) => `${n('designer')}, after the research: ${t}.`,
      developer: (t) => `${n('developer')}, you build each feature as soon as its design is ready. First up: ${t}.`,
      qa: (t) => `${n('qa')}, test every feature when it's built. First: ${t}.`,
    },
    ack: {
      research: 'On it. Requirements in the chat soon.',
      designer: "I'll prepare the UI design for it.",
      developer: "Got it. I'll start coding as soon as the design lands.",
      qa: "Once the code is ready, I'll test it.",
    },
    kickoffEnd: "Let's go. I'll keep the whiteboard updated.",
    start: {
      manager: (t) => `Starting: ${t}.`,
      research: (t) => `Starting: ${t}.`,
      designer: (t) => `Started on ${t}.`,
      developer: (t) => `Started working on ${t}.`,
      qa: (t) => `Testing now: ${t}.`,
    },
    activity: {
      manager: ['Reviewing deliverables', 'Checking every acceptance criterion', 'Writing the delivery notes'],
      research: ['Reviewing competitor sites', 'Collecting user requirements', 'Summarizing findings', 'Writing the requirements doc'],
      designer: ['Sketching the wireframe', 'Choosing colors and type', 'Building components', 'Designing mobile states'],
      developer: ['Setting up components', 'Writing the API calls', 'Handling form validation', 'Writing unit tests', 'Refactoring the state'],
      qa: ['Writing test cases', 'Running happy-path tests', 'Testing edge cases', 'Checking mobile layout'],
    },
    handoff: {
      research: `Research is done: key requirements are in the doc. ${n('designer')}, you can start.`,
      system: 'Design system is ready: colors, type, spacing, components.',
      design: (f) => `${n('developer')}, the ${f} design is ready for you.`,
      build: (f) => `${n('qa')}, ${f} is ready for testing.`,
      testOk: (f) => `${f} passed all tests ✅`,
      bug: (f, b) => `${n('developer')}, found a bug in ${f}: ${b}.`,
      fixed: (f) => `Fixed. ${n('qa')}, please re-test ${f}.`,
    },
    devError: (b) => `Error reproduced: ${b}. Fixing it now.`,
    checkIn: (who, t) => `${n(who)}, how is "${t}" going?`,
    checkReply: (p, t) => `About ${p}% done on ${t}. ${p > 60 ? 'Almost there.' : 'Moving steadily.'}`,
    checkDone: (t) => `Just finished ${t} ✅`,
    board: 'Updated the whiteboard with the latest progress.',
    coffee: ['Coffee break, back in a minute.', 'Grabbing a coffee.', 'Two minutes at the coffee bar.'],
    security: ['Popping into Cyber Security for a minute.', 'Going to look at the threat map.', 'Checking the security wall, back soon.'],
    done: (p, c) => `Project "${p}" is completed: ${c} tasks done. Great work, team! ✅`,
    userAssigned: (who, t) => `New task from the user for ${n(who)}: "${t}".`,
    userAck: (t) => `Got it, "${t}" is in my queue.`,
    paused: 'Paused. Waiting for your signal.',
    resumed: 'Back to work.',
    result: {
      research: () => 'Requirements doc: competitor notes, user needs, scope',
      system: () => 'Design system: palette, type scale, 14 components',
      design: (f) => `UI mockups for ${f}: desktop + mobile`,
      build: (f) => `${f} implemented with tests`,
      test: (f) => `${f}: test report`,
      fix: (f) => `Bug fix merged for ${f}`,
      review: () => 'Delivery notes and final checklist',
      user: () => 'Done',
    },
  },
  uz: {
    received: (p) => `Yangi loyiha qabul qilindi: "${p}". Rejani tuzyapman.`,
    planReady: (c) => `Reja tayyor: ${c} ta vazifa. Hamma meeting room'ga!`,
    meetingCall: 'Qisqa kickoff, ikki daqiqa.',
    assign: {
      research: (t) => `${n('research')}, sen boshlaysan: ${t}.`,
      designer: (t) => `${n('designer')}, tadqiqotdan keyin: ${t}.`,
      developer: (t) => `${n('developer')}, har bir dizayn tayyor bo‘lishi bilan kodini yoz. Birinchisi: ${t}.`,
      qa: (t) => `${n('qa')}, har bir qism tayyor bo‘lganda test qil. Birinchisi: ${t}.`,
    },
    ack: {
      research: 'Boshladim. Talablar tez orada chatda bo‘ladi.',
      designer: 'Men uning UI dizaynini tayyorlayman.',
      developer: 'Tushunarli. Dizayn kelishi bilan kod yozishni boshlayman.',
      qa: 'Kod tayyor bo‘lgach, test qilaman.',
    },
    kickoffEnd: 'Ishga! Whiteboard’ni men yangilab turaman.',
    start: {
      manager: (t) => `Boshladim: ${t}.`,
      research: (t) => `Boshladim: ${t}.`,
      designer: (t) => `${t} ustida ishlashni boshladim.`,
      developer: (t) => `${t} ustida ishlashni boshladim.`,
      qa: (t) => `Test qilyapman: ${t}.`,
    },
    activity: {
      manager: ['Natijalarni ko‘rib chiqyapman', 'Har bir talabni tekshiryapman', 'Topshirish hujjatini yozyapman'],
      research: ['Raqobatchilar saytlarini ko‘ryapman', 'Foydalanuvchi talablarini yig‘yapman', 'Xulosalarni jamlayapman', 'Talablar hujjatini yozyapman'],
      designer: ['Wireframe chizyapman', 'Rang va shriftlarni tanlayapman', 'Komponentlar yasayapman', 'Mobil holatlarni chizyapman'],
      developer: ['Komponentlarni sozlayapman', 'API chaqiruvlarini yozyapman', 'Forma validatsiyasini qilyapman', 'Unit testlar yozyapman', 'State’ni refaktor qilyapman'],
      qa: ['Test case’lar yozyapman', 'Asosiy ssenariylarni tekshiryapman', 'Chegaraviy holatlarni sinayapman', 'Mobil ko‘rinishni tekshiryapman'],
    },
    handoff: {
      research: `Tadqiqot tayyor: asosiy talablar hujjatda. ${n('designer')}, boshlashing mumkin.`,
      system: 'Design system tayyor: ranglar, shriftlar, oraliqlar, komponentlar.',
      design: (f) => `${n('developer')}, ${f} dizayni tayyor.`,
      build: (f) => `${n('qa')}, ${f} test uchun tayyor.`,
      testOk: (f) => `${f} barcha testlardan o‘tdi ✅`,
      bug: (f, b) => `${n('developer')}, ${f}da xatolik topdim: ${b}.`,
      fixed: (f) => `Tuzatildi. ${n('qa')}, ${f}ni qayta tekshirib ko‘r.`,
    },
    devError: (b) => `Xatolik takrorlandi: ${b}. Hozir tuzatyapman.`,
    checkIn: (who, t) => `${n(who)}, "${t}" qanday ketyapti?`,
    checkReply: (p, t) => `${t}: taxminan ${p}% tayyor. ${p > 60 ? 'Oz qoldi.' : 'Bir maromda ketyapti.'}`,
    checkDone: (t) => `${t} hozirgina tugadi ✅`,
    board: 'Whiteboard’ga oxirgi progressni yozdim.',
    coffee: ['Kofe-breyk, bir daqiqada qaytaman.', 'Bir kofe olib kelaman.', 'Ikki daqiqa kofe bar’da.'],
    security: ['Bir daqiqaga kiberxavfsizlik bo‘limiga kirib chiqaman.', 'Tahdidlar xaritasini ko‘rib kelaman.', 'Xavfsizlik ekranlarini tekshirib, tez qaytaman.'],
    done: (p, c) => `"${p}" loyihasi tayyor: ${c} ta vazifa bajarildi. Zo‘r ish, jamoa! ✅`,
    userAssigned: (who, t) => `Foydalanuvchidan ${n(who)} uchun yangi vazifa: "${t}".`,
    userAck: (t) => `Qabul qildim, "${t}" navbatimda.`,
    paused: 'To‘xtatildim. Signalingizni kutyapman.',
    resumed: 'Ishga qaytdim.',
    result: {
      research: () => 'Talablar hujjati: raqobatchilar, foydalanuvchi ehtiyojlari, scope',
      system: () => 'Design system: palitra, shriftlar, 14 komponent',
      design: (f) => `${f} uchun UI maketlar: desktop + mobil`,
      build: (f) => `${f} kodi yozildi, testlar bilan`,
      test: (f) => `${f}: test hisoboti`,
      fix: (f) => `${f} uchun xatolik tuzatildi`,
      review: () => 'Topshirish hujjati va yakuniy checklist',
      user: () => 'Bajarildi',
    },
  },
};

export { pick };
