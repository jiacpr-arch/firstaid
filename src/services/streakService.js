// สตรีคเข้าเรียนรายเครื่อง (ไม่ผูกบัญชี) เก็บใน localStorage
//   - เข้าเมื่อวาน → นับต่อ +1
//   - เข้าวันนี้แล้ว → คงเดิม
//   - ขาดเกิน 1 วัน หรือไม่เคยเข้า → เริ่มนับ 1 ใหม่

const KEY = 'firstaid.visitStreak'

function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysBetween(a, b) {
  // a, b เป็นสตริง YYYY-MM-DD ตามเวลาท้องถิ่น
  const da = new Date(a + 'T00:00:00')
  const db = new Date(b + 'T00:00:00')
  return Math.round((db - da) / (1000 * 60 * 60 * 24))
}

export function getStreak() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { count: 0, lastVisit: null, best: 0 }
    const parsed = JSON.parse(raw)
    return {
      count: parsed.count || 0,
      lastVisit: parsed.lastVisit || null,
      best: parsed.best || parsed.count || 0,
    }
  } catch {
    return { count: 0, lastVisit: null, best: 0 }
  }
}

// เรียกครั้งเดียวตอน mount หน้าแรก คืนค่าสตรีคล่าสุด
export function recordVisitToday() {
  const today = todayLocal()
  const prev = getStreak()

  let next
  if (!prev.lastVisit) {
    next = { count: 1, lastVisit: today, best: Math.max(1, prev.best) }
  } else if (prev.lastVisit === today) {
    return prev
  } else {
    const gap = daysBetween(prev.lastVisit, today)
    const count = gap === 1 ? prev.count + 1 : 1
    next = { count, lastVisit: today, best: Math.max(count, prev.best) }
  }

  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // localStorage ใช้ไม่ได้ก็ยังคืนค่าให้ UI แสดงได้
  }
  return next
}
