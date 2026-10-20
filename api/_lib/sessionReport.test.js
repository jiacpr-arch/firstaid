import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSessionReport, formatSessionReport } from './sessionReport.js'

const stations = [
  { id: 'p1', name: 'CPR', kind: 'practice' },
  { id: 'p2', name: 'สำลัก', kind: 'practice' },
  { id: 'x', name: 'สอบ', kind: 'exam' },
]
const attendance = [
  { learner_id: 'a', status: 'approved' }, { learner_id: 'b', status: 'approved' },
  { learner_id: 'c', status: 'pending' }, { learner_id: 'd', status: 'rejected' },
]
const stationCheckins = [
  { station_id: 'p1', learner_id: 'a' }, { station_id: 'p2', learner_id: 'a' }, { station_id: 'x', learner_id: 'a', passed: true },
  { station_id: 'p1', learner_id: 'b' }, { station_id: 'x', learner_id: 'b', passed: null },
  { station_id: 'p1', learner_id: 'c' },
  { station_id: 'p1', learner_id: 'd' }, // rejected learner — must be ignored
  { station_id: 'p1', learner_id: 'zz' }, // not in the session — must be ignored
]
const session = { title: 'รอบ 12', location: 'ห้อง A' }

test('counts attendance, stations and who has finished', () => {
  const r = buildSessionReport({ session, attendance, stations, stationCheckins, enrolled: 5, readyCount: 3, certCount: 1 })
  assert.equal(r.checkedIn, 3)
  assert.equal(r.finished, 1) // only a
  const [p1, p2, x] = r.stations
  assert.deepEqual([p1.came, p1.remaining], [3, 0])
  assert.deepEqual([p2.came, p2.remaining], [1, 2])
  assert.deepEqual([x.passed, x.failed, x.awaiting, x.notTaken, x.remaining], [1, 0, 1, 1, 2])
})

test('remaining items add up across checked-in students', () => {
  const r = buildSessionReport({ session, attendance, stations, stationCheckins })
  // a: 0 left; b: p2 + exam = 2; c: p2 + exam = 2
  assert.equal(r.remainingItems, 4)
  assert.equal(r.worst.remaining, 2)
})

test('message shows the numbers and omits student names', () => {
  const r = buildSessionReport({ session, attendance, stations, stationCheckins, enrolled: 5, readyCount: 3, certCount: 1 })
  const text = formatSessionReport(r, new Date('2026-10-20T07:30:00Z'))
  assert.match(text, /เช็คชื่อแล้ว 3 คน \(จาก 5 คนในคลาส · ยังไม่มา 2\)/)
  assert.match(text, /พร้อมเข้าอบรม \(Post-test ผ่าน\) 3\/5/)
  assert.match(text, /• สอบ: ผ่าน 1 · ไม่ผ่าน 0 · รอผล 1 · ยังไม่ได้สอบ 1/)
  assert.match(text, /ผ่านครบทุกฐาน 1 คน · ยังเหลือ 4 รายการ/)
  assert.match(text, /ออกใบเซอร์ภาคปฏิบัติแล้ว 1 ใบ/)
})

test('a session with no cohort and no stations still produces a short report', () => {
  const r = buildSessionReport({ session, attendance, certCount: 0 })
  const text = formatSessionReport(r)
  assert.match(text, /เช็คชื่อแล้ว 3 คน$/m)
  assert.ok(!text.includes('ฐาน'))
  assert.ok(!text.includes('พร้อมเข้าอบรม'))
})

test('an empty session reports zeros and finishes nobody', () => {
  const r = buildSessionReport({ session, stations })
  assert.equal(r.checkedIn, 0)
  assert.equal(r.finished, 0)
  assert.equal(r.worst, null)
})

test('the message stays under the LINE cap even with many stations', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ id: `s${i}`, name: 'ฐานที่มีชื่อยาวมาก '.repeat(10), kind: 'practice' }))
  const text = formatSessionReport(buildSessionReport({ session, attendance, stations: many }))
  assert.ok(text.length <= 4900)
})
