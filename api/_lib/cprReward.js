// คูปองส่วนลด ฿100 คอร์ส On-site + คิวติดตามขาย สำหรับคนที่ "ซื้อ" หมวด CPR (5) หรือทั้งคอร์สใน firstaid
// แล้วสอบปลายภาค CPR ผ่าน — กติกาเดียวกับ cpr.morroo.com (issue_online_coupon / sales_tracking ของ jia-online):
// - เรียนฟรีไม่ได้คูปอง: ต้องมีสิทธิ์จากโค้ดที่ขาย (vouchers.price_thb > 0) — โค้ดคลาส/แจกฟรี (฿0) ไม่นับ
// - นักเรียนคลาสรวม CPR (จ่ายค่าคลาสแล้ว = pre_course) ไม่ออกคูปองและไม่เข้าคิวขาย
// - ออกครั้งเดียวต่อคน: เก็บโค้ดไว้ที่ online_students.coupon_code แถวของผู้เรียน (เรียกซ้ำได้โค้ดเดิม)
// ฟังก์ชันในไฟล์นี้ไม่แตะฐานข้อมูล — ตัวที่เขียนจริงอยู่ api/cpr/progress.js (action: 'reward')

export const COUPON_DISCOUNT = 100
export const COUPON_STAFF = 'firstaid-cpr' // promo_codes.staff_name — ให้ทีมรู้ว่าออกจาก firstaid

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
// รูปแบบเดียวกับ jia-online (JIA-XXXXXX) ทีมขาย/ระบบจองใช้โค้ดได้เหมือนกัน
export function genCouponCode(rand = Math.random) {
  let s = 'JIA-'
  for (let i = 0; i < 6; i += 1) s += CHARS[Math.floor(rand() * CHARS.length)]
  return s
}

export function cleanPhone(phone) {
  const d = String(phone || '').replace(/\D/g, '')
  return d.length >= 9 && d.length <= 15 ? d : null
}

// entitlements: [{ chapter, source, order_ref }] ของผู้เรียน · vouchers: [{ code, price_thb }]
// จ่ายเงินจริง = มีสิทธิ์หมวด 5 หรือทั้งคอร์สจากโค้ดที่มีราคา > 0
export function hasPaidCprEntitlement(entitlements = [], vouchers = []) {
  const price = new Map(vouchers.map((v) => [v.code, Number(v.price_thb) || 0]))
  return entitlements.some((e) => (e.chapter === 0 || e.chapter === 5) && e.source === 'voucher' && (price.get(e.order_ref) || 0) > 0)
}

// แถวคิวติดตามขาย (sales_tracking ของ jia-online — ทีมขายดูในหน้าแอดมิน cpr.morroo.com)
export function salesRow({ name, phone, score, coupon, now = new Date() }) {
  return {
    name: (name || '').trim() || 'ผู้เรียน firstaid (CPR)',
    phone,
    completed_date: now.toISOString(),
    score: Number(score) || null,
    coupon_code: coupon || '',
    follow_status: 'ยังไม่ติดต่อ',
    sales_note: 'เรียน CPR & AED จบที่ firstaid.morroo.com (ซื้อหมวด CPR)',
  }
}
