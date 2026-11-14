import { lessons } from '../../src/courses/firstaid/lessons.js'
import { FREE_CHAPTER, COURSE_BUNDLE_PRICE } from '../../src/config/pricing.js'

// แคมเปญ nurture "buy_nudge": ชวนซื้อคอร์สทาง LINE ครั้งเดียวต่อคน
// ส่งให้คนที่เรียนหมวดฟรีครบแล้ว ≥ 1 วัน แต่ยังไม่ได้ซื้ออะไรเลย และไม่ได้อยู่ในคลาส (คลาสเรียนฟรีอยู่แล้ว)
export const BUY_NUDGE = 'buy_nudge'
export const BUY_NUDGE_AFTER_DAYS = 1
export const FREE_LESSON_IDS = lessons.filter((l) => l.chapter === FREE_CHAPTER).map((l) => l.id)

export function buyNudgeEligible({ lessonsRead, lastReadAt, purchased, enrolled, alreadySent, now = Date.now() }) {
  if (alreadySent || purchased || enrolled) return false
  if (!FREE_LESSON_IDS.every((id) => lessonsRead.has(id))) return false
  if (!lastReadAt) return false
  return new Date(lastReadAt).getTime() <= now - BUY_NUDGE_AFTER_DAYS * 24 * 60 * 60 * 1000
}

export function buyNudgeMessage(appUrl) {
  return (
    '🎓 เรียนหมวดแรกจบแล้ว เก่งมาก!\n\n' +
    'เหลืออีก 3 หมวดก็สอบรับใบประกาศได้เลย\n' +
    '• เจ็บป่วยฉุกเฉิน — เจ็บหน้าอก, หลอดเลือดสมอง, ชัก, เป็นลม\n' +
    '• บาดเจ็บฉุกเฉิน — เลือดออก, กระดูกหัก, แผลไหม้\n' +
    '• อุบัติเหตุรอบตัวและสารเคมี\n' +
    '+ CPR & AED ออนไลน์\n\n' +
    `ปลดล็อกทั้งคอร์ส ฿${COURSE_BUNDLE_PRICE} จ่ายครั้งเดียว เรียนได้ไม่จำกัดเวลา\n` +
    '(บัตร หรือ PromptPay ปลดล็อกทันที)\n\n' +
    `👉 ${appUrl}/buy`
  )
}
