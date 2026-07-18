// FIRST AID HERO — ระบบรางวัล/เหรียญ (achievements) ฝั่ง client ล้วน
//
// เก็บบน localStorage เหมือน hiscore/cleared เดิม — ไม่มี backend
//   firstaid_game_grades : { [caseId]: { grade:'S'|'A'|'B'|'C', diff:'easy'|'normal'|'hard', fast?:boolean } }
//   firstaid_game_awards : ['first_save', ...]  รายการเหรียญที่เคยได้ (sticky — ไม่หลุดแม้คลังเปลี่ยน)
//
// เหรียญนิยามเป็น "ข้อมูล" ล้วน (check() รับ stats ที่คำนวณจาก pool/cleared/grades)
// engine เกมไม่ผูกกับตัวเลขในนี้ — เพิ่ม/แก้เหรียญได้โดยไม่แตะ logic เกม

const GRADES_KEY = 'firstaid_game_grades';
const AWARDS_KEY = 'firstaid_game_awards';

const GRADE_RANK = { S: 4, A: 3, B: 2, C: 1 };
const DIFF_RANK = { easy: 1, normal: 2, hard: 3 };

// ── เกรดที่ดีที่สุดต่อเคส ─────────────────────────────────────────────
export function readGrades() {
  try { return JSON.parse(localStorage.getItem(GRADES_KEY)) || {}; }
  catch { return {}; }
}

// บันทึกเฉพาะตอนชนะ — เก็บเกรดที่ "ดีที่สุด" (เกรดสูงกว่า หรือเกรดเท่ากันแต่โหมดยากกว่า)
// fast = เคลียร์เคสแบบไวจริง (sticky: ได้แล้วไม่หลุดแม้เล่นซ้ำแบบช้ากว่า)
// คืน map เกรดล่าสุดเพื่อให้ผู้เรียกใช้ต่อได้ทันทีโดยไม่ต้องอ่านซ้ำ
export function recordGrade(caseId, grade, diff, fast = false) {
  const grades = readGrades();
  const prev = grades[caseId];
  const better = !prev
    || GRADE_RANK[grade] > GRADE_RANK[prev.grade]
    || (GRADE_RANK[grade] === GRADE_RANK[prev.grade]
        && (DIFF_RANK[diff] || 0) > (DIFF_RANK[prev.diff] || 0));
  const stickyFast = !!(prev?.fast || fast);
  // อัปเดตเมื่อเกรดดีขึ้น หรือเพิ่งได้ fast เป็นครั้งแรก (จะได้ไม่ทับเกรดที่ดีกว่าทิ้ง)
  if (better || stickyFast !== !!prev?.fast) {
    const base = better ? { grade, diff } : { grade: prev.grade, diff: prev.diff };
    grades[caseId] = { ...base, fast: stickyFast };
    try { localStorage.setItem(GRADES_KEY, JSON.stringify(grades)); } catch { /* storage เต็ม — ข้าม */ }
  }
  return grades;
}

// ── นิยามเหรียญ ───────────────────────────────────────────────────────
// check(c) : c = stats จาก computeStats()  →  true = ปลดล็อก
export const ACHIEVEMENTS = [
  {
    id: 'first_save', icon: '🎉',
    title: 'ช่วยชีวิตสำเร็จครั้งแรก',
    desc: 'ผ่านเคสแรกจนผู้ป่วยปลอดภัย',
    check: (c) => c.clearedCount >= 1,
  },
  {
    id: 'basic_all', icon: '📗',
    title: 'แม่นพื้นฐานครบทุกหมวด',
    desc: 'ผ่านเคสระดับพื้นฐานครบทุกเคส',
    check: (c) => c.basicTotal > 0 && c.basicCleared >= c.basicTotal,
  },
  {
    id: 'hnt_hunter', icon: '🔍',
    title: 'ตาไว มองออกว่าเกิดอะไรขึ้น',
    desc: 'ผ่านเคสที่ต้องจับสัญญาณอาการซ่อนครบทุกเคส',
    check: (c) => c.hntTotal > 0 && c.hntCleared >= c.hntTotal,
  },
  {
    // level key 'megacode' คงไว้ตาม engine เดิม — เปลี่ยนแค่ป้ายเป็นภาษาคนทั่วไป
    id: 'megacode_all', icon: '🏅',
    title: 'สุดยอดฮีโร่',
    desc: 'ผ่านเคสระดับฮีโร่ครบทุกเคส',
    check: (c) => c.megaTotal > 0 && c.megaCleared >= c.megaTotal,
  },
  {
    id: 'flawless', icon: '⭐',
    title: 'ไร้ที่ติ (เกรด S)',
    desc: 'ได้เกรด S อย่างน้อยหนึ่งเคส',
    check: (c) => c.hasGradeS,
  },
  {
    id: 'hard_s', icon: '🔥',
    title: 'มือฉมังโหมดยาก',
    desc: 'ได้เกรด S ในโหมดยาก',
    check: (c) => c.hasHardS,
  },
  {
    id: 'speed_demon', icon: '⚡',
    title: 'สายฟ้า',
    desc: 'ผ่านเคสแบบตัดสินใจไวทุกจังหวะ',
    check: (c) => c.hasFastClear,
  },
  {
    id: 'all_cases', icon: '👑',
    title: 'พิชิตครบทุกเคส',
    desc: 'ผ่านทุกเคสในคลัง',
    check: (c) => c.total > 0 && c.clearedCount >= c.total,
  },
];

// ── คำนวณ stats จากสถานะผู้เล่น ───────────────────────────────────────
export function computeStats(pool, clearedIds, grades) {
  const done = (s) => clearedIds.has(s.id);
  const basics = pool.filter((s) => s.level === 'basic');
  const megas = pool.filter((s) => s.level === 'megacode');
  const hnt = pool.filter((s) => !!s.hiddenCause); // เคสที่มีอาการซ่อนให้จับสัญญาณ
  const gradeVals = Object.values(grades || {});
  return {
    total: pool.length,
    clearedCount: pool.filter(done).length,
    basicTotal: basics.length,
    basicCleared: basics.filter(done).length,
    megaTotal: megas.length,
    megaCleared: megas.filter(done).length,
    hntTotal: hnt.length,
    hntCleared: hnt.filter(done).length,
    hasGradeS: gradeVals.some((g) => g.grade === 'S'),
    hasHardS: gradeVals.some((g) => g.grade === 'S' && g.diff === 'hard'),
    hasFastClear: gradeVals.some((g) => g.fast),
  };
}

export function readAwards() {
  try { return new Set(JSON.parse(localStorage.getItem(AWARDS_KEY)) || []); }
  catch { return new Set(); }
}

// เรียกหลังจบเคส: เก็บเหรียญที่ปลดล็อกได้ตอนนี้เข้ากับของเดิม แล้วคืน "เหรียญที่เพิ่งได้"
export function syncAwards(pool, clearedIds, grades) {
  const stats = computeStats(pool, clearedIds, grades);
  const earnedNow = ACHIEVEMENTS.filter((a) => a.check(stats)).map((a) => a.id);
  const prev = readAwards();
  const fresh = earnedNow.filter((id) => !prev.has(id));
  const union = [...new Set([...prev, ...earnedNow])];
  try { localStorage.setItem(AWARDS_KEY, JSON.stringify(union)); } catch { /* storage เต็ม — ข้าม */ }
  return { fresh, earned: new Set(union) };
}

// เหรียญที่ "มีทางปลดในคลังปัจจุบัน" — เช่นยังไม่มีเคสอาการซ่อน ก็ไม่ต้องโชว์เหรียญนักสืบ
// ค้างเป็น 🔒 ตลอดกาล (แต่ถ้าเคยได้แบบ sticky แล้ว ยังโชว์)
function isApplicable(a, stats) {
  if (a.id === 'hnt_hunter') return stats.hntTotal > 0;
  if (a.id === 'megacode_all') return stats.megaTotal > 0;
  return true;
}

// รายการเหรียญพร้อมสถานะปลดล็อก (live check หรือเคยได้ sticky) — ใช้ในหน้ารางวัล
export function listWithEarned(pool, clearedIds, grades) {
  const stats = computeStats(pool, clearedIds, grades);
  const sticky = readAwards();
  return ACHIEVEMENTS
    .filter((a) => isApplicable(a, stats) || sticky.has(a.id))
    .map((a) => ({ ...a, earned: a.check(stats) || sticky.has(a.id) }));
}
