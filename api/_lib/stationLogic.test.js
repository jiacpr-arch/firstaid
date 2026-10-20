import test from 'node:test'
import assert from 'node:assert/strict'
import {
  missingPracticeStations, tallyChecklist, suggestPass, computeStationStats, buildBoardCsv,
} from './stationLogic.js'

const stations = [
  { id: 'a', name: 'CPR', kind: 'practice' },
  { id: 'b', name: 'สำลัก', kind: 'practice' },
  { id: 'x', name: 'สอบ', kind: 'exam' },
]

test('exam is blocked until every practice station is done', () => {
  assert.deepEqual(missingPracticeStations(stations, ['a']).map((s) => s.id), ['b'])
  assert.equal(missingPracticeStations(stations, ['a', 'b']).length, 0)
})

test('pass needs all critical items and the minimum percentage', () => {
  const items = [
    { no: 1, critical: true }, { no: 2, critical: false }, { no: 3, critical: false },
    { no: 4, critical: false }, { no: 5, critical: false },
  ]
  const all = tallyChecklist(items, { 1: true, 2: true, 3: true, 4: true, 5: true })
  assert.equal(suggestPass(all), true)
  const missCritical = tallyChecklist(items, { 2: true, 3: true, 4: true, 5: true })
  assert.equal(suggestPass(missCritical), false)
  const low = tallyChecklist(items, { 1: true, 2: true })
  assert.equal(suggestPass(low), false)
  assert.equal(suggestPass({ total: 0, checkedCount: 0, criticalDone: true }), false)
})

const board = {
  stations,
  rows: [
    { name: 'ก', phone: '081', checkins: { a: { checkedInAt: 't1' }, x: { checkedInAt: 't2', passed: true, score: 9 } } },
    { name: 'ข, "ทดสอบ"', phone: '', checkins: { x: { checkedInAt: 't3', passed: false, score: 4 } } },
    { name: 'ค', phone: '', checkins: { x: { checkedInAt: 't4', passed: null } } },
  ],
}

test('stats count attended, passed, failed and pending', () => {
  const exam = computeStationStats(board).find((s) => s.id === 'x')
  assert.deepEqual(
    [exam.attended, exam.passed, exam.failed, exam.pending, exam.passRate],
    [3, 1, 1, 1, 50],
  )
})

test('csv has BOM, escapes commas and quotes, and exam columns', () => {
  const csv = buildBoardCsv(board)
  assert.ok(csv.startsWith('﻿'))
  assert.ok(csv.includes('"ข, ""ทดสอบ"""'))
  assert.ok(csv.split('\n')[0].includes('สอบ — ผล'))
  assert.ok(csv.includes('ผ่าน,9'))
})
