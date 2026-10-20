import test from 'node:test'
import assert from 'node:assert/strict'
import {
  generateInstructorCode, codesMatch, normalizeCode, verifySessionCode, authorizeInstructor,
} from './instructorAuth.js'

const SESSION = { id: 's1', instructor_code: 'ABCD2345', closed_at: null }

function fakeAdmin({ session = SESSION, user = null } = {}) {
  return {
    auth: {
      getUser: async () => (user ? { data: { user }, error: null } : { data: { user: null }, error: new Error('bad') }),
    },
    from: () => ({
      select: () => ({ eq: (_c, id) => ({ maybeSingle: async () => ({ data: session && id === session.id ? session : null }) }) }),
    }),
  }
}
function fakeRes() {
  const res = { statusCode: null, body: null }
  res.status = (c) => { res.statusCode = c; return res }
  res.json = (b) => { res.body = b; return res }
  return res
}
const req = (headers) => ({ headers: { 'x-forwarded-for': '10.0.0.1', ...headers } })

test('generated codes are 8 chars from the unambiguous alphabet and differ', () => {
  const a = generateInstructorCode()
  assert.match(a, /^[A-HJKMNP-Z2-9]{8}$/)
  assert.notEqual(a, generateInstructorCode())
})

test('codesMatch ignores case, spaces and dashes but never matches empty', () => {
  assert.equal(normalizeCode(' abcd-2345 '), 'ABCD2345')
  assert.equal(codesMatch('ABCD2345', 'abcd 2345'), true)
  assert.equal(codesMatch('ABCD2345', 'ABCD2346'), false)
  assert.equal(codesMatch('ABCD2345', 'ABCD234'), false)
  assert.equal(codesMatch(null, ''), false)
  assert.equal(codesMatch('', ''), false)
})

test('verifySessionCode rejects wrong code, missing session, and closed session', async () => {
  assert.equal((await verifySessionCode(fakeAdmin(), 's1', 'ABCD2345')).ok, true)
  assert.equal((await verifySessionCode(fakeAdmin(), 's1', 'WRONG123')).status, 403)
  assert.equal((await verifySessionCode(fakeAdmin(), 'nope', 'ABCD2345')).status, 403)
  const closed = fakeAdmin({ session: { ...SESSION, closed_at: '2026-10-20' } })
  assert.equal((await verifySessionCode(closed, 's1', 'ABCD2345')).status, 410)
})

test('authorizeInstructor: valid code works without a user', async () => {
  const res = fakeRes()
  const r = await authorizeInstructor(req({ 'x-instructor-code': 'abcd2345' }), res, fakeAdmin(), 's1')
  assert.deepEqual(r, { user: null, via: 'code' })
})

test('authorizeInstructor: wrong code and no credentials are refused', async () => {
  const res1 = fakeRes()
  assert.equal(await authorizeInstructor(req({ 'x-instructor-code': 'WRONG123' }), res1, fakeAdmin(), 's1'), null)
  assert.equal(res1.statusCode, 403)
  const res2 = fakeRes()
  assert.equal(await authorizeInstructor(req({}), res2, fakeAdmin(), 's1'), null)
  assert.equal(res2.statusCode, 401)
})

test('authorizeInstructor: a code for another session does not work', async () => {
  const res = fakeRes()
  const other = fakeAdmin({ session: { ...SESSION, id: 's2', instructor_code: 'ZZZZ9999' } })
  assert.equal(await authorizeInstructor(req({ 'x-instructor-code': 'ZZZZ9999' }), res, other, 's1'), null)
  assert.equal(res.statusCode, 403)
})

test('authorizeInstructor: a non-admin bearer token falls back to the code', async () => {
  const res = fakeRes()
  const admin = fakeAdmin({ user: { id: 'u1', app_metadata: {}, email: 'x@y.z' } })
  const r = await authorizeInstructor(
    req({ authorization: 'Bearer tok', 'x-instructor-code': 'ABCD2345' }), res, admin, 's1',
  )
  assert.equal(r.via, 'code')
})
