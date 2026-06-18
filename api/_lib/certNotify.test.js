import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildCertMessage, bangkokTodayStartISO } from './certNotify.js'

test('theory message includes name, phone, score and daily tally', () => {
  const msg = buildCertMessage({
    kind: 'theory',
    learnerName: 'สมหญิง ใจดี',
    learnerPhone: '0812345678',
    score: 90,
    todayCount: 5,
  })
  assert.match(msg, /ภาคทฤษฎี/)
  assert.match(msg, /สมหญิง ใจดี/)
  assert.match(msg, /0812345678/)
  assert.match(msg, /post-test: 90%/)
  assert.match(msg, /วันนี้รวม 5 คน/)
})

test('theory message omits phone line when phone is missing', () => {
  const msg = buildCertMessage({ kind: 'theory', learnerName: 'ก', score: 80 })
  assert.ok(!msg.includes('📞'))
  assert.ok(!msg.includes('วันนี้รวม')) // no todayCount → no tally line
})

test('practical message includes location, not a post-test score', () => {
  const msg = buildCertMessage({
    kind: 'practical',
    learnerName: 'สมชาย',
    location: 'ห้อง 101',
    todayCount: 2,
  })
  assert.match(msg, /ภาคปฏิบัติ/)
  assert.match(msg, /ห้อง 101/)
  assert.ok(!msg.includes('post-test'))
  assert.match(msg, /วันนี้รวม 2 คน/)
})

test('bangkokTodayStartISO is the UTC instant of 00:00 Bangkok (17:00 UTC prev day)', () => {
  // 2026-06-18T03:00:00Z = 10:00 of 18 Jun in Bangkok → day start is 17:00 UTC on 17 Jun.
  const iso = bangkokTodayStartISO(new Date('2026-06-18T03:00:00Z'))
  assert.equal(iso, '2026-06-17T17:00:00.000Z')
})

test('bangkokTodayStartISO rolls to the next Bangkok day after 17:00 UTC', () => {
  // 2026-06-18T18:00:00Z = 01:00 of 19 Jun in Bangkok → day start is 17:00 UTC on 18 Jun.
  const iso = bangkokTodayStartISO(new Date('2026-06-18T18:00:00Z'))
  assert.equal(iso, '2026-06-18T17:00:00.000Z')
})
