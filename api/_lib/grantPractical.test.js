import test from 'node:test'
import assert from 'node:assert/strict'
import { grantPractical, pickExamStation } from './grantPractical.js'
import { buildClassCertificates } from './classCertificates.js'
import { fakeDb } from './fakeDb.js'

test('pickExamStation prefers the station named สอบ, else the last exam station', () => {
  const st = [
    { id: '1', name: 'ฐาน 1: CPR', kind: 'exam', sort_order: 0 },
    { id: '2', name: 'สอบปฏิบัติ', kind: 'exam', sort_order: 6 },
    { id: '3', name: 'ฐานฝึก', kind: 'practice', sort_order: 1 },
  ]
  assert.equal(pickExamStation(st).id, '2')
  assert.equal(pickExamStation(st.filter((s) => s.id !== '2')).id, '1')
  assert.equal(pickExamStation([{ id: 'p', kind: 'practice' }]), null)
})

const enrollments = [
  { learner_id: 'came', name: 'มาอบรม' },
  { learner_id: 'came-no-theory', name: 'มาแต่ยังไม่มีใบทฤษฎี' },
  { learner_id: 'absent', name: 'ไม่มา' },
  { learner_id: 'has', name: 'มีใบแล้ว' },
]
const attendance = [
  { id: 'att-came', learner_id: 'came', session_id: 's1' },
  { id: 'att-nt', learner_id: 'came-no-theory', session_id: 's1' },
  { id: 'att-has', learner_id: 'has', session_id: 's1' },
]
const certificates = [{ learner_id: 'has', kind: 'practical', source_ref: 'att-has' }]
const load = async () => buildClassCertificates({ enrollments, certificates, attendance })

test('rows: only attendees without a practical certificate can be granted', async () => {
  const { rows, totals } = await load()
  const by = Object.fromEntries(rows.map((r) => [r.learnerId, r]))
  assert.ok(by.came._grant)
  assert.equal(by.absent._grant, null)
  assert.match(by.absent.practical.reason, /ยังไม่ได้มาอบรม/)
  assert.equal(by.has._grant, null)
  assert.equal(totals.grantable, 2)
})

test('grant records an exam pass and issues; never for someone who did not attend', async () => {
  const db = fakeDb({
    session_stations: [
      { id: 'st1', session_id: 's1', name: 'ฐาน 1', kind: 'exam', sort_order: 0 },
      { id: 'st7', session_id: 's1', name: 'สอบปฏิบัติ', kind: 'exam', sort_order: 6 },
    ],
    station_checkins: [{ id: 'old', session_id: 's1', station_id: 'st7', learner_id: 'came', passed: null }],
  })
  const issued = []
  const issue = async (_admin, attendanceId) => {
    issued.push(attendanceId)
    return attendanceId === 'att-nt' ? { status: 202, body: {} } : { status: 200, body: {} }
  }
  const out = await grantPractical(db, 'k1', ['came', 'came-no-theory', 'absent', 'has', 'stranger'],
    { id: 'u1', email: 'admin@x' }, { issue, load })

  assert.deepEqual(issued, ['att-came', 'att-nt'])
  assert.deepEqual(out.issued, ['มาอบรม'])
  assert.deepEqual(out.waitingTheory, ['มาแต่ยังไม่มีใบทฤษฎี'])
  assert.deepEqual(out.skipped.map((s) => s.reason), ['ไม่ได้มาอบรม', 'มีใบภาคปฏิบัติแล้ว', 'ไม่พบในคลาส'])

  const ck = db.tables.station_checkins
  assert.equal(ck.find((r) => r.id === 'old').passed, true) // existing check-in updated, not duplicated
  assert.match(ck.find((r) => r.id === 'old').note, /admin@x/)
  const nt = ck.find((r) => r.learner_id === 'came-no-theory')
  assert.equal(nt.station_id, 'st7')
  assert.equal(nt.passed, true)
  assert.equal(ck.some((r) => r.learner_id === 'absent'), false)
})
