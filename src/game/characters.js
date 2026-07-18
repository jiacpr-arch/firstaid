// Character registry — เกม FIRST AID HERO (สไตล์ Ace Attorney)
//
// ตัวละครทั้งหมดเป็น "ข้อมูล" ไม่ใช่โค้ดเกม:
//   - เกม/โจทย์อ้างถึงตัวละครด้วย charId + pose เท่านั้น
//   - รูปจริงวางที่ public/images/characters/{charId}/{pose}.webp
//     (+ {pose}_talk.webp สำหรับเฟรมปากอ้า — มีหรือไม่มีก็ได้)
//   - ถ้ายังไม่มีรูปจริง CharacterSprite จะใช้ภาพเวกเตอร์ในไฟล์นี้ (อาร์ตหลักของเกม)
//   - เพิ่มตัวละครใหม่ = เพิ่ม entry ที่นี่ + วางรูปในโฟลเดอร์ ไม่ต้องแตะ engine

export const POSES = ['idle', 'talk', 'panic', 'stern', 'happy'];

const OUT = '#0E1322';

// ── ชิ้นส่วนใบหน้าตามอารมณ์ (ใช้ร่วมทุกตัวละคร) ─────────────────────────
function eyes(pose, x1, x2, y, iris) {
  if (pose === 'happy') {
    return `<path d="M${x1 - 9},${y} Q${x1},${y - 9} ${x1 + 9},${y}" stroke="${OUT}" stroke-width="3.4" fill="none" stroke-linecap="round"/>
            <path d="M${x2 - 9},${y} Q${x2},${y - 9} ${x2 + 9},${y}" stroke="${OUT}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
  }
  const r = pose === 'panic' ? 8.5 : 7;
  const pr = pose === 'panic' ? 2.6 : 3.4;
  const lid = pose === 'stern'
    ? `<path d="M${x1 - 8},${y - 6} L${x1 + 8},${y - 4}" stroke="${OUT}" stroke-width="2.6"/>
       <path d="M${x2 + 8},${y - 6} L${x2 - 8},${y - 4}" stroke="${OUT}" stroke-width="2.6"/>`
    : '';
  return `<ellipse cx="${x1}" cy="${y}" rx="${r}" ry="${r + 1.5}" fill="#fff" stroke="${OUT}" stroke-width="2.6"/>
          <circle cx="${x1}" cy="${y + 1}" r="${pr}" fill="${iris}"/>
          <circle cx="${x1 + 1.5}" cy="${y - 1.5}" r="1.3" fill="#fff"/>
          <ellipse cx="${x2}" cy="${y}" rx="${r}" ry="${r + 1.5}" fill="#fff" stroke="${OUT}" stroke-width="2.6"/>
          <circle cx="${x2}" cy="${y + 1}" r="${pr}" fill="${iris}"/>
          <circle cx="${x2 + 1.5}" cy="${y - 1.5}" r="1.3" fill="#fff"/>
          ${lid}`;
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
  if (pose === 'panic') return `<ellipse cx="${cx}" cy="${y + 3}" rx="9" ry="11" fill="#8C3A46" stroke="${OUT}" stroke-width="2.8"/><ellipse cx="${cx}" cy="${y + 7}" rx="5" ry="4.5" fill="#D96C77"/>`;
  if (pose === 'happy') return `<path d="M${cx - 12},${y} Q${cx},${y + 13} ${cx + 12},${y}" fill="#8C3A46" stroke="${OUT}" stroke-width="2.8"/><path d="M${cx - 8},${y + 1} Q${cx},${y + 4} ${cx + 8},${y + 1}" fill="#fff"/>`;
  if (pose === 'stern') return `<path d="M${cx - 10},${y + 4} Q${cx},${y - 2} ${cx + 10},${y + 4}" stroke="${OUT}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  return `<path d="M${cx - 8},${y + 2} Q${cx},${y + 6} ${cx + 8},${y + 2}" stroke="${OUT}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
}

function mouthTalk(cx, y) {
  return `<ellipse cx="${cx}" cy="${y + 2}" rx="7" ry="6" fill="#8C3A46" stroke="${OUT}" stroke-width="2.8"/><ellipse cx="${cx}" cy="${y + 4}" rx="3.6" ry="2.6" fill="#D96C77"/>`;
}

// wrap face parts so CharacterSprite toggles ปากปิด/ปากอ้า ระหว่างพิมพ์บทพูด
function mouthGroups(pose, cx, y) {
  return `<g data-mouth="idle">${mouth(pose, cx, y)}</g>
          <g data-mouth="talk" style="display:none">${mouthTalk(cx, y)}</g>`;
}

// เหงื่อแตกตอน panic + เส้นสั่นตอน stern (เอฟเฟกต์อารมณ์แบบการ์ตูน)
function emotionFx(pose) {
  if (pose === 'panic') {
    return `<path d="M148,70 Q153,78 148,84 Q143,78 148,70 Z" fill="#9CD8F7" stroke="${OUT}" stroke-width="2.4"/>
            <path d="M160,88 Q164,94 160,99 Q156,94 160,88 Z" fill="#9CD8F7" stroke="${OUT}" stroke-width="2.2"/>`;
  }
  if (pose === 'stern') {
    return `<path d="M152,62 l8,-8 M156,68 l8,-8 M160,74 l8,-8" stroke="#E5484D" stroke-width="3" stroke-linecap="round"/>`;
  }
  return '';
}

// จมูก + เงาใต้คาง (cel shade) — โทนสีตามผิวแต่ละตัว
function faceBase(skinShade, noseY = 114) {
  return `<path d="M97,${noseY} Q100,${noseY + 4} 103,${noseY}" stroke="${skinShade}" stroke-width="2.8" fill="none" stroke-linecap="round"/>
          <path d="M84,146 Q100,156 116,146 Q100,152 84,146 Z" fill="${skinShade}" opacity=".55"/>`;
}

function blush(pose, y = 122) {
  if (pose !== 'happy' && pose !== 'panic') return '';
  return `<ellipse cx="72" cy="${y}" rx="7" ry="3.6" fill="#F09A9A" opacity=".55"/>
          <ellipse cx="128" cy="${y}" rx="7" ry="3.6" fill="#F09A9A" opacity=".55"/>`;
}

export const CHARACTERS = {
  // เพื่อนที่อยู่ในเหตุการณ์ — คนรายงานสถานการณ์/ตกใจ
  friend_pim: {
    name: 'พิม',
    role: 'เพื่อนในเหตุการณ์',
    plate: ['#2FA8A0', '#17706B'],
    placeholder(pose) {
      const skin = '#F6CDA8', skinD = '#E0AC80', shirt = '#2FA8A0', shirtD = '#1E7F79', shirtL = '#4FC2BA', hair = '#2A2233', hairL = '#4A3F58';
      return `<svg viewBox="0 0 200 250" xmlns="http://www.w3.org/2000/svg">
      <!-- ลำตัว: เสื้อยืดคอกลม + เงาผ้า -->
      <path d="M28,250 L28,208 Q28,174 100,172 Q172,174 172,208 L172,250 Z" fill="${shirt}" stroke="${OUT}" stroke-width="4"/>
      <path d="M28,250 L28,208 Q28,182 52,176 L52,250 Z" fill="${shirtD}" opacity=".45"/>
      <path d="M148,178 Q166,184 170,204 L172,250 L148,250 Z" fill="${shirtL}" opacity=".35"/>
      <path d="M80,174 Q100,190 120,174 L120,184 Q100,200 80,184 Z" fill="${shirtD}" stroke="${OUT}" stroke-width="3"/>
      <path d="M64,196 Q68,214 66,236 M136,196 Q132,214 134,236" stroke="${shirtD}" stroke-width="2.6" fill="none" opacity=".7"/>
      <!-- คอ -->
      <path d="M88,150 L88,178 Q100,186 112,178 L112,150 Z" fill="${skin}" stroke="${OUT}" stroke-width="3.4"/>
      <path d="M88,150 L88,164 Q100,172 112,164 L112,150 Q100,160 88,150 Z" fill="${skinD}" opacity=".5"/>
      <!-- ผมด้านหลัง + มวยผมต่ำ -->
      <circle cx="148" cy="62" r="18" fill="${hair}" stroke="${OUT}" stroke-width="3.4"/>
      <path d="M143,52 Q152,50 158,58" stroke="${hairL}" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M46,120 Q40,60 100,32 Q160,60 154,120 L142,120 Q146,80 128,66 L72,66 Q54,80 58,120 Z" fill="${hair}" stroke="${OUT}" stroke-width="4"/>
      <!-- ใบหน้า -->
      <path d="M52,100 Q52,42 100,40 Q148,42 148,100 Q148,140 128,152 Q114,161 100,161 Q86,161 72,152 Q52,140 52,100 Z" fill="${skin}" stroke="${OUT}" stroke-width="4"/>
      <!-- หู + ต่างหู -->
      <path d="M50,104 Q44,110 50,120 Q56,122 58,114 Z" fill="${skin}" stroke="${OUT}" stroke-width="3"/>
      <path d="M150,104 Q156,110 150,120 Q144,122 142,114 Z" fill="${skin}" stroke="${OUT}" stroke-width="3"/>
      <circle cx="52" cy="122" r="2.6" fill="#F2C14E" stroke="${OUT}" stroke-width="1.6"/>
      <circle cx="148" cy="122" r="2.6" fill="#F2C14E" stroke="${OUT}" stroke-width="1.6"/>
      <!-- ผมหน้าม้าเฉียง + ไฮไลต์ -->
      <path d="M48,106 Q42,44 100,34 Q158,44 152,106 Q150,78 136,70 Q112,88 88,64 Q76,84 62,74 Q50,82 48,106 Z" fill="${hair}" stroke="${OUT}" stroke-width="4"/>
      <path d="M70,50 Q92,40 116,46" stroke="${hairL}" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M56,84 Q60,68 74,60" stroke="${hairL}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>
      ${faceBase(skinD)}
      ${blush(pose)}
      ${brows(pose, 80, 120, 92)}
      ${eyes(pose, 80, 120, 104, '#4A3728')}
      ${mouthGroups(pose, 100, 132)}
      ${emotionFx(pose)}
      </svg>`;
    },
  },

  // คนช่วยข้างทาง — อาสากดหน้าอก/ลงมือทำตามคำสั่งผู้เล่น
  lung_chai: {
    name: 'ลุงชัย',
    role: 'คนช่วยข้างทาง',
    plate: ['#3E9E52', '#256936'],
    placeholder(pose) {
      const skin = '#E4A97C', skinD = '#C88A5C', shirt = '#3E9E52', shirtD = '#2A6E39', shirtL = '#5FBE72', hair = '#555B66', hairL = '#9AA2AE';
      return `<svg viewBox="0 0 200 250" xmlns="http://www.w3.org/2000/svg">
      <!-- ลำตัว: เสื้อโปโลมีปก ไหล่กว้าง -->
      <path d="M20,250 L20,206 Q20,170 100,168 Q180,170 180,206 L180,250 Z" fill="${shirt}" stroke="${OUT}" stroke-width="4"/>
      <path d="M20,250 L20,206 Q20,180 46,174 L46,250 Z" fill="${shirtD}" opacity=".45"/>
      <path d="M154,176 Q176,182 178,204 L180,250 L154,250 Z" fill="${shirtL}" opacity=".3"/>
      <!-- ปกเสื้อโปโล + กระดุม -->
      <path d="M74,170 L100,196 L126,170 L136,178 L100,212 L64,178 Z" fill="${shirtD}" stroke="${OUT}" stroke-width="3"/>
      <path d="M94,196 L100,240 L106,196 Q100,202 94,196 Z" fill="${shirtL}" stroke="${OUT}" stroke-width="2.6"/>
      <circle cx="100" cy="212" r="2.4" fill="${OUT}"/>
      <circle cx="100" cy="226" r="2.4" fill="${OUT}"/>
      <!-- คอ -->
      <path d="M86,148 L86,176 Q100,184 114,176 L114,148 Z" fill="${skin}" stroke="${OUT}" stroke-width="3.4"/>
      <path d="M86,148 L86,162 Q100,170 114,162 L114,148 Q100,158 86,148 Z" fill="${skinD}" opacity=".5"/>
      <!-- ใบหน้า (เหลี่ยมกว่าเล็กน้อย) -->
      <path d="M52,102 Q52,44 100,42 Q148,44 148,102 Q148,140 128,152 Q114,160 100,160 Q86,160 72,152 Q52,140 52,102 Z" fill="${skin}" stroke="${OUT}" stroke-width="4"/>
      <!-- หู -->
      <path d="M50,104 Q44,110 50,121 Q57,123 59,114 Z" fill="${skin}" stroke="${OUT}" stroke-width="3"/>
      <path d="M150,104 Q156,110 150,121 Q143,123 141,114 Z" fill="${skin}" stroke="${OUT}" stroke-width="3"/>
      <!-- ผมสั้นแซมหงอก -->
      <path d="M50,94 Q52,42 100,34 Q148,42 150,94 L140,90 Q138,64 120,60 Q104,72 100,62 Q96,72 80,62 Q62,66 60,90 Z" fill="${hair}" stroke="${OUT}" stroke-width="4"/>
      <path d="M64,54 Q80,44 98,44 M112,46 Q126,48 136,58" stroke="${hairL}" stroke-width="3.4" fill="none" stroke-linecap="round"/>
      <path d="M56,80 L60,86 M144,80 L140,86" stroke="${hairL}" stroke-width="3" stroke-linecap="round"/>
      ${faceBase(skinD, 116)}
      <!-- ริ้วรอยยิ้ม + หนวดเคราลายจุด -->
      <path d="M60,122 Q58,128 62,132 M140,122 Q142,128 138,132" stroke="${skinD}" stroke-width="2.4" fill="none"/>
      <path d="M78,140 Q80,141 82,140 M92,146 Q94,147 96,146 M108,146 Q110,147 112,146 M118,140 Q120,141 122,140" stroke="${skinD}" stroke-width="2" stroke-linecap="round"/>
      ${blush(pose, 124)}
      ${brows(pose, 80, 120, 96)}
      ${eyes(pose, 80, 120, 107, '#33261B')}
      ${mouthGroups(pose, 100, 134)}
      ${emotionFx(pose)}
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
      const skin = '#EDBE96', skinD = '#D19C6E', shirt = '#3C4C86', shirtD = '#283765', shirtL = '#5A6CAC', hair = '#3A3F4B', hairL = '#6B7280', gear = '#20242E';
      return `<svg viewBox="0 0 200 250" xmlns="http://www.w3.org/2000/svg">
      <!-- ลำตัว: เครื่องแบบกรมท่า + อินทรธนู -->
      <path d="M20,250 L20,206 Q20,168 100,166 Q180,168 180,204 L180,250 Z" fill="${shirt}" stroke="${OUT}" stroke-width="4"/>
      <path d="M20,250 L20,206 Q20,180 46,172 L46,250 Z" fill="${shirtD}" opacity=".5"/>
      <path d="M154,174 Q176,180 178,202 L180,250 L154,250 Z" fill="${shirtL}" opacity=".3"/>
      <path d="M30,182 L62,172 L64,180 L34,190 Z" fill="${shirtD}" stroke="${OUT}" stroke-width="2.6"/>
      <path d="M170,182 L138,172 L136,180 L166,190 Z" fill="${shirtD}" stroke="${OUT}" stroke-width="2.6"/>
      <!-- ปกเชิ้ต + กระเป๋าอก + วิทยุแดง -->
      <path d="M76,172 L100,198 L124,172 L118,166 L100,186 L82,166 Z" fill="${shirtD}" stroke="${OUT}" stroke-width="3"/>
      <rect x="112" y="206" width="34" height="24" rx="3" fill="${shirtD}" stroke="${OUT}" stroke-width="2.6"/>
      <rect x="32" y="198" width="26" height="38" rx="5" fill="#C43B40" stroke="${OUT}" stroke-width="3"/>
      <rect x="36" y="204" width="18" height="10" rx="2" fill="#7FE0B0" stroke="${OUT}" stroke-width="1.8"/>
      <path d="M38,194 L38,186 M46,194 L46,182" stroke="${OUT}" stroke-width="2.6" stroke-linecap="round"/>
      <!-- ป้ายชื่อ 1669 -->
      <rect x="118" y="188" width="30" height="11" rx="2" fill="#F2C14E" stroke="${OUT}" stroke-width="2"/>
      <text x="133" y="197" text-anchor="middle" font-family="monospace" font-size="8.5" font-weight="bold" fill="${OUT}">1669</text>
      <!-- คอ -->
      <path d="M88,148 L88,174 Q100,182 112,174 L112,148 Z" fill="${skin}" stroke="${OUT}" stroke-width="3.4"/>
      <path d="M88,148 L88,160 Q100,168 112,160 L112,148 Q100,158 88,148 Z" fill="${skinD}" opacity=".5"/>
      <!-- ใบหน้า -->
      <path d="M54,102 Q54,46 100,44 Q146,46 146,102 Q146,138 127,150 Q113,159 100,159 Q87,159 73,150 Q54,138 54,102 Z" fill="${skin}" stroke="${OUT}" stroke-width="4"/>
      <!-- หู -->
      <path d="M148,106 Q154,112 148,122 Q142,124 140,116 Z" fill="${skin}" stroke="${OUT}" stroke-width="3"/>
      <!-- ผมสั้นเรียบ + ไฮไลต์ -->
      <path d="M50,96 Q54,40 100,36 Q146,40 150,96 Q146,66 128,62 Q110,74 100,60 Q90,74 72,62 Q54,66 50,96 Z" fill="${hair}" stroke="${OUT}" stroke-width="4"/>
      <path d="M74,52 Q94,42 118,48" stroke="${hairL}" stroke-width="3.6" fill="none" stroke-linecap="round"/>
      ${faceBase(skinD)}
      ${blush(pose)}
      ${eyes(pose, 79, 121, 107, '#3A3228')}
      ${brows(pose, 79, 121, 90)}
      ${mouthGroups(pose, 100, 132)}
      <!-- headset: ก้านคาดหัว + ครอบหูซ้าย + ไมค์บูม -->
      <path d="M50,84 Q48,50 78,42" stroke="${gear}" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="M50,84 Q48,50 78,42" stroke="${hairL}" stroke-width="2" fill="none" stroke-linecap="round" opacity=".6"/>
      <rect x="42" y="98" width="16" height="26" rx="7" fill="${gear}" stroke="${OUT}" stroke-width="3"/>
      <rect x="46" y="104" width="8" height="14" rx="4" fill="#4A5262"/>
      <path d="M54,124 Q64,140 82,144" stroke="${gear}" stroke-width="4.5" fill="none" stroke-linecap="round"/>
      <ellipse cx="85" cy="145" rx="6" ry="4.6" fill="${gear}" stroke="${OUT}" stroke-width="2.4"/>
      <circle cx="85" cy="145" r="1.6" fill="#7FE0B0"/>
      ${emotionFx(pose)}
      </svg>`;
    },
  },

  // ครูปฐมพยาบาล — โผล่มาชม/สรุปบทเรียนตอนจบเคส
  kru_fah: {
    name: 'ครูฟ้า',
    role: 'ครูปฐมพยาบาล',
    plate: ['#D98A2B', '#96570F'],
    placeholder(pose) {
      const skin = '#F6CDA8', skinD = '#E0AC80', shirt = '#D98A2B', shirtD = '#A5610E', shirtL = '#F0A94E', hair = '#4A2E1E', hairL = '#7A5238';
      return `<svg viewBox="0 0 200 250" xmlns="http://www.w3.org/2000/svg">
      <!-- ผมยาวด้านหลัง -->
      <path d="M40,118 Q28,182 44,220 L60,214 Q48,172 56,124 Z" fill="${hair}" stroke="${OUT}" stroke-width="3.6"/>
      <path d="M160,118 Q172,182 156,220 L140,214 Q152,172 144,124 Z" fill="${hair}" stroke="${OUT}" stroke-width="3.6"/>
      <path d="M46,140 Q42,176 50,206 M154,140 Q158,176 150,206" stroke="${hairL}" stroke-width="2.8" fill="none" opacity=".7"/>
      <!-- ลำตัว: โปโลครูผู้สอน + เงาผ้า -->
      <path d="M26,250 L26,208 Q26,172 100,170 Q174,172 174,208 L174,250 Z" fill="${shirt}" stroke="${OUT}" stroke-width="4"/>
      <path d="M26,250 L26,208 Q26,182 50,176 L50,250 Z" fill="${shirtD}" opacity=".45"/>
      <path d="M150,178 Q170,184 172,204 L174,250 L150,250 Z" fill="${shirtL}" opacity=".35"/>
      <path d="M76,174 L100,198 L124,174 L118,168 L100,186 L82,168 Z" fill="${shirtD}" stroke="${OUT}" stroke-width="3"/>
      <!-- ตรา first aid (กากบาทขาวพื้นเขียว — ไม่ใช้ตรากาชาดซึ่งเป็นเครื่องหมายสงวน) + สายคล้องนกหวีด -->
      <rect x="126" y="192" width="22" height="22" rx="4" fill="#16A34A" stroke="${OUT}" stroke-width="2.6"/>
      <path d="M133,197 h8 v4 h4 v8 h-4 v4 h-8 v-4 h-4 v-8 h4 Z" fill="#fff" transform="translate(0,-2)"/>
      <path d="M82,172 Q70,196 74,226" stroke="#F6E7C8" stroke-width="3.4" fill="none"/>
      <ellipse cx="75" cy="231" rx="7" ry="5.6" fill="#C0C7D4" stroke="${OUT}" stroke-width="2.4"/>
      <circle cx="78" cy="231" r="1.8" fill="${OUT}"/>
      <!-- คอ -->
      <path d="M88,150 L88,178 Q100,186 112,178 L112,150 Z" fill="${skin}" stroke="${OUT}" stroke-width="3.4"/>
      <path d="M88,150 L88,164 Q100,172 112,164 L112,150 Q100,160 88,150 Z" fill="${skinD}" opacity=".5"/>
      <!-- ใบหน้า -->
      <path d="M52,100 Q52,42 100,40 Q148,42 148,100 Q148,140 128,152 Q114,161 100,161 Q86,161 72,152 Q52,140 52,100 Z" fill="${skin}" stroke="${OUT}" stroke-width="4"/>
      <!-- หู + ต่างหูฟ้า -->
      <path d="M50,104 Q44,110 50,120 Q56,122 58,114 Z" fill="${skin}" stroke="${OUT}" stroke-width="3"/>
      <path d="M150,104 Q156,110 150,120 Q144,122 142,114 Z" fill="${skin}" stroke="${OUT}" stroke-width="3"/>
      <circle cx="52" cy="122" r="2.6" fill="#6BB6E8" stroke="${OUT}" stroke-width="1.6"/>
      <circle cx="148" cy="122" r="2.6" fill="#6BB6E8" stroke="${OUT}" stroke-width="1.6"/>
      <!-- ผมหน้า: แสกกลางนุ่มๆ + ไฮไลต์ -->
      <path d="M46,112 Q40,42 100,32 Q160,42 154,112 Q152,78 136,68 Q118,84 100,62 Q82,84 64,68 Q48,78 46,112 Z" fill="${hair}" stroke="${OUT}" stroke-width="4"/>
      <path d="M72,50 Q92,38 118,44" stroke="${hairL}" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M54,90 Q56,72 68,64" stroke="${hairL}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>
      ${faceBase(skinD)}
      ${blush(pose)}
      ${brows(pose, 80, 120, 92)}
      ${eyes(pose, 80, 120, 104, '#5A3A22')}
      ${mouthGroups(pose, 100, 132)}
      ${emotionFx(pose)}
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

// URL รูปจริง (ถ้ามี) — CharacterSprite จะ probe แล้ว fallback เป็น SVG ในไฟล์นี้เอง
export function characterImageUrl(charId, pose, talking = false) {
  return `/images/characters/${charId}/${pose}${talking ? '_talk' : ''}.webp`;
}
