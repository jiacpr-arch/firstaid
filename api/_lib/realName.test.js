import { test } from 'node:test'
import assert from 'node:assert/strict'
import { realNameProblem, prefillRealName, isLineName } from './realName.js'

test('ชื่อจริงภาษาไทยผ่าน', () => {
  assert.equal(realNameProblem('กุลวัฒน์ นุ่มน้อย'), '')
  assert.equal(realNameProblem('นาย สรายุทธ์ รัตน์สถิตย์'), '')
  assert.equal(realNameProblem('Parichat Kaewsombat'), '')
})

test('ชื่อ LINE / ชื่อเล่นไม่ผ่าน', () => {
  assert.notEqual(realNameProblem('Kulawat💰'), '')
  assert.notEqual(realNameProblem('𝕬𝖈𝖈𝖔𝖑𝖆𝖊𝖉'), '')
  assert.notEqual(realNameProblem('P𝕃O𝕐L𝕐🔥🌈'), '')
  assert.notEqual(realNameProblem('FAH👉chadchadaphon'), '')
  assert.notEqual(realNameProblem('Prad'), '')
  assert.notEqual(realNameProblem('wallop_ball'), '')
  assert.notEqual(realNameProblem(''), '')
})

test('ชื่อที่ตรงกับชื่อ LINE ไม่ผ่านแม้มีเว้นวรรค', () => {
  assert.notEqual(realNameProblem('CHAYANAN (AOF)', { lineName: 'CHAYANAN (AOF)' }), '')
  assert.equal(isLineName(' chayanan  (aof) ', 'CHAYANAN (AOF)'), true)
  assert.equal(realNameProblem('ชยานันต์ ใจทับทิม', { lineName: 'CHAYANAN (AOF)' }), '')
})

test('prefill เว้นว่างเมื่อเป็นชื่อ LINE', () => {
  assert.equal(prefillRealName('Kulawat💰'), '')
  assert.equal(prefillRealName('Sarayut', { lineName: 'Sarayut' }), '')
  assert.equal(prefillRealName('ศศิธร แพงไทย', { lineName: 'Jaa2023' }), 'ศศิธร แพงไทย')
  assert.equal(prefillRealName(null), '')
})

test('needsRealName: ถามเฉพาะคนที่ยังไม่ยืนยันและชื่อยังไม่ใช่ชื่อจริง', async () => {
  const { needsRealName } = await import('./realName.js')
  assert.equal(needsRealName({ name: 'Kulawat💰' }), true)
  assert.equal(needsRealName({ name: '' }), true)
  assert.equal(needsRealName({ name: 'Somchai Jaidee', lineName: 'Somchai Jaidee' }), true)
  assert.equal(needsRealName({ name: 'Somchai Jaidee', lineName: 'Somchai Jaidee', realNameAt: '2026-11-01' }), false)
  assert.equal(needsRealName({ name: 'กุลวัฒน์ นุ่มน้อย' }), false)
  assert.equal(needsRealName(null), false)
})
