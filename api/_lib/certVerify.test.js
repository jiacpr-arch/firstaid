import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseVerifyQuery, visibleCertificate, namesMatch, normalizeName } from './certVerify.js'
import { generateCertCode } from './certCode.js'

const fa = { code: 'FA-7KQ2MZ9P', kind: 'theory', learner_name: 'นางสาว สมหญิง ใจดี', issued_at: '2026-06-20', location: null }
const bcpr = { code: 'BCPR-2026-0007', kind: 'B-CPR', learner_name: 'สมปอง ดีใจ', issued_at: '2026-08-12', location: 'JIA Training Center' }

test('random FA- codes verify on the code alone', () => {
  const q = parseVerifyQuery({ code: ' fa-7kq2mz9p ' })
  assert.deepEqual(q, { code: 'FA-7KQ2MZ9P', name: '', needsName: false })
  assert.equal(visibleCertificate(fa, q), fa)
  assert.equal(parseVerifyQuery({ code: generateCertCode() }).needsName, false, 'every minted code counts as random')
})

test('sequential BCPR numbers need the printed name; a wrong or missing name looks like a missing code', () => {
  const none = parseVerifyQuery({ code: 'BCPR-2026-0007' })
  assert.equal(none.needsName, true)
  assert.equal(visibleCertificate(bcpr, none), null)
  assert.equal(visibleCertificate(bcpr, parseVerifyQuery({ code: 'BCPR-2026-0007', name: 'ใครก็ได้' })), null)
  assert.equal(visibleCertificate(bcpr, parseVerifyQuery({ code: 'bcpr-2026-0007', name: 'นาย สมปอง  ดีใจ' })), bcpr, 'title, spaces and case are ignored')
  assert.equal(visibleCertificate(null, parseVerifyQuery({ code: 'BCPR-2026-0008', name: 'สมปอง ดีใจ' })), null)
})

test('anything that is not a well-formed FA- code is treated as guessable', () => {
  for (const code of ['FA-7KQ2MZ9', 'FA-7KQ2MZ9PX', 'FA-IIIIIIII', 'FA-OOOOOOOO', 'X-1']) {
    assert.equal(parseVerifyQuery({ code }).needsName, true, code)
  }
})

test('malformed requests', () => {
  assert.deepEqual(parseVerifyQuery({}), { error: 'Missing code' })
  assert.deepEqual(parseVerifyQuery({ code: 'X'.repeat(41) }), { error: 'Missing code' })
  assert.deepEqual(parseVerifyQuery({ code: 'BCPR-2026-0001', name: 'ก'.repeat(81) }), { error: 'Name too long' })
})

test('name matching follows the Hub rules', () => {
  assert.equal(normalizeName('Mr. John  Smith'), 'johnsmith')
  assert.equal(normalizeName('น.ส. สมหญิง ใจดี'), 'สมหญิงใจดี')
  assert.equal(namesMatch('นางสาว สมหญิง ใจดี', 'สมหญิง ใจดี'), true)
  assert.equal(namesMatch('ก', 'ก'), false, 'too short to count')
  assert.equal(namesMatch('Mrs Smith', 'Smith'), true)
  assert.equal(namesMatch('Mrsmith', 'smith'), false, 'a Latin title needs a dot or a space')
})
