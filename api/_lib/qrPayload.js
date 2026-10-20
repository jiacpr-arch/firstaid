// QR ประจำตัวนักเรียน: FAQR1|<learner_id>|<ชื่อ (URI-encoded)>|<เบอร์>
// learner ของ firstaid อยู่ในเครื่องนักเรียนเท่านั้น (ไม่มีตารางฝั่งเซิร์ฟเวอร์)
// เลยต้องพกชื่อ/เบอร์ไปกับ QR ให้ครูเห็นตอนสแกน — QR แสดงบนจอของนักเรียนเอง
export const QR_PREFIX = 'FAQR1'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function encodeStudentQr({ id, name, phone }) {
  return [QR_PREFIX, id, encodeURIComponent((name || '').trim()), (phone || '').trim()].join('|')
}

// คืน { id, name, phone } หรือ null ถ้า QR ไม่ใช่ของระบบนี้/รูปแบบผิด
export function parseStudentQr(text) {
  if (typeof text !== 'string') return null
  const parts = text.trim().split('|')
  if (parts.length !== 4 || parts[0] !== QR_PREFIX) return null
  const [, id, encName, phone] = parts
  if (!UUID_RE.test(id)) return null
  let name
  try { name = decodeURIComponent(encName).trim() } catch { return null }
  if (!name || name.length > 120) return null
  if (phone.length > 30) return null
  return { id: id.toLowerCase(), name, phone: phone || null }
}
