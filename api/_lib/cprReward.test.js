import test from 'node:test'
import assert from 'node:assert/strict'
import { genCouponCode, cleanPhone, hasPaidCprEntitlement, salesRow } from './cprReward.js'

test('coupon codes look like jia-online coupons (JIA-XXXXXX)', () => {
  assert.match(genCouponCode(), /^JIA-[A-HJ-NP-Z2-9]{6}$/)
})

test('cleanPhone keeps 9–15 digits only', () => {
  assert.equal(cleanPhone('081-234-5678'), '0812345678')
  assert.equal(cleanPhone('1234'), null)
  assert.equal(cleanPhone(''), null)
})

test('only paid CPR / full-course codes earn the on-site coupon', () => {
  const vouchers = [{ code: 'CPR-PAID', price_thb: 149 }, { code: 'ALL-PAID', price_thb: 249 }, { code: 'CLASS-FREE', price_thb: 0 }, { code: 'CH2', price_thb: 99 }]
  assert.equal(hasPaidCprEntitlement([{ chapter: 5, source: 'voucher', order_ref: 'CPR-PAID' }], vouchers), true)
  assert.equal(hasPaidCprEntitlement([{ chapter: 0, source: 'voucher', order_ref: 'ALL-PAID' }], vouchers), true)
  assert.equal(hasPaidCprEntitlement([{ chapter: 0, source: 'voucher', order_ref: 'CLASS-FREE' }], vouchers), false)
  assert.equal(hasPaidCprEntitlement([{ chapter: 2, source: 'voucher', order_ref: 'CH2' }], vouchers), false)
  assert.equal(hasPaidCprEntitlement([{ chapter: 5, source: 'admin_grant', order_ref: null }], vouchers), false)
})

test('sales row goes into the jia-online follow-up queue as not yet contacted', () => {
  const r = salesRow({ name: ' สมชาย ', phone: '0812345678', score: 90, coupon: 'JIA-ABC234', now: new Date('2026-11-07T00:00:00Z') })
  assert.equal(r.name, 'สมชาย')
  assert.equal(r.follow_status, 'ยังไม่ติดต่อ')
  assert.equal(r.coupon_code, 'JIA-ABC234')
  assert.equal(r.score, 90)
  assert.equal(r.completed_date, '2026-11-07T00:00:00.000Z')
})
