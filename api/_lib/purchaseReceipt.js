import crypto from 'node:crypto'
import { paidGrant } from './stripeCheckout.js'

const PURPOSE = 'firstaid-purchase-measurement-v1'
const AUDIENCE = 'https://firstaid.morroo.com/api/checkout/receipt'
export const RECEIPT_TTL_SECONDS = 15 * 60
const EVENT_RE = /^fa_purchase_[a-f0-9]{64}$/

// This receipt cannot grant access or authorize payment. It contains no account,
// learner, chapter, raw Stripe ID, email, click ID or matching data.
function signingKey(secret) {
  return crypto.hkdfSync('sha256', secret, PURPOSE, AUDIENCE + ':production', 32)
}

const configured = secret => typeof secret === 'string' && secret.length >= 32 && secret.length <= 256

export function createPurchaseReceipt(session, secret, { now = Math.floor(Date.now() / 1000), environment = process.env.VERCEL_ENV } = {}) {
  if (environment !== 'production' || !configured(secret) || !paidGrant(session) || session.livemode !== true || session.mode !== 'payment' || session.status !== 'complete'
    || session.currency !== 'thb' || !Number.isSafeInteger(session.amount_total) || session.amount_total <= 0
    || !/^cs_[A-Za-z0-9_]{10,200}$/.test(session.id || '')) return null
  const payload = {
    eventId: 'fa_purchase_' + crypto.createHash('sha256').update(PURPOSE + ':' + session.id).digest('hex'),
    value: session.amount_total / 100, currency: 'THB', expiresAt: now + RECEIPT_TTL_SECONDS,
    audience: AUDIENCE, environment: 'production',
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  // Domain separation prevents this MAC from being a Stripe/webhook signature.
  const signature = crypto.createHmac('sha256', signingKey(secret)).update(PURPOSE + '.' + encoded).digest('base64url')
  return encoded + '.' + signature
}

export function verifyPurchaseReceipt(token, secret, { now = Math.floor(Date.now() / 1000), environment = process.env.VERCEL_ENV } = {}) {
  if (environment !== 'production' || !configured(secret) || typeof token !== 'string' || token.length > 1024) return null
  const parts = token.split('.')
  if (parts.length !== 2 || !parts.every(part => /^[A-Za-z0-9_-]+$/.test(part))) return null
  const [encoded, signature] = parts
  const expected = crypto.createHmac('sha256', signingKey(secret)).update(PURPOSE + '.' + encoded).digest()
  const actual = Buffer.from(signature, 'base64url')
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null
  try {
    const p = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
    if (Object.keys(p).sort().join(',') !== 'audience,currency,environment,eventId,expiresAt,value'
      || p.audience !== AUDIENCE || p.environment !== 'production'
      || !EVENT_RE.test(p.eventId) || p.currency !== 'THB' || !Number.isFinite(p.value) || p.value <= 0
      || !Number.isSafeInteger(p.expiresAt) || p.expiresAt <= now || p.expiresAt > now + RECEIPT_TTL_SECONDS) return null
    return { eventId: p.eventId, value: p.value, currency: 'THB', expiresAt: p.expiresAt }
  } catch { return null }
}
