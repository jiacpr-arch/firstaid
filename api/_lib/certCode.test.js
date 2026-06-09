import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateCertCode } from './certCode.js'

test('generateCertCode returns FA- prefix + 8 unambiguous chars', () => {
  const c = generateCertCode()
  assert.match(c, /^FA-[2-9A-HJ-NP-Z]{8}$/)
})

test('two consecutive codes are different (probabilistic)', () => {
  const a = generateCertCode()
  const b = generateCertCode()
  assert.notEqual(a, b)
})
