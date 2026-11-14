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

// คอร์สอบรมภาคปฏิบัติปฐมพยาบาล (สอนสดที่ Jia Training Center) — ตรงกับ learning_hub.courses id 'firstaid'
// ใน Hub (price 99900 สตางค์) ถ้าแก้ราคาที่ Hub ต้องแก้ตรงนี้ด้วย
export const PRACTICAL_COURSE_PRICE = 999

// ข้อเสนอสำหรับผู้สอน/องค์กรที่เปิดคลาสของตัวเอง (หน้า /instructors) — ตัวเลขชุดเดียวกับ acls-emr
// (src/config/premiumPlans.js → CLASS_SEAT_PLAN) ทุกเว็บของ JIA แสดงราคาเดียวกัน แก้ที่หนึ่งต้องแก้อีกที่ด้วย
// เว็บนี้ยังไม่มีหน้าจ่ายเงินรายคลาส: ผู้สอนทัก LINE แล้วแอดมินสร้างคลาสให้ (api/classes/create.js — เฉพาะแอดมิน)
export const INSTRUCTOR_OFFER = {
  seatPrice: 129,
  // ราคาผู้ใช้รุ่นแรก — ใช้ได้ถึงก่อนเวลา foundingEndsAt (เวลาไทย)
  foundingSeatPrice: 99,
  foundingEndsAt: '2027-01-01T00:00:00+07:00',
  foundingEndsLabel: '31 ธ.ค. 2026',
  minSeats: 10,
  trialSeats: 10, // คลาสแรกของผู้สอนแต่ละคน: ทดลองฟรี
  institutionYearlyFrom: 9900,
}

export function isFoundingPriceActive(nowMs = Date.now()) {
  return nowMs < Date.parse(INSTRUCTOR_OFFER.foundingEndsAt)
}

// ราคาต่อที่นั่ง ณ เวลานั้น (บาท)
export function instructorSeatPrice(nowMs = Date.now()) {
  return isFoundingPriceActive(nowMs) ? INSTRUCTOR_OFFER.foundingSeatPrice : INSTRUCTOR_OFFER.seatPrice
}
