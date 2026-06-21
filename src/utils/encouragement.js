// ข้อความให้กำลังใจตามความคืบหน้าของคอร์ส
// เป้าหมาย: ให้นักเรียนเห็นว่าเรียนไปกี่บทแล้ว และมีแรงใจเรียนต่อจนจบ
export function encourage(done, total) {
  if (total <= 0) return ''
  const remaining = total - done
  if (remaining <= 0) return 'สุดยอด! เรียนครบทุกบทแล้ว 🎉 พร้อมทำ Post-test รับใบประกาศ'
  if (done <= 0) return 'เริ่มก้าวแรกแล้ว! ค่อย ๆ เรียนไปทีละบท เดี๋ยวก็จบ 💪'

  const pct = done / total
  if (pct < 0.25) return `ไปได้สวย! เรียนจบแล้ว ${done} บท สู้ต่ออีกนิด 💪`
  if (pct < 0.5) return `เก่งมาก! ผ่านมา ${done} บทแล้ว เหลืออีก ${remaining} บทเท่านั้น`
  if (pct < 0.75) return `เกินครึ่งทางแล้ว! อีก ${remaining} บทก็จบคอร์ส ไปต่อกันเลย 🔥`
  return `ใกล้จบแล้ว! เหลืออีกแค่ ${remaining} บท อึดอีกนิดเดียว ✨`
}
