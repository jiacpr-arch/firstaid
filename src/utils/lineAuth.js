// LINE Login (web OAuth 2.1) — client helpers.
//
// We do a full-window redirect (not a popup) because popups/window.opener are
// unreliable inside the LINE in-app browser and in standalone PWA display mode.
// state + nonce are stored in sessionStorage and checked on return; learnerId is
// carried so the callback can link the anonymous learner to the new account.

const AUTHORIZE_URL = 'https://access.line.me/oauth2/v2.1/authorize'
const SS_KEY = 'firstaid.lineAuth'
// อายุพอสำหรับรอบล็อกอินเดียว (30 นาที) — เผื่อผู้ใช้ค้างที่หน้า LINE/สลับแอปนานใน
// in-app browser ของ FB/IG ก่อน redirect กลับ ไม่งั้น state หายแล้วเจอ error "ยืนยันไม่ถูกต้อง"
const COOKIE_MAX_AGE = 1800

export const LINE_CHANNEL_ID = import.meta.env.VITE_LINE_LOGIN_CHANNEL_ID || ''
export const isLineLoginConfigured = !!LINE_CHANNEL_ID

export const lineCallbackUri = () => `${window.location.origin}/auth/line/callback`

// เก็บ state/nonce ใน cookie ด้วย (ไม่ใช่แค่ sessionStorage) เพราะใน LINE in-app browser
// การ redirect กลับจาก access.line.me มักสร้าง browsing context ใหม่ทำให้ sessionStorage หาย
// cookie อยู่รอดข้าม context บน domain เดียวกัน; SameSite=Lax อ่านได้บน top-level GET redirect
function setCookie(name, value, maxAgeSec) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSec}; SameSite=Lax${secure}`
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function deleteCookie(name) {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`
}

function randomToken() {
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
}

// Kick off the LINE login redirect. bot_prompt=aggressive + the OA @jiacpr linked to
// the Login channel makes LINE show the "add friend" step, so login auto-adds the OA.
export function startLineLogin(learnerId) {
  const state = randomToken()
  const nonce = randomToken()
  const redirectUri = lineCallbackUri()
  const payload = JSON.stringify({ state, nonce, learnerId, redirectUri })
  sessionStorage.setItem(SS_KEY, payload)
  setCookie(SS_KEY, payload, COOKIE_MAX_AGE)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: LINE_CHANNEL_ID,
    redirect_uri: redirectUri,
    state,
    nonce,
    // `email` requires LINE review — ship with profile+openid and add email later.
    scope: 'profile openid',
    bot_prompt: 'aggressive',
  })
  window.location.assign(`${AUTHORIZE_URL}?${params.toString()}`)
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
