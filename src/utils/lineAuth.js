// LINE Login (web OAuth 2.1) — what's left of this app's own LINE login.
//
// "เข้าสู่ระบบด้วย LINE" now goes through the Hub (utils/hubAuth.js, login_hint=line) like every JIA
// app, so a learner has one JIA account everywhere. Kept here: isLineLoginConfigured (still gates the
// mandatory login after lesson 1) and the callback state helpers, so a LINE login already in flight
// when this changed — or an old /auth/line/callback link — still finishes (pages/LineCallback.jsx).

const SS_KEY = 'firstaid.lineAuth'

export const isLineLoginConfigured = !!(import.meta.env.VITE_LINE_LOGIN_CHANNEL_ID || '')

// เก็บ state/nonce ใน cookie ด้วย (ไม่ใช่แค่ sessionStorage) เพราะใน LINE in-app browser
// การ redirect กลับจาก access.line.me มักสร้าง browsing context ใหม่ทำให้ sessionStorage หาย
// cookie อยู่รอดข้าม context บน domain เดียวกัน; SameSite=Lax อ่านได้บน top-level GET redirect
function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function deleteCookie(name) {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`
}

export function readLineAuthState() {
  try {
    // cookie ก่อน (รอดใน IAB), ถ้าไม่มี fallback ไป sessionStorage
    return JSON.parse(getCookie(SS_KEY) || sessionStorage.getItem(SS_KEY) || 'null')
  } catch {
    return null
  }
}

export function clearLineAuthState() {
  sessionStorage.removeItem(SS_KEY)
  deleteCookie(SS_KEY)
}
