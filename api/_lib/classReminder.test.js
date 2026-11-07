import test from 'node:test'
import assert from 'node:assert/strict'
import { daysUntil, bangkokToday, planClassReminders, reminderMessage, indexIdentities } from './classReminder.js'

const NOW = new Date('2026-11-05T03:00:00Z') // 10:00 เวลาไทย

const cohort = (over = {}) => ({ id: 'c1', name: 'คลาส ม.ค.', code: 'ABC123', startsOn: '2026-11-08', includesCpr: false, cprPromoCode: null, ...over })
const ready = { learnerId: 'r', name: 'พร้อม', lessonsRead: 24, postTest: { score: 90, passed: true } }
const behind = { learnerId: 'b', name: 'สมชาย', phone: '0811111111', lessonsRead: 3, postTest: null }
const noLine = { learnerId: 'n', name: 'ไม่มีไลน์', phone: '0822222222', lessonsRead: 0 }
const ids = [{ learner_id: 'b', line_user_id: 'Ub' }, { learner_id: 'r', line_user_id: 'Ur' }]

test('daysUntil counts Bangkok calendar days', () => {
  assert.equal(bangkokToday(new Date('2026-11-05T18:00:00Z')), '2026-11-06') // 01:00 ไทยวันถัดไป
  assert.equal(daysUntil('2026-11-08', NOW), 3)
  assert.equal(daysUntil('2026-11-05', NOW), 0)
  assert.equal(daysUntil('2026-11-01', NOW), -4)
  assert.equal(daysUntil(null, NOW), null)
})

test('only not-ready learners with LINE get a message; others are reported', () => {
  const plan = planClassReminders({ summary: { cohort: cohort(), learners: [ready, behind, noLine] }, identities: ids, now: NOW })
  assert.equal(plan.ready, 1)
  assert.deepEqual(plan.toSend.map((t) => t.lineUserId), ['Ub'])
  assert.deepEqual(plan.noLine.map((p) => p.phone), ['0822222222'])
  assert.match(plan.toSend[0].text, /คุณสมชาย/)
  assert.match(plan.toSend[0].text, /อีก 3 วัน/)
  assert.match(plan.toSend[0].text, /ยังไม่ได้ทำ Post-test/)
  assert.match(plan.toSend[0].text, /\/learn/)
})

test('opted-out learners are skipped', () => {
  const plan = planClassReminders({
    summary: { cohort: cohort(), learners: [behind] },
    identities: [{ learner_id: 'b', line_user_id: 'Ub' }, { learner_id: 'b', line_user_id: 'Ub2', nurture_opted_out: true }],
    now: NOW,
  })
  assert.equal(plan.toSend.length, 0)
  assert.equal(plan.optedOut.length, 1)
})

test('manual cooldown is 12 hours; scheduled kinds send once each', () => {
  const summary = { cohort: cohort(), learners: [behind] }
  const recent = [{ learner_id: 'b', kind: 'd3', sent_at: '2026-11-05T00:00:00Z' }]
  const old = [{ learner_id: 'b', kind: 'manual', sent_at: '2026-11-04T10:00:00Z' }]
  assert.equal(planClassReminders({ summary, identities: ids, logs: recent, kind: 'manual', now: NOW }).recentlySent.length, 1)
  assert.equal(planClassReminders({ summary, identities: ids, logs: old, kind: 'manual', now: NOW }).toSend.length, 1)
  assert.equal(planClassReminders({ summary, identities: ids, logs: recent, kind: 'd3', now: NOW }).recentlySent.length, 1)
  assert.equal(planClassReminders({ summary, identities: ids, logs: recent, kind: 'd1', now: NOW }).toSend.length, 1)
})

test('blended class: first aid done but CPR not → in-app /cpr link (no other site), no /learn link', () => {
  const l = { learnerId: 'b', name: 'ก', lessonsRead: 24, postTest: { score: 80, passed: true }, cpr: { modulesDone: 2 } }
  const text = reminderMessage({
    learner: l, cohort: cohort({ includesCpr: true, cprPromoCode: 'JIA-FA-ABC123' }),
    missing: ['CPR & AED ออนไลน์ยังไม่จบ (2/7 บท)'], days: 1, appUrl: 'https://x',
  })
  assert.match(text, /พรุ่งนี้/)
  assert.match(text, /https:\/\/x\/cpr/)
  assert.doesNotMatch(text, /cpr\.morroo\.com/)
  assert.doesNotMatch(text, /https:\/\/x\/learn/)
  assert.match(text, /พิมพ์ "หยุด"/)
})

test('indexIdentities ignores incomplete rows', () => {
  const m = indexIdentities([{ learner_id: 'a' }, { line_user_id: 'U' }, { learner_id: 'a', line_user_id: 'Ua' }])
  assert.deepEqual([...m.entries()], [['a', { lineUserId: 'Ua', optedOut: false }]])
})
