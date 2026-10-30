// จำว่าคลาสไหนออกรายงานประจำรุ่นไปแล้วเมื่อไร (ต่อเครื่อง) — ไว้เตือนผู้สอนบนหน้า /admin/teach
const KEY = 'fa.cohortReportLog'

const read = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {} } catch { return {} }
}

export const lastReportAt = (classId) => (classId ? read()[classId] || null : null)

export function markReportPrinted(classId) {
  if (!classId) return
  try { localStorage.setItem(KEY, JSON.stringify({ ...read(), [classId]: new Date().toISOString() })) } catch { /* ignore */ }
}
