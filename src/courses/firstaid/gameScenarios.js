// FIRST AID HERO — คลังโจทย์เกมตัดสินใจ (story-driven, Ace Attorney style)
//
// โครงนี้คือ "ข้อมูลโจทย์" ล้วนๆ — engine อยู่ที่ src/game/storyEngine.js
// ตัวละครอ้างด้วย charId จาก src/game/characters.js (who) + สีหน้า (pose)
// text อนุญาต HTML แค่ <span class="cbs-em"> สำหรับเน้นคำ
//
// แต่ละเคสมี field:
//   id, title, subtitle, level ('basic'|'intermediate'|'megacode'),
//   track (หมวดในหน้าเลือกเคส — key ของ TRACK_META, ไม่ระบุ = 'other'),
//   hiddenCause (เคสที่ต้องจับสัญญาณอาการเอง — ใช้ปลดเหรียญ 🔍), story[]
//
// หมายเหตุ: เกมนี้เป็น "โหมดโบนัส" แยกจากสถานการณ์จำลองหลัก (/simulation)
// ไม่มีผลต่อ progress, post-test หรือใบเซอร์

import { faCprAed } from './game/faCprAed';
import { faChoking } from './game/faChoking';
import { faBleeding } from './game/faBleeding';
import { faBurn } from './game/faBurn';
import { faSeizure } from './game/faSeizure';
import { faStroke } from './game/faStroke';

// เคสทั้งหมด — จัดเรียงตามหมวด (track) และในหมวดเรียงง่าย→ยาก
// ลำดับในนี้คือ "บันได" ของแต่ละหมวดบนหน้าเลือกเคส + ลำดับเคสแนะนำถัดไป
export const scenarios = [
  // ── 🫀 หมดสติ · CPR + AED ──
  faCprAed,
  // ── 🌬 สำลัก ──
  faChoking,
  // ── 🩹 เลือดออก · แผลไหม้ ──
  faBleeding,
  faBurn,
  // ── 🧠 ชัก · หลอดเลือดสมอง ──
  faSeizure,
  faStroke,
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
    desc: 'อาหารติดคอ พูดไม่ออก — รัดกระตุกหน้าท้องให้ทันก่อนหมดสติ',
  },
  trauma: {
    label: 'เลือดออก · แผลไหม้', icon: '🩹', order: 2,
    desc: 'ห้ามเลือดให้ทัน · ระบายความร้อนแผลไหม้ให้ถูกวิธี',
  },
  neuro: {
    label: 'ชัก · หลอดเลือดสมอง', icon: '🧠', order: 3,
    desc: 'ดูแลคนชักให้ปลอดภัย · จับสัญญาณ FAST แล้วรีบโทร 1669',
  },
  other: { label: 'เคสอื่นๆ', icon: '📋', order: 9, desc: '' },
};

// เคสที่ไม่ระบุ track ตกหมวด 'other'
export function trackOf(s) {
  return TRACK_META[s.track] ? s.track : 'other';
}
