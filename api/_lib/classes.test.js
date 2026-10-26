import test from 'node:test'
import assert from 'node:assert/strict'
import { createClass, closeClass, buildClassList } from './classes.js'
import { fakeDb } from './fakeDb.js'

const uniq = { cohorts: ['code'], practical_sessions: ['qr_token'] }

test('createClass makes a cohort and a session that share one instructor code', async () => {
  const db = fakeDb({}, { uniqueCols: uniq })
  const c = await createClass(db, { name: 'รุ่น 12', location: 'ห้อง A', now: new Date('2026-10-20T01:00:00Z') })
  assert.match(c.classCode, /^[A-Z2-9]{6}$/)
  assert.match(c.instructorCode, /^[A-Z2-9]{8}$/)
  const [cohort] = db.tables.cohorts
  const [session] = db.tables.practical_sessions
  assert.equal(cohort.instructor_id, null)
  assert.equal(cohort.created_via, 'app')
  assert.equal(cohort.instructor_code, c.instructorCode)
  assert.equal(session.instructor_code, c.instructorCode)
  assert.equal(session.cohort_id, cohort.id)
  assert.equal(session.title, 'รุ่น 12')
  assert.equal(session.location, 'ห้อง A')
  assert.equal(c.classId, cohort.id)
  assert.equal(c.sessionId, session.id)
})

test('createClass retries when a generated class code collides', async () => {
  const db = fakeDb({}, { uniqueCols: uniq })
  const first = await createClass(db, { name: 'A1' })
  let calls = 0
  const realFrom = db.from
  // force the next insert to look like a collision once by pre-seeding the same code
  db.tables.cohorts.push({ id: 'x', code: first.classCode })
  const c = await createClass({ ...db, from: (t) => { calls += 1; return realFrom(t) } }, { name: 'A2' })
  assert.notEqual(c.classCode, first.classCode)
  assert.ok(calls >= 2)
})

test('createClass rolls back the cohort if the session cannot be created', async () => {
  const db = fakeDb({}, { uniqueCols: uniq })
  const realFrom = db.from
  const broken = {
    ...db,
    from: (t) => {
      if (t !== 'practical_sessions') return realFrom(t)
      const b = realFrom(t)
      b.insert = () => ({ select: () => ({ single: async () => ({ data: null, error: { code: '42501', message: 'boom' } }) }) })
      return b
    },
  }
  await assert.rejects(() => createClass(broken, { name: 'Fail' }))
  assert.equal(db.tables.cohorts.length, 0)
})

test('closeClass closes the cohort and its sessions without deleting anything', async () => {
  const db = fakeDb({}, { uniqueCols: uniq })
  const c = await createClass(db, { name: 'รุ่น 6' })
  await closeClass(db, c.classId, new Date('2026-10-21T01:00:00Z'))
  assert.equal(db.tables.cohorts[0].deleted_at, '2026-10-21T01:00:00.000Z')
  assert.equal(db.tables.practical_sessions[0].closed_at, '2026-10-21T01:00:00.000Z')
  assert.equal(db.tables.cohorts.length, 1)
  assert.equal(db.tables.practical_sessions.length, 1)
})

test('buildClassList counts students, picks the first session and orders newest first', () => {
  const list = buildClassList({
    cohorts: [
      { id: 'a', name: 'เก่า', code: 'AAAAAA', created_at: '2026-10-01T00:00:00Z' },
      { id: 'b', name: 'ใหม่', code: 'BBBBBB', instructor_code: 'KLMN4567', created_via: 'app', created_at: '2026-10-20T00:00:00Z', deleted_at: '2026-10-21T00:00:00Z' },
    ],
    enrollments: [{ cohort_id: 'b' }, { cohort_id: 'b' }, { cohort_id: 'a' }],
    sessions: [
      { id: 's2', cohort_id: 'b', starts_at: '2026-10-22T00:00:00Z' },
      { id: 's1', cohort_id: 'b', starts_at: '2026-10-20T00:00:00Z' },
    ],
  })
  assert.deepEqual(list.map((c) => c.id), ['b', 'a'])
  assert.deepEqual(list[0], {
    id: 'b', name: 'ใหม่', code: 'BBBBBB', instructorCode: 'KLMN4567', createdVia: 'app',
    createdAt: '2026-10-20T00:00:00Z', closed: true, students: 2, sessionId: 's1',
  })
  assert.deepEqual([list[1].students, list[1].createdVia, list[1].instructorCode, list[1].sessionId], [1, 'admin', null, null])
})

test('createClass with includesCpr creates a CPR pre-course code and unlocks lessons', async () => {
  const db = fakeDb({}, { uniqueCols: uniq })
  const c = await createClass(db, {
    name: 'คลาสรวม', includesCpr: true, startsOn: '2026-11-05', seats: 24,
    now: new Date('2026-10-21T01:00:00Z'),
  })
  const [cohort] = db.tables.cohorts
  const [promo] = db.tables.lead_promo_codes
  assert.equal(c.cprPromoCode, `JIA-FA-${c.classCode}`)
  assert.equal(cohort.includes_cpr, true)
  assert.equal(cohort.unlock_lessons, true)
  assert.equal(cohort.starts_on, '2026-11-05')
  assert.equal(cohort.cpr_promo_code, c.cprPromoCode)
  assert.equal(promo.code, c.cprPromoCode)
  assert.equal(promo.source, 'pre_course')
  assert.equal(promo.multi_use, true)
  assert.equal(promo.max_uses, 29)
  assert.deepEqual(promo.unlock_modules, [1, 2, 3, 4, 5, 6, 7])
  assert.equal(promo.company, `firstaid-class:${c.cprPromoCode}`)
  assert.match(promo.code, /^[A-Z0-9][A-Z0-9-]{3,19}$/) // jia-online's own code format
})

test('createClass without includesCpr leaves CPR fields untouched', async () => {
  const db = fakeDb({}, { uniqueCols: uniq })
  const c = await createClass(db, { name: 'ปกติ' })
  assert.equal(c.cprPromoCode, null)
  assert.equal(db.tables.cohorts[0].includes_cpr, undefined)
  assert.equal((db.tables.lead_promo_codes || []).length, 0)
})

test('createClass rolls back the whole class if the CPR code cannot be created', async () => {
  const db = fakeDb({}, { uniqueCols: uniq })
  const realFrom = db.from
  const broken = {
    ...db,
    from: (t) => {
      const b = realFrom(t)
      if (t === 'lead_promo_codes') b.insert = () => Promise.resolve({ data: null, error: { code: '42501', message: 'boom' } })
      return b
    },
  }
  await assert.rejects(() => createClass(broken, { name: 'Fail CPR', includesCpr: true }))
  assert.equal(db.tables.cohorts.length, 0)
  assert.equal(db.tables.practical_sessions.length, 0)
})

test('cleanInstructorName trims, strips < >, and treats too-short as not set', async () => {
  const { cleanInstructorName } = await import('./classes.js')
  assert.equal(cleanInstructorName('  นพ.สมชาย   ใจดี '), 'นพ.สมชาย ใจดี')
  assert.equal(cleanInstructorName('<b>ครูเจีย</b>'), 'bครูเจีย/b')
  assert.equal(cleanInstructorName('x'), null)
  assert.equal(cleanInstructorName(''), null)
  assert.equal(cleanInstructorName(42), null)
  assert.equal(cleanInstructorName('ก'.repeat(150)).length, 100)
})

test('createClass stores the instructor name on the session', async () => {
  const db = fakeDb()
  await createClass(db, { name: 'รุ่น 13', instructorName: ' ครูเจีย ' })
  assert.equal(db.tables.practical_sessions[0].instructor_name, 'ครูเจีย')
  await createClass(db, { name: 'รุ่น 14' })
  assert.equal(db.tables.practical_sessions[1].instructor_name, null)
})
