import { authHeader } from './authHeader'
import { track } from './analytics'

// เปิดหน้าชำระเงิน Stripe (บัตร / PromptPay) — คืน { ok } หรือ { error }
// error: 'login_required' | 'stripe_not_configured' | 'failed'
// stripe_not_configured = ยังไม่ได้ตั้งคีย์ Stripe บนเซิร์ฟเวอร์ → หน้าเว็บโชว์ทาง LINE แทน
export async function startCheckout(chapter, source) {
  track('checkout_start', { chapter, source })
  try {
    const headers = await authHeader()
    const res = await fetch('/api/checkout/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ chapter }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.url) {
      window.location.href = data.url
      return { ok: true }
    }
    // เก็บสาเหตุที่เปิดหน้าจ่ายไม่สำเร็จ — ไม่งั้นเห็นแค่ checkout_start ซ้ำ ๆ โดยไม่รู้ว่าพังเพราะอะไร
    track('checkout_error', { chapter, source, status: res.status, reason: String(data.error || 'no_url').slice(0, 60) })
    if (data.error === 'login_required' || data.error === 'stripe_not_configured') return { error: data.error }
    return { error: 'failed' }
  } catch {
    track('checkout_error', { chapter, source, status: 0, reason: 'network' })
    return { error: 'failed' }
  }
}

export async function confirmCheckout(sessionId) {
  const headers = await authHeader()
  const res = await fetch(`/api/checkout/confirm?session_id=${encodeURIComponent(sessionId)}`, { headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `confirm ${res.status}`)
  return data // { status: 'paid' | 'pending', chapter }
}
