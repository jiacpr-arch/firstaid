import { randomInt, timingSafeEqual } from 'node:crypto'
import { checkAdminToken } from './requireAdmin.js'
import { rateLimited } from './rateLimit.js'

// รหัสผู้สอนต่อ session (แบบ ACLS): ผู้ช่วยที่ไม่มีบัญชีแอดมินใส่รหัสนี้เพื่อสแกน QR / เช็คชื่อ /
// ให้คะแนนสถานีของ session นั้นได้ ใช้ได้เฉพาะตอน session ยังเปิด และจัดการสถานี/ออกรหัสไม่ได้
// อักษรตัดตัวที่สับสนง่าย (0/O, 1/I/L)
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 8

export function generateInstructorCode() {
  let out = ''
  for (let i = 0; i < CODE_LENGTH; i += 1) out += ALPHABET[randomInt(ALPHABET.length)]
  return out
}

export function normalizeCode(v) {
  return typeof v === 'string' ? v.trim().toUpperCase().replace(/[\s-]/g, '') : ''
}

// เทียบแบบ constant-time; รหัสว่างไม่เคยตรง
export function codesMatch(stored, given) {
  const a = Buffer.from(normalizeCode(stored))
  const b = Buffer.from(normalizeCode(given))
  if (a.length === 0 || a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

// ตรวจรหัสผู้สอนกับ session — คืน { ok:true } หรือ { status, error }
export async function verifySessionCode(admin, sessionId, code) {
  const { data: session } = await admin
    .from('practical_sessions')
    .select('id, instructor_code, closed_at')
    .eq('id', sessionId)
    .maybeSingle()
  // ข้อความเดียวกันทั้ง "ไม่พบ session" และ "รหัสผิด" เพื่อไม่ให้ไล่เดา session id
  if (!session || !codesMatch(session.instructor_code, code)) {
    return { status: 403, error: 'รหัสผู้สอนไม่ถูกต้อง' }
  }
  if (session.closed_at) return { status: 410, error: 'Session closed' }
  return { ok: true }
}

// ยืนยันตัวผู้เรียก API ฝั่งผู้สอนของ session นี้: แอดมิน (Bearer token) หรือรหัสผู้สอน
// (header X-Instructor-Code) — คืน { user, via } (user เป็น null เมื่อใช้รหัส) หรือ null
// หลังเขียน response ผิดพลาดแล้ว
export async function authorizeInstructor(req, res, admin, sessionId) {
  const adminResult = await checkAdminToken(admin, req)
  if (adminResult.user) return { user: adminResult.user, via: 'admin' }

  const code = req.headers?.['x-instructor-code']
  if (!code) {
    res.status(adminResult.status).json({ error: adminResult.error })
    return null
  }
  if (!sessionId) { res.status(400).json({ error: 'Missing sessionId' }); return null }
  // กันไล่เดารหัส (in-memory ต่อ instance — ดูหมายเหตุใน rateLimit.js)
  if (rateLimited(req, res, { key: 'instructor-code', limit: 20, windowMs: 60_000 })) return null

  const v = await verifySessionCode(admin, sessionId, code)
  if (!v.ok) { res.status(v.status).json({ error: v.error }); return null }
  return { user: null, via: 'code' }
}
