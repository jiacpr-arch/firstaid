// FIRST AID HERO — คลังโจทย์เกมตัดสินใจ (story-driven, Ace Attorney style)
//
// โครงนี้คือ "ข้อมูลโจทย์" ล้วนๆ — engine อยู่ที่ src/game/storyEngine.js
// ตัวละครอ้างด้วย charId จาก src/game/characters.js (who) + สีหน้า (pose)
// text อนุญาต HTML แค่ <span class="cbs-em"> สำหรับเน้นคำ
//
// แต่ละเคสมี field:
//   id, title, subtitle, level ('basic'|'intermediate'|'megacode'),
//   track (หมวดในหน้าเลือกเคส — key ของ TRACK_META, ไม่ระบุ = 'other'),
//   bg (ฉากพื้นหลัง — key ของ BACKGROUNDS ท้ายไฟล์นี้, ไม่ระบุ = ฉาก gradient เดิม),
//   hiddenCause (เคสที่ต้องจับสัญญาณอาการเอง — ใช้ปลดเหรียญ 🔍), story[]
//
// หมายเหตุ: เกมนี้เป็น "โหมดโบนัส" แยกจากสถานการณ์จำลองหลัก (/simulation)
// ไม่มีผลต่อ progress, post-test หรือใบเซอร์

import { faCprAed } from './game/faCprAed';
import { faDrowning } from './game/faDrowning';
import { faChoking } from './game/faChoking';
import { faInfantChoking } from './game/faInfantChoking';
import { faAnaphylaxis } from './game/faAnaphylaxis';
import { faChestPain } from './game/faChestPain';
import { faBleeding } from './game/faBleeding';
import { faBurn } from './game/faBurn';
import { faFracture } from './game/faFracture';
import { faSpine } from './game/faSpine';
import { faSeizure } from './game/faSeizure';
import { faFainting } from './game/faFainting';
import { faStroke } from './game/faStroke';
import { faHypoglycemia } from './game/faHypoglycemia';
import { faSnakeBite } from './game/faSnakeBite';
import { faHeatStroke } from './game/faHeatStroke';
import { faChemical } from './game/faChemical';

// เคสทั้งหมด — จัดเรียงตามหมวด (track) และในหมวดเรียงง่าย→ยาก
// ลำดับในนี้คือ "บันได" ของแต่ละหมวดบนหน้าเลือกเคส + ลำดับเคสแนะนำถัดไป
export const scenarios = [
  // ── 🫀 หมดสติ · CPR + AED ──
  faCprAed,
  faDrowning,
  // ── 🌬 สำลัก ──
  faChoking,
  faInfantChoking,
  // ── 💊 แพ้รุนแรง · เจ็บหน้าอก ──
  faAnaphylaxis,
  faChestPain,
  // ── 🩹 เลือดออก · บาดเจ็บ ──
  faBleeding,
  faBurn,
  faFracture,
  faSpine,
  // ── 🧠 เป็นลม · ชัก · สมอง ──
  faFainting,
  faSeizure,
  faStroke,
  faHypoglycemia,
  // ── 🌿 กลางแจ้ง · สารเคมี ──
  faSnakeBite,
  faHeatStroke,
  faChemical,
];

export function getScenarioById(id) {
  return scenarios.find((s) => s.id === id) || scenarios[0];
}

// ระดับความยากของเคส — key 'megacode' คงตาม engine เดิม (achievements เช็ค key ตรงๆ)
// เปลี่ยนได้แค่ป้าย
export const LEVEL_META = {
  basic: { label: 'พื้นฐาน', order: 0 },
  intermediate: { label: 'ท้าทาย', order: 1 },
  megacode: { label: 'ฮีโร่', order: 2 },
};

// หมวดของเคส (track) — จัดตามกลุ่มเหตุฉุกเฉินที่คนทั่วไปเจอบ่อย
// หน้าเลือกเคสจัดกลุ่มตามนี้ แทนการกองรวมตาม level ที่ยาวเป็นเส้นเดียว
export const TRACK_META = {
  cpr: {
    label: 'หมดสติ · CPR + AED', icon: '🫀', order: 0,
    desc: 'เรียกคนช่วย · โทร 1669 · ปั๊มหัวใจ · ใช้ AED — 4 นาทีแรกคือเส้นแบ่งชีวิต',
  },
  choking: {
    label: 'สำลัก', icon: '🌬', order: 1,
    desc: 'ผู้ใหญ่รัดกระตุกหน้าท้อง · ทารกตบหลัง 5 กระแทกอก 5 — ให้ทันก่อนหมดสติ',
  },
  medical: {
    label: 'แพ้รุนแรง · เจ็บหน้าอก', icon: '💊', order: 2,
    desc: 'EpiPen ให้ทัน · แน่นอกร้าวแขน อย่ารอ "เดี๋ยวก็หาย" — โทร 1669',
  },
  trauma: {
    label: 'เลือดออก · บาดเจ็บ', icon: '🩹', order: 3,
    desc: 'ห้ามเลือด · แผลไหม้ · ดามกระดูก · อุบัติเหตุที่ห้ามขยับคนเจ็บมั่วๆ',
  },
  neuro: {
    label: 'เป็นลม · ชัก · สมอง', icon: '🧠', order: 4,
    desc: 'เป็นลมนอนยกขา · คนชักห้ามยัดปาก · FAST · "คนเมา" ที่จริงๆ คือน้ำตาลต่ำ',
  },
  outdoor: {
    label: 'กลางแจ้ง · สารเคมี', icon: '🌿', order: 5,
    desc: 'งูกัด · ลมแดด · สารเคมีเข้าตา — เหตุนอกบ้านที่ความเชื่อผิดๆ อันตรายที่สุด',
  },
  other: { label: 'เคสอื่นๆ', icon: '📋', order: 9, desc: '' },
};

// เคสที่ไม่ระบุ track ตกหมวด 'other'
export function trackOf(s) {
  return TRACK_META[s.track] ? s.track : 'other';
}

// ── ฉากพื้นหลังบนเวที ──────────────────────────────────────────────────
// ไฟล์อยู่ที่ public/images/backgrounds/{key}.webp (แนวนอน 1536x1024)
// ฉากใช้ร่วมกันหลายเคส — เคสที่ไม่ระบุ bg (หรือ key ที่ไม่รู้จัก) ใช้ฉาก
// gradient เดิมของเวที จึงไม่มีทางได้เวทีที่ภาพหาย
export const BACKGROUNDS = {
  fresh_market: 'ตลาดสด',
  noodle_shop: 'ร้านก๋วยเตี๋ยว/ร้านอาหาร',
  road_intersection: 'แยกถนน (อุบัติเหตุรถล้ม)',
  office_room: 'ออฟฟิศ',
  backyard_garden: 'สวนท้ายบ้าน',
  running_event: 'งานวิ่งการกุศล',
  canal_side: 'ริมคลอง',
  home_room: 'ห้องนั่งเล่น/โต๊ะกินข้าวในบ้าน',
  home_stairs: 'โถงบันไดในบ้าน',
  bathroom: 'ห้องน้ำ',
  soi_corner: 'หน้าปากซอย',
  buffet_restaurant: 'ร้านบุฟเฟ่ต์',
  flag_yard: 'ลานหน้าเสาธงตอนเช้า',
  party_hall: 'งานเลี้ยง',
};

export function backgroundUrl(s) {
  return s && BACKGROUNDS[s.bg] ? `/images/backgrounds/${s.bg}.webp` : null;
}
