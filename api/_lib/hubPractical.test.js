import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPracticalPayload, recordPracticalAtHub, HUB_PRACTICAL_SKILLS, PRACTICAL_INSTRUCTOR_FALLBACK } from './hubPractical.js'
import { retryPracticalForLearner } from './issuePractical.js'
import { fakeDb } from './fakeDb.js'

const L = 'learner-1'
const U = '00000000-0000-4000-8000-000000000001'

function seed({ linked = true, status = 'approved' } = {}) {
  const db = fakeDb({
    attendance: [{ id: 'att-1', session_id: 'ses-1', learner_id: L, learner_name: 'สมชาย', status, checked_in_at: '2026-10-20T03:00:00Z' }],
    practical_sessions: [{ id: 'ses-1', title: 'รุ่น <1>', location: 'ห้อง A', starts_at: '2026-10-20T02:00:00Z', ends_at: '2026-10-20T05:00:00Z', instructor_id: 'ins-1' }],
    certificates: [{ id: 'c-t', learner_id: L, kind: 'theory' }],
    line_identities: linked ? [{ learner_id: L, auth_user_id: U }] : [],
    session_stations: [],
    station_checkins: [],
  })
  db.calls = []
  db.rpc = async (fn, args) => {
    db.calls.push({ fn, args })
    return { data: { certificate: { kind: 'practical', number: 'JIA-FIRSTAID-PRC-2026-0123456789' }, pending: null }, error: null }
  }
  db.auth.admin = { getUserById: async () => ({ data: { user: { user_metadata: { full_name: 'ครูเจีย' } } } }) }
  return db
}

test('payload: every Hub skill passed, stable attempt ref, training facts from the session', () => {
  const p = buildPracticalPayload({ userId: U, attendanceId: 'att-1', session: { title: 'รุ่น <1>', starts_at: '2026-10-20T02:00:00Z', ends_at: '2026-10-20T05:00:00Z' }, instructorName: '' })
  assert.deepEqual(Object.keys(p.skills), HUB_PRACTICAL_SKILLS)
  assert.ok(Object.values(p.skills).every((v) => v === true))
  assert.equal(p.attemptRef, 'firstaid-practical:att-1')
  assert.equal(p.sourceClient, 'firstaid')
  assert.equal(p.courseId, 'firstaid')
  assert.equal(p.instructorName, PRACTICAL_INSTRUCTOR_FALLBACK)
  assert.equal(p.sessionTitle, 'รุ่น 1')
  assert.equal(p.trainedAt, '2026-10-20T02:00:00.000Z')
  assert.equal(p.trainingHours, 3)
})

test('payload: no end time → no hours; no start → now', () => {
  const p = buildPracticalPayload({ userId: U, attendanceId: 'a', session: null, instructorName: 'ครู' })
  assert.equal(p.trainingHours, null)
  assert.ok(Math.abs(new Date(p.trainedAt) - Date.now()) < 5000)
  assert.equal(p.instructorName, 'ครู')
})

test('recordPracticalAtHub sends recordPractical for the LINE-linked account', async () => {
  const db = seed()
  const r = await recordPracticalAtHub(db, { learnerId: L, attendanceId: 'att-1' })
  assert.equal(r.recorded, true)
  assert.equal(r.certificate.kind, 'practical')
  assert.equal(db.calls.length, 1)
  assert.equal(db.calls[0].fn, 'jia_results')
  assert.equal(db.calls[0].args.action, 'recordPractical')
  assert.equal(db.calls[0].args.payload.userId, U)
  assert.equal(db.calls[0].args.payload.instructorName, 'ครูเจีย')
})

test('recordPracticalAtHub skips a learner with no account, and attendance that is not approved', async () => {
  const anon = seed({ linked: false })
  assert.deepEqual(await recordPracticalAtHub(anon, { learnerId: L, attendanceId: 'att-1' }), { skipped: 'no-account' })
  assert.equal(anon.calls.length, 0)
  const pending = seed({ status: 'pending' })
  assert.deepEqual(await recordPracticalAtHub(pending, { learnerId: L, attendanceId: 'att-1' }), { skipped: 'no-approved-attendance' })
  assert.equal(pending.calls.length, 0)
  // a token-supplied account is used even without a LINE binding (Hub SSO login)
  const r = await recordPracticalAtHub(anon, { learnerId: L, attendanceId: 'att-1', userId: U })
  assert.equal(r.recorded, true)
})

test('a Hub error never throws', async () => {
  const db = seed()
  db.rpc = async () => ({ data: null, error: { message: 'down' } })
  const r = await recordPracticalAtHub(db, { learnerId: L, attendanceId: 'att-1' })
  assert.deepEqual(r, { failed: 'down' })
})

test('issuing the practical certificate reports it to the Hub, and a retry re-sends the same attempt', async () => {
  const db = seed()
  const r = await retryPracticalForLearner(db, L)
  assert.equal(r.status, 200)
  assert.equal(r.body.hub.recorded, true)
  assert.equal(db.tables.certificates.filter((c) => c.kind === 'practical').length, 1)
  const again = await retryPracticalForLearner(db, L)
  assert.equal(again.status, 200)
  assert.equal(db.calls.length, 2)
  assert.equal(db.calls[1].args.payload.attemptRef, db.calls[0].args.payload.attemptRef)
})

test('a Hub that is down does not stop this app issuing its own practical certificate', async () => {
  const db = seed()
  db.rpc = async () => { throw new Error('network') }
  const r = await retryPracticalForLearner(db, L)
  assert.equal(r.status, 200)
  assert.equal(r.body.hub.failed, 'network')
  assert.equal(db.tables.certificates.filter((c) => c.kind === 'practical').length, 1)
})
