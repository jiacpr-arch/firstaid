// Character registry — เกม FIRST AID HERO (สไตล์ Ace Attorney)
//
// ตัวละครทั้งหมดเป็น "ข้อมูล" ไม่ใช่โค้ดเกม:
//   - เกม/โจทย์อ้างถึงตัวละครด้วย charId + pose เท่านั้น
//   - รูปจริงวางที่ public/images/characters/{charId}/{pose}.webp
//     (+ {pose}_talk.webp สำหรับเฟรมปากอ้า — มีหรือไม่มีก็ได้)
//   - ถ้ายังไม่มีรูปจริง CharacterSprite จะ fallback มาใช้ SVG placeholder ในไฟล์นี้
//   - เพิ่มตัวละครใหม่ = เพิ่ม entry ที่นี่ + วางรูปในโฟลเดอร์ ไม่ต้องแตะ engine

export const POSES = ['idle', 'talk', 'panic', 'stern', 'happy'];

const OUT = '#0E1322';

function eyes(pose, x1, x2, y, iris) {
  if (pose === 'happy') {
    return `<path d="M${x1 - 9},${y} Q${x1},${y - 9} ${x1 + 9},${y}" stroke="${OUT}" stroke-width="3.4" fill="none" stroke-linecap="round"/>
            <path d="M${x2 - 9},${y} Q${x2},${y - 9} ${x2 + 9},${y}" stroke="${OUT}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
  }
  const r = pose === 'panic' ? 8.5 : 7;
  const pr = pose === 'panic' ? 2.6 : 3.4;
  return `<ellipse cx="${x1}" cy="${y}" rx="${r}" ry="${r + 1.5}" fill="#fff" stroke="${OUT}" stroke-width="2.6"/>
          <circle cx="${x1}" cy="${y + 1}" r="${pr}" fill="${iris}"/>
          <circle cx="${x1 + 1.5}" cy="${y - 1.5}" r="1.3" fill="#fff"/>
          <ellipse cx="${x2}" cy="${y}" rx="${r}" ry="${r + 1.5}" fill="#fff" stroke="${OUT}" stroke-width="2.6"/>
          <circle cx="${x2}" cy="${y + 1}" r="${pr}" fill="${iris}"/>
          <circle cx="${x2 + 1.5}" cy="${y - 1.5}" r="1.3" fill="#fff"/>`;
}

function brows(pose, x1, x2, y) {
  if (pose === 'stern') {
    return `<path d="M${x1 - 10},${y - 6} L${x1 + 9},${y + 1}" stroke="${OUT}" stroke-width="4" stroke-linecap="round"/>
            <path d="M${x2 + 10},${y - 6} L${x2 - 9},${y + 1}" stroke="${OUT}" stroke-width="4" stroke-linecap="round"/>`;
  }
  if (pose === 'panic') {
    return `<path d="M${x1 - 9},${y + 1} Q${x1},${y - 8} ${x1 + 9},${y - 2}" stroke="${OUT}" stroke-width="3.6" fill="none" stroke-linecap="round"/>
            <path d="M${x2 + 9},${y + 1} Q${x2},${y - 8} ${x2 - 9},${y - 2}" stroke="${OUT}" stroke-width="3.6" fill="none" stroke-linecap="round"/>`;
  }
  return `<path d="M${x1 - 9},${y - 2} Q${x1},${y - 6} ${x1 + 9},${y - 2}" stroke="${OUT}" stroke-width="3.6" fill="none" stroke-linecap="round"/>
          <path d="M${x2 - 9},${y - 2} Q${x2},${y - 6} ${x2 + 9},${y - 2}" stroke="${OUT}" stroke-width="3.6" fill="none" stroke-linecap="round"/>`;
}

function mouth(pose, cx, y) {
  if (pose === 'panic') return `<ellipse cx="${cx}" cy="${y + 3}" rx="9" ry="11" fill="#8C3A46" stroke="${OUT}" stroke-width="2.8"/>`;
  if (pose === 'happy') return `<path d="M${cx - 12},${y} Q${cx},${y + 13} ${cx + 12},${y}" fill="#8C3A46" stroke="${OUT}" stroke-width="2.8"/>`;
  if (pose === 'stern') return `<path d="M${cx - 10},${y + 4} Q${cx},${y - 2} ${cx + 10},${y + 4}" stroke="${OUT}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  return `<path d="M${cx - 8},${y + 2} Q${cx},${y + 6} ${cx + 8},${y + 2}" stroke="${OUT}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
}

function mouthTalk(cx, y) {
  return `<ellipse cx="${cx}" cy="${y + 2}" rx="7" ry="6" fill="#8C3A46" stroke="${OUT}" stroke-width="2.8"/>`;
}

// wrap face parts so CharacterSprite toggles ปากปิด/ปากอ้า ระหว่างพิมพ์บทพูด
function mouthGroups(pose, cx, y) {
  return `<g data-mouth="idle">${mouth(pose, cx, y)}</g>
          <g data-mouth="talk" style="display:none">${mouthTalk(cx, y)}</g>`;
}

export const CHARACTERS = {
  // เพื่อนที่อยู่ในเหตุการณ์ — คนรายงานสถานการณ์/ตกใจ
  friend_pim: {
    name: 'พิม',
    role: 'เพื่อนในเหตุการณ์',
    plate: ['#2FA8A0', '#17706B'],
    placeholder(pose) {
      const skin = '#F6CDA8', shirt = '#2FA8A0', shirtD = '#1E7F79', hair = '#2A2233';
      return `<svg viewBox="0 0 200 250" xmlns="http://www.w3.org/2000/svg">
      <path d="M28,250 L28,206 Q28,172 100,170 Q172,172 172,206 L172,250 Z" fill="${shirt}" stroke="${OUT}" stroke-width="4"/>
      <path d="M78,172 Q100,190 122,172 L122,182 Q100,198 78,182 Z" fill="${shirtD}" stroke="${OUT}" stroke-width="3"/>
      <rect x="88" y="150" width="24" height="26" fill="${skin}" stroke="${OUT}" stroke-width="3.4"/>
      <path d="M52,100 Q52,42 100,40 Q148,42 148,100 Q148,140 128,152 Q114,161 100,161 Q86,161 72,152 Q52,140 52,100 Z" fill="${skin}" stroke="${OUT}" stroke-width="4"/>
      <circle cx="146" cy="58" r="17" fill="${hair}" stroke="${OUT}" stroke-width="3.4"/>
      <path d="M48,106 Q42,44 100,34 Q158,44 152,106 Q150,80 138,72 Q120,88 100,66 Q80,88 62,72 Q50,80 48,106 Z" fill="${hair}" stroke="${OUT}" stroke-width="4"/>
      ${brows(pose, 80, 120, 92)}
      ${eyes(pose, 80, 120, 104, '#4A3728')}
      ${mouthGroups(pose, 100, 132)}
      <path d="M96,112 L104,112" stroke="#E3AC85" stroke-width="2.6" stroke-linecap="round"/>
      </svg>`;
    },
  },

  // คนช่วยข้างทาง — อาสากดหน้าอก/ลงมือทำตามคำสั่งผู้เล่น
  lung_chai: {
    name: 'ลุงชัย',
    role: 'คนช่วยข้างทาง',
    plate: ['#3E9E52', '#256936'],
    placeholder(pose) {
      const skin = '#EEB98C', shirt = '#3E9E52', shirtD = '#2A6E39', hair = '#5B6069';
      return `<svg viewBox="0 0 200 250" xmlns="http://www.w3.org/2000/svg">
      <path d="M22,250 L22,204 Q22,168 100,166 Q178,168 178,204 L178,250 Z" fill="${shirt}" stroke="${OUT}" stroke-width="4"/>
      <path d="M74,172 L100,198 L126,172 L119,166 L100,184 L81,166 Z" fill="${shirtD}" stroke="${OUT}" stroke-width="3"/>
      <rect x="86" y="148" width="28" height="26" fill="${skin}" stroke="${OUT}" stroke-width="3.4"/>
      <path d="M52,102 Q52,44 100,42 Q148,44 148,102 Q148,140 128,152 Q114,160 100,160 Q86,160 72,152 Q52,140 52,102 Z" fill="${skin}" stroke="${OUT}" stroke-width="4"/>
      <path d="M50,92 Q52,40 100,32 Q148,40 150,92 L140,88 Q136,66 120,62 Q104,74 100,62 Q96,74 80,62 Q64,66 60,88 Z" fill="${hair}" stroke="${OUT}" stroke-width="4"/>
      ${brows(pose, 80, 120, 96)}
      ${eyes(pose, 80, 120, 107, '#33261B')}
      ${mouthGroups(pose, 100, 134)}
      <path d="M60,120 Q58,126 62,130 M140,120 Q142,126 138,130" stroke="#D89B6C" stroke-width="2.4" fill="none"/>
      <path d="M86,142 Q100,148 114,142" stroke="#D89B6C" stroke-width="2.2" fill="none"/>
      </svg>`;
    },
  },

  // เจ้าหน้าที่ 1669 ปลายสาย — เสียง mentor ของเกม (คอยชี้แนะ/ดุเมื่อตัดสินใจผิด)
  // charId นี้ถูกอ้างตรงๆ ใน FirstAidGame.jsx (จังหวะ time-skip + ต่อว่าเมื่อตอบผิด) ห้ามลบ
  opr_1669: {
    name: 'จนท. 1669',
    role: 'ศูนย์สั่งการฉุกเฉิน',
    plate: ['#8E4FC8', '#5B2E86'],
    placeholder(pose) {
      const skin = '#EDBE96', shirt = '#3C4C86', shirtD = '#283765', hair = '#3A3F4B';
      return `<svg viewBox="0 0 200 250" xmlns="http://www.w3.org/2000/svg">
      <path d="M20,250 L20,206 Q20,168 100,166 Q180,168 180,204 L180,250 Z" fill="${shirt}" stroke="${OUT}" stroke-width="4"/>
      <path d="M76,174 L100,200 L124,174 L118,168 L100,186 L82,168 Z" fill="${shirtD}" stroke="${OUT}" stroke-width="3"/>
      <rect x="30" y="196" width="52" height="16" rx="6" fill="#E5484D" stroke="${OUT}" stroke-width="3"/>
      <rect x="88" y="148" width="24" height="26" fill="${skin}" stroke="${OUT}" stroke-width="3.4"/>
      <path d="M54,102 Q54,46 100,44 Q146,46 146,102 Q146,138 127,150 Q113,159 100,159 Q87,159 73,150 Q54,138 54,102 Z" fill="${skin}" stroke="${OUT}" stroke-width="4"/>
      <path d="M50,96 Q54,40 100,36 Q146,40 150,96 Q146,66 128,62 Q110,74 100,60 Q90,74 72,62 Q54,66 50,96 Z" fill="${hair}" stroke="${OUT}" stroke-width="4"/>
      <path d="M48,86 Q44,54 74,44" stroke="${OUT}" stroke-width="5" fill="none" stroke-linecap="round"/>
      <ellipse cx="52" cy="104" rx="9" ry="12" fill="#20242E" stroke="${OUT}" stroke-width="3"/>
      <path d="M56,116 Q66,132 84,136" stroke="#20242E" stroke-width="4.5" fill="none" stroke-linecap="round"/>
      <circle cx="86" cy="137" r="5" fill="#20242E" stroke="${OUT}" stroke-width="2.4"/>
      ${eyes(pose, 79, 121, 107, '#3A3228')}
      ${brows(pose, 79, 121, 90)}
      ${mouthGroups(pose, 100, 132)}
      </svg>`;
    },
  },

  // ครูปฐมพยาบาล — โผล่มาชม/สรุปบทเรียนตอนจบเคส
  kru_fah: {
    name: 'ครูฟ้า',
    role: 'ครูปฐมพยาบาล',
    plate: ['#D98A2B', '#96570F'],
    placeholder(pose) {
      const skin = '#F6CDA8', shirt = '#D98A2B', shirtD = '#A5610E', hair = '#4A2E1E';
      return `<svg viewBox="0 0 200 250" xmlns="http://www.w3.org/2000/svg">
      <path d="M28,250 L28,206 Q28,172 100,170 Q172,172 172,206 L172,250 Z" fill="${shirt}" stroke="${OUT}" stroke-width="4"/>
      <path d="M76,176 L100,200 L124,176 L118,170 L100,186 L82,170 Z" fill="${shirtD}" stroke="${OUT}" stroke-width="3"/>
      <rect x="88" y="150" width="24" height="26" fill="${skin}" stroke="${OUT}" stroke-width="3.4"/>
      <path d="M40,120 Q30,180 44,214 L58,208 Q48,170 56,124 Z" fill="${hair}" stroke="${OUT}" stroke-width="3.6"/>
      <path d="M160,120 Q170,180 156,214 L142,208 Q152,170 144,124 Z" fill="${hair}" stroke="${OUT}" stroke-width="3.6"/>
      <path d="M52,100 Q52,42 100,40 Q148,42 148,100 Q148,140 128,152 Q114,161 100,161 Q86,161 72,152 Q52,140 52,100 Z" fill="${skin}" stroke="${OUT}" stroke-width="4"/>
      <path d="M46,110 Q40,42 100,32 Q160,42 154,110 Q152,78 136,68 Q118,84 100,62 Q82,84 64,68 Q48,78 46,110 Z" fill="${hair}" stroke="${OUT}" stroke-width="4"/>
      <path d="M92,166 L100,174 L108,166" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>
      ${brows(pose, 80, 120, 92)}
      ${eyes(pose, 80, 120, 104, '#5A3A22')}
      ${mouthGroups(pose, 100, 132)}
      </svg>`;
    },
  },
};

// SVG placeholder กลาง — เผื่อโจทย์อ้าง charId ที่ยังไม่มีใน registry (กัน "หน้าหาย")
function genericPlaceholder(entry) {
  const coat = entry?.plate?.[0] || '#405089';
  const coatD = entry?.plate?.[1] || '#232F5E';
  return (pose) => `<svg viewBox="0 0 200 250" xmlns="http://www.w3.org/2000/svg">
    <path d="M24,250 L24,206 Q24,170 100,168 Q176,170 176,206 L176,250 Z" fill="${coat}" stroke="${OUT}" stroke-width="4"/>
    <path d="M76,174 L100,200 L124,174 L118,168 L100,186 L82,168 Z" fill="${coatD}" stroke="${OUT}" stroke-width="3"/>
    <rect x="88" y="150" width="24" height="26" fill="#EDBE96" stroke="${OUT}" stroke-width="3.4"/>
    <ellipse cx="100" cy="100" rx="46" ry="52" fill="#EDBE96" stroke="${OUT}" stroke-width="4"/>
    <path d="M52,96 Q56,42 100,38 Q144,42 148,96 Q144,66 128,62 Q110,74 100,60 Q90,74 72,62 Q56,66 52,96 Z" fill="#3A3F4B" stroke="${OUT}" stroke-width="4"/>
    ${brows(pose, 79, 121, 90)}
    ${eyes(pose, 79, 121, 104, '#3A3228')}
    ${mouthGroups(pose, 100, 132)}
  </svg>`;
}

export function getCharacter(charId) {
  if (CHARACTERS[charId]) return CHARACTERS[charId];
  if (!charId) return null;
  const fallback = { name: '—', role: '', plate: ['#405089', '#232F5E'] };
  return { ...fallback, placeholder: genericPlaceholder(fallback) };
}

// URL รูปจริง (ถ้ามี) — CharacterSprite จะ probe แล้ว fallback เป็น SVG placeholder เอง
export function characterImageUrl(charId, pose, talking = false) {
  return `/images/characters/${charId}/${pose}${talking ? '_talk' : ''}.webp`;
}
