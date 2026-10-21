import test from 'node:test'
import assert from 'node:assert/strict'
import { retryPracticalForLearner } from './issuePractical.js'
import { fakeDb } from './fakeDb.js'

const L = 'learner-1'

function seed({ stations = [], checkins = [], theory = true } = {}) {
  return fakeDb({
    attendance: [{ id: 'att-1', session_id: 'ses-1', learner_id: L, learner_name: 'สมชาย', status: 'approved', checked_in_at: '2026-10-20T03:00:00Z' }],
    practical_sessions: [{ id: 'ses-1', title: 'คลาส', location: 'ห้อง A' }],
    certificates: theory ? [{ id: 'c-t', learner_id: L, kind: 'theory' }] : [],
    session_stations: stations,
    station_checkins: checkins,
  })
}

const practical = (db) => db.tables.certificates.filter((c) => c.kind === 'practical')

test('no stations: approved attendance is enough once the theory cert exists', async () => {
  const db = seed()
  const r = await retryPracticalForLearner(db, L)
  assert.equal(r.status, 200)
  assert.equal(practical(db).length, 1)
})

test('session with an exam station: no cert until the exam was passed', async () => {
  const stations = [{ id: 'p1', session_id: 'ses-1', kind: 'practice' }, { id: 'x1', session_id: 'ses-1', kind: 'exam' }]
  const db = seed({ stations, checkins: [{ session_id: 'ses-1', station_id: 'x1', learner_id: L, passed: false }] })
  assert.equal(await retryPracticalForLearner(db, L), null)
  assert.equal(practical(db).length, 0)

  db.tables.station_checkins[0].passed = true
  const r = await retryPracticalForLearner(db, L)
  assert.equal(r.status, 200)
  assert.equal(practical(db).length, 1)
})

test('session with practice stations only never issues (no exam to decide)', async () => {
  const db = seed({ stations: [{ id: 'p1', session_id: 'ses-1', kind: 'practice' }] })
  assert.equal(await retryPracticalForLearner(db, L), null)
})

test('learner without approved attendance gets nothing', async () => {
  const db = seed()
  db.tables.attendance[0].status = 'pending'
  assert.equal(await retryPracticalForLearner(db, L), null)
})
