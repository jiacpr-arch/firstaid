// ราคาปลดล็อกเรียนออนไลน์รายหมวด (Phase 1: จ่าย PromptPay/LINE มือ แล้ว redeem โค้ดที่ได้)
// หมวด 1 ฟรีถาวร — เป็นตัวล่อของ funnel โฆษณา ("เรียนฟรี") และ try-before-buy
export const FREE_CHAPTER = 1

// หมวด 5 = CPR & AED ออนไลน์ 7 บท (หน้า /cpr — ไม่ได้อยู่ใน lessons.js) ขายราคาเดียวกับหมวดอื่น
// คนในคลาสรวม CPR + ปฐมพยาบาลเรียนฟรี; ทั้งคอร์ส (chapter 0) รวมหมวดนี้ด้วย
export const CPR_CHAPTER = 5
export const CPR_CHAPTER_TITLE = 'CPR & AED ออนไลน์'

export const CHAPTER_PRICES = {
  2: 99,
  3: 99,
  4: 99,
  [CPR_CHAPTER]: 149, // เท่ากับคอร์ส CPR เต็มที่ cpr.morroo.com (PRICING.full)
}

// ปลดล็อกทั้งคอร์สทีเดียว (ทุกหมวดที่เหลือ) — ถูกกว่าซื้อแยก
export const COURSE_BUNDLE_PRICE = 249
export const COURSE_BUNDLE_CHAPTER = 0 // ใช้ chapter=0 แทน "ทั้งคอร์ส" ในตาราง entitlements/vouchers

export function isChapterUnlocked(chapter, unlockedChapters) {
  if (chapter === FREE_CHAPTER) return true
  if (!unlockedChapters) return false
  return unlockedChapters.has(chapter) || unlockedChapters.has(COURSE_BUNDLE_CHAPTER)
}
