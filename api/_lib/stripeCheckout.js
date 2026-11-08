import crypto from 'node:crypto'
import { CHAPTER_PRICES, COURSE_BUNDLE_PRICE, COURSE_BUNDLE_CHAPTER, CPR_CHAPTER_TITLE, CPR_CHAPTER } from '../../src/config/pricing.js'

// ชำระเงินออนไลน์ผ่าน Stripe Checkout (บัตร + PromptPay) — ปลดล็อกหมวดทันทีหลังจ่าย
// ไม่ต้องรอแอดมินส่งโค้ดทาง LINE แบบเดิม (LINE + โค้ดยังใช้ได้เป็นทางสำรอง)
//
// ราคาอ่านจาก src/config/pricing.js ที่เดียวกับหน้าเว็บ — ห้ามรับราคาจาก client
// สิทธิ์ให้ 2 ทาง (ทางไหนถึงก่อนก็ได้ ทำซ้ำได้ไม่พัง เพราะ upsert ด้วย learner_id+chapter):
//   • webhook  api/checkout/webhook.js (checkout.session.completed / async_payment_succeeded)
//   • confirm  api/checkout/confirm.js (หน้า /buy?session_id=… ถาม Stripe เองตอนลูกค้ากลับมา)
//
// env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SITE_URL (ไม่ตั้ง = https://firstaid.morroo.com)

const CHAPTER_TITLES = {
  2: 'เจ็บป่วยฉุกเฉิน',
  3: 'บาดเจ็บฉุกเฉิน',
  4: 'อุบัติเหตุรอบตัวและสารเคมี',
  [CPR_CHAPTER]: CPR_CHAPTER_TITLE,
}

// สินค้าที่ขายได้: chapter 0 = ทั้งคอร์ส, 2–5 = รายหมวด (หมวด 1 ฟรี)
export function checkoutItem(chapter) {
  const ch = Number(chapter)
  if (!Number.isInteger(ch)) return null
  if (ch === COURSE_BUNDLE_CHAPTER) {
    return { chapter: ch, price: COURSE_BUNDLE_PRICE, name: 'FirstAid ออนไลน์ — ปลดล็อกทั้งคอร์ส (หมวด 2–5 รวม CPR & AED)' }
  }
  const price = CHAPTER_PRICES[ch]
  if (!price) return null
  return { chapter: ch, price, name: `FirstAid ออนไลน์ — หมวด ${ch}: ${CHAPTER_TITLES[ch] || ''}`.trim() }
}

export function siteUrl() {
  return (process.env.SITE_URL || 'https://firstaid.morroo.com').replace(/\/$/, '')
}

export function isStripeConfigured() {
  return !!process.env.STRIPE_SECRET_KEY
}

// พารามิเตอร์ form-encoded สำหรับ POST /v1/checkout/sessions
export function sessionParams({ item, learnerId, userId, base = siteUrl() }) {
  const p = new URLSearchParams()
  p.set('mode', 'payment')
  p.append('payment_method_types[]', 'card')
  p.append('payment_method_types[]', 'promptpay')
  p.set('line_items[0][quantity]', '1')
  p.set('line_items[0][price_data][currency]', 'thb')
  p.set('line_items[0][price_data][unit_amount]', String(item.price * 100)) // สตางค์
  p.set('line_items[0][price_data][product_data][name]', item.name)
  p.set('client_reference_id', learnerId)
  p.set('metadata[learner_id]', learnerId)
  p.set('metadata[chapter]', String(item.chapter))
  p.set('metadata[app]', 'firstaid')
  if (userId) p.set('metadata[user_id]', userId)
  p.set('locale', 'th')
  p.set('success_url', `${base}/buy?session_id={CHECKOUT_SESSION_ID}`)
  p.set('cancel_url', `${base}/buy?cancelled=${item.chapter}`)
  return p
}

export async function stripeApi(path, body) {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) throw new Error('stripe_not_configured')
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${secret}`,
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body,
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    console.error('stripe api error', path, r.status, data?.error?.message)
    throw new Error('stripe_error')
  }
  return data
}

// ตรวจลายเซ็น webhook ตามสเปก Stripe: header "t=<ts>,v1=<sig>[,v1=…]", HMAC-SHA256 ของ "<ts>.<raw body>"
export function verifyStripeSignature(rawBody, header, secret, { toleranceSec = 300, nowSec = Math.floor(Date.now() / 1000) } = {}) {
  if (!header || !secret) return false
  const parts = header.split(',').map((s) => s.trim().split('='))
  const ts = parts.find(([k]) => k === 't')?.[1]
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v)
  if (!ts || !sigs.length) return false
  if (Math.abs(nowSec - Number(ts)) > toleranceSec) return false
  const expected = crypto.createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex')
  const exp = Buffer.from(expected, 'hex')
  return sigs.some((s) => {
    const got = Buffer.from(s, 'hex')
    return got.length === exp.length && crypto.timingSafeEqual(got, exp)
  })
}

// session จาก Stripe ที่จ่ายเสร็จแล้ว → { learnerId, chapter } หรือ null (ยังไม่จ่าย/ไม่ใช่ของแอปนี้/ยอดไม่ตรง)
export function paidGrant(session) {
  if (!session || session.payment_status !== 'paid') return null
  const md = session.metadata || {}
  if (md.app !== 'firstaid' || !md.learner_id) return null
  const item = checkoutItem(md.chapter)
  if (!item) return null
  // กันแก้ราคา: ยอดที่จ่ายต้องไม่น้อยกว่าราคาในระบบ (สกุล THB)
  if (session.currency && session.currency !== 'thb') return null
  if (typeof session.amount_total === 'number' && session.amount_total < item.price * 100) return null
  return { learnerId: md.learner_id, chapter: item.chapter }
}

// ให้สิทธิ์ถาวร (expires_at = null) — upsert จึงเรียกซ้ำได้ (webhook + confirm)
export async function grantPaidSession(admin, session) {
  const grant = paidGrant(session)
  if (!grant) return null
  const { error } = await admin
    .from('lesson_entitlements')
    .upsert(
      { learner_id: grant.learnerId, chapter: grant.chapter, source: 'stripe', order_ref: `stripe:${session.id}`, expires_at: null },
      { onConflict: 'learner_id,chapter' },
    )
  if (error) throw error
  return grant
}
