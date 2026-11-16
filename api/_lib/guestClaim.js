import { guestClaimItem, SESSION_ID_RE } from './stripeCheckout.js'
import { createPurchaseReceipt } from './purchaseReceipt.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// learner_id ที่จะผูกสิทธิ์การซื้อ: ของบัญชีที่ล็อกอิน หรือ (บัญชียังไม่ผูกผู้เรียน) รับผู้เรียนในเครื่องด้วยกติกาเดียวกับ
// ตอนล็อกอิน Hub (jia_firstaid_hub_adopt ปฏิเสธถ้า id นั้นเป็นของบัญชีอื่น) → learnerId | null
export async function resolvePurchaseLearner(admin, auth, candidate, log = 'checkout') {
  if (auth?.learnerId) return auth.learnerId
  const id = String(candidate || '')
  if (!auth?.userId || !UUID_RE.test(id)) return null
  const { data: adopted, error } = await admin.rpc('jia_firstaid_hub_adopt', { payload: { userId: auth.userId, learnerId: id } })
  if (error) console.error(`${log}: adopt failed`, error.message)
  return adopted?.ok && adopted.learnerId ? adopted.learnerId : null
}

// ผูกการซื้อแบบ guest (จ่ายก่อน ล็อกอินทีหลัง) กับบัญชีที่ล็อกอินอยู่ — POST /api/checkout/claim
// sessionId มาจาก cookie HttpOnly ที่ /api/checkout/return ตั้งไว้เท่านั้น; ทุกอย่างอื่นอ่านจาก Stripe ใหม่
// (จ่ายแล้ว + guest ของ firstaid + สินค้า/ยอดตรงราคาในระบบ) แล้วให้สิทธิ์ครั้งเดียวต่อ 1 การชำระเงิน
// → { status, body, clear } — clear = ลบ cookie (จบแล้ว: สำเร็จ / ไม่ใช่ของเรา / เป็นของบัญชีอื่น)
export async function claimGuestPurchase({ admin, auth, sessionId, learnerCandidate, fetchSession, receiptSecret }) {
  if (!auth) return { status: 401, body: { error: 'login_required' } }
  if (typeof sessionId !== 'string' || !SESSION_ID_RE.test(sessionId)) return { status: 404, body: { error: 'no_claim' } }

  let session
  try {
    session = await fetchSession(sessionId)
  } catch {
    return { status: 502, body: { error: 'stripe_error' } }
  }
  if (session?.id !== sessionId) return { status: 404, body: { error: 'no_claim' }, clear: true }
  const item = guestClaimItem(session)
  if (!item) return { status: 404, body: { error: 'no_claim' }, clear: true }
  if (session.payment_status !== 'paid') return { status: 200, body: { status: 'pending', chapter: item.chapter } }

  const learnerId = await resolvePurchaseLearner(admin, auth, learnerCandidate, 'checkout claim')
  if (!learnerId) return { status: 409, body: { error: 'account_not_linked' } }

  const orderRef = `stripe:${session.id}`
  const { data: owners, error: ownErr } = await admin
    .from('lesson_entitlements').select('learner_id').eq('order_ref', orderRef).limit(5)
  if (ownErr) throw ownErr
  if ((owners || []).some((r) => r.learner_id !== learnerId)) return { status: 409, body: { error: 'claimed' }, clear: true }
  if ((owners || []).length) return { status: 200, body: { status: 'paid', chapter: item.chapter }, clear: true }

  const { error } = await admin
    .from('lesson_entitlements')
    .upsert(
      { learner_id: learnerId, chapter: item.chapter, source: 'stripe', order_ref: orderRef, expires_at: null },
      { onConflict: 'learner_id,chapter' },
    )
  if (error) throw error
  // ใบวัดผลการซื้อ (ไม่มีข้อมูลบัญชี/เบอร์) — ใช้กติกาเดียวกับ confirm; ปิดอยู่ถ้าไม่ได้ตั้งคีย์ production
  const receipt = createPurchaseReceipt(session, receiptSecret)
  return { status: 200, body: { status: 'paid', chapter: item.chapter, receipt }, clear: true }
}

// ใบวัดผลการซื้อของผู้ซื้อ guest ตอนกลับจาก Stripe (ยังไม่ล็อกอิน) — POST /api/checkout/guest-receipt
// sessionId มาจาก cookie อายุสั้นที่ /api/checkout/return ตั้งไว้เท่านั้น อ่าน session จาก Stripe ใหม่แล้วออกใบด้วย
// createPurchaseReceipt (paid + live + complete + guest ของ firstaid + ยอดตรงราคา + production key) ใบไม่มีข้อมูลผู้ซื้อ
// การส่งให้ Meta/Google/OpenAI ยังผ่านหน้า /api/checkout/receipt-page ที่ถามความยินยอมเหมือนเดิมทุกอย่าง
// → { status, body: { status: 'paid', receipt|null } | { status: 'pending' } | { error }, clear }
export async function guestPurchaseReceipt({ sessionId, fetchSession, receiptSecret }) {
  if (typeof sessionId !== 'string' || !SESSION_ID_RE.test(sessionId)) return { status: 404, body: { error: 'no_receipt' } }
  let session
  try {
    session = await fetchSession(sessionId)
  } catch {
    return { status: 502, body: { error: 'stripe_error' } }
  }
  if (session?.id !== sessionId || !guestClaimItem(session)) return { status: 404, body: { error: 'no_receipt' }, clear: true }
  if (session.payment_status !== 'paid') return { status: 200, body: { status: 'pending' } }
  return { status: 200, body: { status: 'paid', receipt: createPurchaseReceipt(session, receiptSecret) }, clear: true }
}
