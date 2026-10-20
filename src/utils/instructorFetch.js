import { adminFetch } from './adminFetch'

// รหัสผู้สอนเก็บใน sessionStorage ต่อ session (ปิดแท็บแล้วหาย) — ผู้ช่วยที่ไม่มีบัญชีแอดมิน
// ใช้รหัสนี้เรียก API ฝั่งผู้สอนผ่าน header X-Instructor-Code
const key = (sessionId) => `fa.instructorCode.${sessionId}`

export function getInstructorCode(sessionId) {
  try { return sessionStorage.getItem(key(sessionId)) || '' } catch { return '' }
}

export function setInstructorCode(sessionId, code) {
  try { sessionStorage.setItem(key(sessionId), code) } catch { /* ignore */ }
}

export function clearInstructorCode(sessionId) {
  try { sessionStorage.removeItem(key(sessionId)) } catch { /* ignore */ }
}

// ถ้ามีรหัสผู้สอนของ session นี้ใช้รหัส ไม่งั้นใช้ token แอดมิน
export function instructorFetch(sessionId, url, opts = {}) {
  const code = getInstructorCode(sessionId)
  if (!code) return adminFetch(url, opts)
  return fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'X-Instructor-Code': code, ...opts.headers },
  })
}

// เรียก API ฝั่งผู้สอนด้วยรหัสผู้สอนของคลาสที่เปิดอยู่ (หน้า /teach) — ไม่ต้องล็อกอินแอดมิน
export function classFetch(instructorCode, url, opts = {}) {
  return fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'X-Instructor-Code': instructorCode, ...opts.headers },
  })
}
