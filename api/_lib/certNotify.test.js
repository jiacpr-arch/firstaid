import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  bangkokDayStartISO,
  countIssuedToday,
  buildTheoryMessage,
  buildPracticalMessage,
  notifyCertIssued,
} from './certNotify.js'

// A minimal stand-in for the Supabase query builder: thenable, records the calls.
function fakeAdmin({ count = 0 } = {}) {
  const calls = {}
  const qb = {
    select(cols, opts) { calls.select = { cols, opts }; return qb },
    eq(col, val) { (calls.eq ||= {})[col] = val; return qb },
    gte(col, val) { calls.gte = { col, val }; return qb },
    then(resolve) { resolve({ count }) },
  }
  return { from(table) { calls.table = table; return qb }, _calls: calls }
}

test('bangkokDayStartISO maps an instant to the preceding Bangkok midnight (UTC+7)', () => {
  // 20:00 Bangkok on Jun 18 → midnight Jun 18 = 17:00 UTC Jun 17
  assert.equal(bangkokDayStartISO(new Date('2026-06-18T13:00:00Z')), '2026-06-17T17:00:00.000Z')
  // 23:59 Bangkok on Jun 18 → same Bangkok day
  assert.equal(bangkokDayStartISO(new Date('2026-06-18T16:59:00Z')), '2026-06-17T17:00:00.000Z')
  // 01:00 Bangkok on Jun 19 → rolls to the next Bangkok day
  assert.equal(bangkokDayStartISO(new Date('2026-06-18T18:00:00Z')), '2026-06-18T17:00:00.000Z')
})

test('countIssuedToday filters by kind + Bangkok day start and returns the count', async () => {
  const admin = fakeAdmin({ count: 3 })
  const n = await countIssuedToday(admin, 'theory', new Date('2026-06-18T13:00:00Z'))
  assert.equal(n, 3)
  assert.equal(admin._calls.table, 'certificates')
  assert.equal(admin._calls.eq.kind, 'theory')
  assert.equal(admin._calls.gte.col, 'issued_at')
  assert.equal(admin._calls.gte.val, '2026-06-17T17:00:00.000Z')
  assert.equal(admin._calls.select.opts.head, true)
})

test('countIssuedToday treats a null count as zero', async () => {
  assert.equal(await countIssuedToday(fakeAdmin({ count: null }), 'practical'), 0)
})

test('buildTheoryMessage includes contact, score, code and the daily tally', () => {
  const msg = buildTheoryMessage({
    learnerName: 'สมหญิง',
    learnerPhone: '0812345678',
    learnerEmail: 'a@b.com',
    score: 92,
    code: 'FA-ABCD2345',
    issuedAt: '2026-06-18T13:00:00Z',
    todayCount: 5,
  })
  assert.match(msg, /ทฤษฎี/)
  assert.match(msg, /สมหญิง/)
  assert.match(msg, /0812345678/)
  assert.match(msg, /92\/100/)
  assert.match(msg, /FA-ABCD2345/)
  assert.match(msg, /วันนี้ออกใบทฤษฎีแล้ว 5 ใบ/)
})

test('buildPracticalMessage shows location when present and always shows the tally', () => {
  const withLoc = buildPracticalMessage({
    learnerName: 'สมชาย',
    location: 'ศูนย์ Jia',
    code: 'FA-WXYZ2345',
    issuedAt: '2026-06-18T13:00:00Z',
    todayCount: 2,
  })
  assert.match(withLoc, /ภาคปฏิบัติ/)
  assert.match(withLoc, /ศูนย์ Jia/)
  assert.match(withLoc, /วันนี้ออกใบปฏิบัติแล้ว 2 ใบ/)
})

test('buildPracticalMessage omits the location line when there is no location', () => {
  const noLoc = buildPracticalMessage({
    learnerName: 'สมชาย',
    location: null,
    code: 'FA-WXYZ2345',
    issuedAt: '2026-06-18T13:00:00Z',
    todayCount: 1,
  })
  assert.doesNotMatch(noLoc, /📍/)
  assert.match(noLoc, /วันนี้ออกใบปฏิบัติแล้ว 1 ใบ/)
})

test('notifyCertIssued never throws — not on a no-op LINE config, not on a DB error', async () => {
  // No LINE env configured → notifyAdminLine is a silent no-op; must resolve.
  await assert.doesNotReject(
    notifyCertIssued(fakeAdmin({ count: 1 }), {
      kind: 'theory',
      learnerName: 'x',
      learnerPhone: '0',
      learnerEmail: 'x@y.z',
      score: 90,
      code: 'FA-ABCD2345',
      issuedAt: '2026-06-18T13:00:00Z',
    }),
  )
  // A throwing admin must be swallowed too.
  const throwingAdmin = { from() { throw new Error('db down') } }
  await assert.doesNotReject(
    notifyCertIssued(throwingAdmin, { kind: 'practical', learnerName: 'x', code: 'FA-ABCD2345', issuedAt: '2026-06-18T13:00:00Z' }),
  )
})
