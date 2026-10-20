import test from 'node:test'
import assert from 'node:assert/strict'
import { createClass, findClassByInstructorCode, closeClass, buildClassList } from './classes.js'
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

test('findClassByInstructorCode returns the class and its first session', async () => {
  const db = fakeDb({}, { uniqueCols: uniq })
  const c = await createClass(db, { name: 'รุ่น 3' })
  const r = await findClassByInstructorCode(db, ` ${c.instructorCode.toLowerCase().slice(0, 4)}-${c.instructorCode.slice(4)} `)
  assert.deepEqual(r.cls, { classId: c.classId, sessionId: c.sessionId, className: 'รุ่น 3', classCode: c.classCode })
  assert.equal('instructorCode' in r.cls, false)
})

test('a student class code is told apart from a wrong code', async () => {
  const db = fakeDb({}, { uniqueCols: uniq })
  const c = await createClass(db, { name: 'รุ่น 4' })
  const asStudent = await findClassByInstructorCode(db, c.classCode)
  assert.equal(asStudent.status, 403)
  assert.match(asStudent.error, /สำหรับนักเรียน/)
  const wrong = await findClassByInstructorCode(db, 'ZZZZZZZZ')
  assert.equal(wrong.status, 403)
  assert.match(wrong.error, /ไม่ถูกต้อง/)
  assert.equal((await findClassByInstructorCode(db, '')).status, 400)
})

test('a closed class cannot be reconnected', async () => {
  const db = fakeDb({}, { uniqueCols: uniq })
  const c = await createClass(db, { name: 'รุ่น 5' })
  db.tables.cohorts[0].deleted_at = '2026-10-21T00:00:00Z'
  assert.equal((await findClassByInstructorCode(db, c.instructorCode)).status, 410)
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
