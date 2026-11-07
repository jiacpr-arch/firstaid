// CPR & AED ออนไลน์ที่เรียนในเว็บนี้ (คลาสรวม CPR + ปฐมพยาบาล) — logic ล้วน ไม่แตะฐานข้อมูล
// ใช้โดย api/cpr/grade.js: ตรวจคำตอบที่ edge function grade-quiz ของ jia-online (เฉลยอยู่ที่นั่นที่เดียว)
// แล้วบันทึกผลลง online_students แถวเดียวกับที่ cpr.morroo.com ใช้ — ครู/dashboard/my-cpr
// (api/_lib/cprProgress.js) จึงเห็นความคืบหน้าแบบเดิมโดยไม่ต้องแก้ schema
import { cprCompanyTag, phoneKey } from './cprProgress.js'

export const CPR_FINAL_MODULE_ID = 7
// จำนวนข้อต่อบท — ต้องตรงกับ REQUIRED_COUNT ใน grade-quiz (jia-online)
export const CPR_REQUIRED_COUNT = { 1: 5, 2: 5, 3: 5, 4: 5, 5: 5, 6: 5, 7: 10 }
export const CPR_COMPLETED_STATUS = 'จบคอร์ส ✅'
const RENEW_MONTHS = 6 // เท่ากับ jia-online (renew_date = วันจบ + 6 เดือน)

// ตรวจรูปแบบคำขอก่อนส่งต่อ (grade-quiz ตรวจซ้ำอีกชั้น) — คืนข้อความ error หรือ null
export function validateGradeRequest({ moduleId, questions, answers }) {
  const need = CPR_REQUIRED_COUNT[moduleId]
  if (!need) return 'unknown module'
  if (!Array.isArray(questions) || !Array.isArray(answers)) return 'bad payload'
  if (questions.length !== need || answers.length !== need) return 'bad payload'
  if (![...questions, ...answers].every((n) => Number.isInteger(n) && n >= 0 && n < 100)) return 'bad payload'
  return null
}

// เลือกแถว online_students ที่จะอัปเดต: แถวที่ติดแท็กคลาสนี้ + เบอร์ตรงก่อน ไม่มีก็ null (สร้างแถวใหม่)
// ไม่แตะแถวของคนเดียวกันที่สมัครคอร์สเองบน cpr.morroo.com (แท็กอื่น) — แถวนั้นเป็นของระบบขาย
export function pickClassRow(rows = [], promoCode, phone) {
  const key = phoneKey(phone)
  if (!key) return null
  const tag = cprCompanyTag(promoCode)
  return rows.find((r) => r.company === tag && phoneKey(r.phone) === key) || null
}

// คะแนนรายบท: เก็บคะแนนที่ดีที่สุดของแต่ละบท (สอบซ้ำได้คะแนนน้อยลงไม่ทับ)
export function mergeScores(prev, moduleId, score) {
  const base = prev && typeof prev === 'object' ? { ...prev } : {}
  const old = Number(base[moduleId]) || 0
  base[moduleId] = Math.max(old, Number(score) || 0)
  return base
}

// patch/insert สำหรับ online_students หลังสอบผ่าน 1 บท — คืน null ถ้าไม่ต้องบันทึก (สอบไม่ผ่าน)
export function buildStudentWrite({ existing, enrollment, promoCode, moduleId, graded, now = new Date() }) {
  if (!graded?.passed) return null
  const chapter_scores = mergeScores(existing?.chapter_scores, moduleId, graded.score)
  const patch = { chapter_scores }
  if (moduleId === CPR_FINAL_MODULE_ID) {
    const renew = new Date(now)
    renew.setMonth(renew.getMonth() + RENEW_MONTHS)
    Object.assign(patch, {
      status: CPR_COMPLETED_STATUS,
      completed_at: existing?.completed_at || now.toISOString(),
      final_score: Math.max(Number(existing?.final_score) || 0, graded.score),
      renew_date: renew.toISOString().slice(0, 10),
    })
  }
  if (existing) return { op: 'update', id: existing.id, patch }
  return {
    op: 'insert',
    row: {
      name: (enrollment.name || '').trim() || 'นักเรียนคลาส',
      phone: String(enrollment.phone || '').replace(/\D/g, ''),
      company: cprCompanyTag(promoCode),
      // คลาสรวมจ่ายค่าคลาสแล้ว — pre_course กันคูปอง/คิวติดตามขายของ jia-online เหมือนนักเรียน pre-course
      pre_course: true,
      status: 'กำลังเรียน',
      ...patch,
    },
  }
}
