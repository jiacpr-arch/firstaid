import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rateLimited, sanitizeLine } from './rateLimit.js'

function fakeReqRes(ip) {
  let status = null
  let body = null
  const req = { headers: { 'x-forwarded-for': ip }, socket: {} }
  const res = { status(s) { status = s; return this }, json(b) { body = b; return this } }
  return { req, res, get status() { return status }, get body() { return body } }
}

test('rateLimited allows up to the limit then blocks with 429', () => {
  const ip = '203.0.113.7'
  const opts = { key: 'unit-a', limit: 3, windowMs: 60_000 }
  for (let i = 0; i < 3; i++) {
    const ctx = fakeReqRes(ip)
    assert.equal(rateLimited(ctx.req, ctx.res, opts), false, `hit ${i + 1} should pass`)
  }
  const blocked = fakeReqRes(ip)
  assert.equal(rateLimited(blocked.req, blocked.res, opts), true)
  assert.equal(blocked.status, 429)
})

test('rateLimited tracks each client IP independently', () => {
  const opts = { key: 'unit-b', limit: 1, windowMs: 60_000 }
  const a = fakeReqRes('198.51.100.1')
  const b = fakeReqRes('198.51.100.2')
  assert.equal(rateLimited(a.req, a.res, opts), false)
  assert.equal(rateLimited(b.req, b.res, opts), false) // different IP, own bucket
})

test('sanitizeLine collapses newlines/control chars and caps length', () => {
  assert.equal(sanitizeLine('hello\nworld'), 'hello world')
  assert.equal(sanitizeLine('a\t\r\n b'), 'a b')
  assert.equal(sanitizeLine('x'.repeat(200)).length, 80)
  assert.equal(sanitizeLine(null), '')
  // No injected extra lines survive into a LINE message.
  assert.doesNotMatch(sanitizeLine('name\nโทร: 0000000'), /\n/)
})
