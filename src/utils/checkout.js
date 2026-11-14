import { authHeader } from './authHeader'
import { track } from './analytics'
import { useLearnerStore } from '../stores/learnerStore'

// เปิดหน้าชำระเงิน Stripe (บัตร / PromptPay) — คืน { ok } หรือ { error }
// error: 'login_required' | 'stripe_not_configured' | 'account_not_linked' | 'failed' (+ code)
// stripe_not_configured = ยังไม่ได้ตั้งคีย์ Stripe บนเซิร์ฟเวอร์ → หน้าเว็บโชว์ทาง LINE แทน
export async function startCheckout(chapter, source) {
  track('checkout_start', { chapter, source })
  try {
    const headers = await authHeader()
    const res = await fetch('/api/checkout/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      // learnerId ของเครื่อง: ใช้เฉพาะเมื่อบัญชีที่ล็อกอินยังไม่ผูกกับผู้เรียน (เซิร์ฟเวอร์ตรวจสิทธิ์เอง)
      body: JSON.stringify({ chapter, learnerId: useLearnerStore.getState().learner?.id || undefined }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.url) {
      window.location.href = data.url
      return { ok: true }
    }
    // เก็บสาเหตุที่เปิดหน้าจ่ายไม่สำเร็จ — ไม่งั้นเห็นแค่ checkout_start ซ้ำ ๆ โดยไม่รู้ว่าพังเพราะอะไร
    track('checkout_error', { chapter, source, status: res.status, reason: String(data.error || 'no_url').slice(0, 60) })
    if (['login_required', 'stripe_not_configured', 'account_not_linked'].includes(data.error)) return { error: data.error }
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
