import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseListQuery, searchFilter, listRow, toCsv } from './certSearch.js'

test('parseListQuery strips PostgREST syntax and wildcards', () => {
  assert.equal(parseListQuery({ q: ' สมชาย,(x)*%_ ' }).q, 'สมชาย x')
  assert.equal(parseListQuery({ q: 'a'.repeat(100) }).q.length, 60)
})

test('parseListQuery keeps only known kinds and a sane page', () => {
  assert.equal(parseListQuery({ kind: 'theory' }).kind, 'theory')
  assert.equal(parseListQuery({ kind: 'all' }).kind, null)
  assert.equal(parseListQuery({ page: '-3' }).page, 0)
  assert.equal(parseListQuery({ page: 'x' }).page, 0)
  assert.equal(parseListQuery({ page: '2' }).page, 2)
})

test('searchFilter covers name, email, code and phone', () => {
  assert.equal(searchFilter(''), null)
  const f = searchFilter('FA-AB')
  for (const col of ['learner_name', 'learner_email', 'code', 'learner_phone']) assert.match(f, new RegExp(`${col}\\.ilike\\.\\*FA-AB\\*`))
})

test('searchFilter also matches a formatted phone by its digits', () => {
  assert.match(searchFilter('081-234 5678'), /learner_phone\.ilike\.\*0812345678\*/)
  assert.equal(searchFilter('0812').split(',').length, 4)
})

test('listRow maps columns and the joined class name', () => {
  const row = listRow({ id: '1', kind: 'theory', code: 'FA-X', issued_at: 't', learner_name: 'ก', cohorts: { name: 'รุ่น 1' } })
  assert.equal(row.cohortName, 'รุ่น 1')
  assert.equal(row.revokedAt, null)
  assert.equal(row.phone, '')
})

test('toCsv writes a BOM, Thai headers and Thai-time dates', () => {
  const csv = toCsv([listRow({ id: '1', kind: 'theory', code: 'FA-X', issued_at: '2026-10-31T20:00:00Z', learner_name: 'สมชาย' })])
  assert.ok(csv.startsWith('﻿เลขใบ,ประเภท,ชื่อ'))
  assert.match(csv, /FA-X,ภาคทฤษฎี,สมชาย,,,2026-11-01,,,ใช้ได้/)
})

test('toCsv keeps a phone number\'s leading zero for Excel', () => {
  assert.match(toCsv([listRow({ kind: 'theory', code: 'C', learner_phone: '0812345678' })]), /,="0812345678",/)
})

test('toCsv quotes commas/quotes and defuses formulas but keeps phone numbers', () => {
  const csv = toCsv([listRow({ kind: 'practical', code: 'C', learner_name: '=HYPERLINK("x"), y', learner_phone: '+66 81-234 5678', revoked_at: '2026-01-02T00:00:00Z' })])
  assert.match(csv, /"'=HYPERLINK\(""x""\), y"/)
  assert.match(csv, /,\+66 81-234 5678,/)
  assert.match(csv, /เพิกถอน 2026-01-02/)
})
