import test from 'node:test'
import assert from 'node:assert/strict'
import { encodeStudentQr, parseStudentQr } from './qrPayload.js'

const id = '3f2b8c1e-5a47-4d0e-9b6a-1c2d3e4f5a6b'

test('round-trips a Thai name and phone', () => {
  const text = encodeStudentQr({ id, name: 'สมชาย ใจดี', phone: '0812345678' })
  assert.deepEqual(parseStudentQr(text), { id, name: 'สมชาย ใจดี', phone: '0812345678' })
})

test('phone is optional', () => {
  const text = encodeStudentQr({ id, name: 'A', phone: '' })
  assert.equal(parseStudentQr(text).phone, null)
})

test('rejects foreign, malformed and nameless payloads', () => {
  assert.equal(parseStudentQr('https://example.com'), null)
  assert.equal(parseStudentQr('MRQR1|' + id + '|x|'), null)
  assert.equal(parseStudentQr('FAQR1|not-a-uuid|x|'), null)
  assert.equal(parseStudentQr(`FAQR1|${id}||`), null)
  assert.equal(parseStudentQr(`FAQR1|${id}|%E0%A4%A|`), null)
  assert.equal(parseStudentQr(null), null)
})
