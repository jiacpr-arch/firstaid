import test from 'node:test'
import assert from 'node:assert/strict'
import { buyNudgeEligible, buyNudgeMessage, FREE_LESSON_IDS } from './nurtureBuyNudge.js'

const now = Date.parse('2026-11-14T03:00:00Z')
const twoDaysAgo = '2026-11-12T03:00:00Z'
const base = { lessonsRead: new Set(FREE_LESSON_IDS), lastReadAt: twoDaysAgo, purchased: false, enrolled: false, alreadySent: false, now }

test('เรียนหมวดฟรีครบ ≥ 1 วัน ยังไม่ซื้อ ไม่อยู่คลาส → ส่ง', () => {
  assert.equal(buyNudgeEligible(base), true)
})

test('ไม่ส่งซ้ำ / ไม่ส่งให้คนซื้อแล้ว / ไม่ส่งให้นักเรียนคลาส', () => {
  assert.equal(buyNudgeEligible({ ...base, alreadySent: true }), false)
  assert.equal(buyNudgeEligible({ ...base, purchased: true }), false)
  assert.equal(buyNudgeEligible({ ...base, enrolled: true }), false)
})

test('ยังเรียนหมวดฟรีไม่ครบ หรือเพิ่งเรียนจบไม่ถึง 1 วัน → ยังไม่ส่ง', () => {
  assert.equal(buyNudgeEligible({ ...base, lessonsRead: new Set(FREE_LESSON_IDS.slice(1)) }), false)
  assert.equal(buyNudgeEligible({ ...base, lastReadAt: '2026-11-13T12:00:00Z' }), false)
  assert.equal(buyNudgeEligible({ ...base, lastReadAt: null }), false)
})

test('ข้อความมีราคาและลิงก์หน้าซื้อ', () => {
  const msg = buyNudgeMessage('https://firstaid.morroo.com')
  assert.match(msg, /฿249/)
  assert.match(msg, /https:\/\/firstaid\.morroo\.com\/buy/)
})
