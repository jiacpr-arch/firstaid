import { authHeader } from './authHeader'
import { track } from './analytics'
import { useLearnerStore } from '../stores/learnerStore'

// ผู้ซื้อแบบ guest (ไม่ได้ล็อกอิน): ชื่อ 2–80 ตัว + เบอร์ไทย 0xxxxxxxx(x) — ตรงกับ parseBuyer ฝั่งเซิร์ฟเวอร์
// → { name, phone } ที่ normalize แล้ว | null
export function normalizeBuyer(name, phone) {
  const n = String(name || '').replace(/\s+/g, ' ').trim()
  const p = String(phone || '').replace(/[\s-]/g, '').replace(/^\+66/, '0')
  if (n.length < 2 || n.length > 80 || !/^0\d{8,9}$/.test(p)) return null
  return { name: n, phone: p }
}

// เปิดหน้าชำระเงิน Stripe (บัตร / PromptPay) — คืน { ok } หรือ { error }
// error: 'login_required' | 'buyer_required' | 'stripe_not_configured' | 'account_not_linked' | 'failed' (+ code)
// stripe_not_configured = ยังไม่ได้ตั้งคีย์ Stripe บนเซิร์ฟเวอร์ → หน้าเว็บโชว์ทาง LINE แทน
// buyer = { name, phone } เมื่อซื้อแบบยังไม่ล็อกอิน (จ่ายก่อน ล็อกอินทีหลัง) — ไม่ส่งเข้า analytics
export async function startCheckout(chapter, source, buyer = null) {
  track('checkout_start', { chapter, source })
  try {
    const headers = await authHeader()
    const res = await fetch('/api/checkout/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      // learnerId ของเครื่อง: ใช้เฉพาะเมื่อบัญชีที่ล็อกอินยังไม่ผูกกับผู้เรียน (เซิร์ฟเวอร์ตรวจสิทธิ์เอง)
      body: JSON.stringify({
        chapter,
        learnerId: useLearnerStore.getState().learner?.id || undefined,
        ...(buyer ? { name: buyer.name, phone: buyer.phone } : {}),
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.url) {
      window.location.href = data.url
      return { ok: true }
    }
    // เก็บสาเหตุที่เปิดหน้าจ่ายไม่สำเร็จ — ไม่งั้นเห็นแค่ checkout_start ซ้ำ ๆ โดยไม่รู้ว่าพังเพราะอะไร
    track('checkout_error', { chapter, source, status: res.status, reason: String(data.error || 'no_url').slice(0, 60) })
    // มี token แต่หมดอายุ → เซิร์ฟเวอร์มองเป็น guest แล้วขอชื่อ/เบอร์: ให้ล็อกอินใหม่แทน
    if (data.error === 'buyer_required' && headers.Authorization) return { error: 'login_required' }
    if (['login_required', 'buyer_required', 'stripe_not_configured', 'account_not_linked'].includes(data.error)) return { error: data.error }
    // code: ให้ลูกค้าแจ้งทีมงานได้ว่าพังแบบไหน (หน้า /buy ไม่ส่ง analytics)
    return { error: 'failed', code: `${res.status}${data.error ? `-${String(data.error).slice(0, 30)}` : ''}` }
  } catch {
    track('checkout_error', { chapter, source, status: 0, reason: 'network' })
    return { error: 'failed', code: 'network' }
  }
}

export async function confirmCheckout(sessionId) {
  const headers = await authHeader()
  const res = await fetch(`/api/checkout/confirm?session_id=${encodeURIComponent(sessionId)}`, { headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `confirm ${res.status}`)
  return data // { status: 'paid' | 'pending', chapter }
}

// ---- จ่ายก่อน ล็อกอินทีหลัง ----
// เครื่องนี้จ่ายแบบ guest แล้วแต่ยังไม่ได้ผูกบัญชี (เก็บแค่เลขหมวด ไม่มี session id / ชื่อ / เบอร์)
// session id อยู่ใน cookie HttpOnly ที่ /api/checkout/claim เท่านั้นที่อ่านได้
export const GUEST_PAID_KEY = 'firstaid_guest_paid_v1'

export function readGuestPaid() {
  try {
    const raw = localStorage.getItem(GUEST_PAID_KEY)
    if (raw == null) return null
    const ch = Number(raw)
    return Number.isInteger(ch) && ch >= 0 ? ch : null
  } catch { return null }
}

export function writeGuestPaid(chapter) {
  try {
    if (chapter == null) localStorage.removeItem(GUEST_PAID_KEY)
    else localStorage.setItem(GUEST_PAID_KEY, String(chapter))
  } catch { /* private mode — การ์ดชำระแล้วจะไม่จำข้าม reload แต่ cookie ยังผูกบัญชีได้ */ }
}

// ล็อกอินแล้ว → ผูกการซื้อ guest ของเบราว์เซอร์นี้กับบัญชี
// → { status: 'paid' | 'pending', chapter, receipt? } | { error: 'login_required' | 'no_claim' | 'claimed' | 'account_not_linked' | 'failed' }
export async function claimGuestCheckout() {
  try {
    const headers = await authHeader()
    const res = await fetch('/api/checkout/claim', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ learnerId: useLearnerStore.getState().learner?.id || undefined }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && (data.status === 'paid' || data.status === 'pending')) return data
    if (['login_required', 'no_claim', 'claimed', 'account_not_linked'].includes(data.error)) return { error: data.error }
    return { error: 'failed' }
  } catch {
    return { error: 'failed' }
  }
}

// ใบวัดผลการซื้อของผู้ซื้อ guest (ยังไม่ล็อกอิน) — cookie อายุ 15 นาทีจาก /api/checkout/return
// → { status: 'paid', receipt } | { status: 'pending' } | { error }
// ใบนี้ให้สิทธิ์ไม่ได้และไม่มีข้อมูลผู้ซื้อ ส่งต่อด้วย openPurchaseReceipt → หน้า receipt-page ถามความยินยอมเหมือนเดิม
export async function fetchGuestReceipt() {
  try {
    const res = await fetch('/api/checkout/guest-receipt', { method: 'POST', credentials: 'same-origin' })
    const data = await res.json().catch(() => ({}))
    if (res.ok && (data.status === 'paid' || data.status === 'pending')) return data
    return { error: data.error || 'failed' }
  } catch {
    return { error: 'failed' }
  }
}

// ส่งใบวัดผลของการซื้อ guest นี้ไปแล้ว → ตอน claim หลังล็อกอินไม่ต้องพาไปหน้า receipt ซ้ำ
const GUEST_MEASURED_KEY = 'firstaid_guest_measured_v1'
export function readGuestMeasured() {
  try { return localStorage.getItem(GUEST_MEASURED_KEY) === '1' } catch { return false }
}
export function writeGuestMeasured(on) {
  try { if (on) localStorage.setItem(GUEST_MEASURED_KEY, '1'); else localStorage.removeItem(GUEST_MEASURED_KEY) } catch { /* private mode */ }
}
// หน้า receipt-page มีลิงก์ "ไปหน้าบทเรียน" (/learn) — ผู้ซื้อ guest ที่ยังไม่ล็อกอินถูกพากลับ /buy ครั้งเดียว
// เพื่อเห็นการ์ด "ชำระเงินสำเร็จ — เข้าสู่ระบบเพื่อเริ่มเรียน"
export const GUEST_AFTER_RECEIPT_KEY = 'firstaid_guest_after_receipt'
