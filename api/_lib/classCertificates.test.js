import test from 'node:test'
import assert from 'node:assert/strict'
import { buildClassCertificates, publicRows, resendPendingPractical, CERT_STATE } from './classCertificates.js'

const U1 = '00000000-0000-4000-8000-000000000001'
const U2 = '00000000-0000-4000-8000-000000000002'
const hubCert = (kind, number) => ({ courseId: 'firstaid', kind, status: 'issued', number, verifyPath: `/portal?verify=${number}`, issuedAt: '2026-10-26T10:00:00Z' })

const enrollments = [
  { learner_id: 'a', name: 'ครบ', group_label: 'A' }, // both Hub certificates
  { learner_id: 'b', name: 'ค้างปฏิบัติ' }, // passed practical here, Hub theory only
  { learner_id: 'c', name: 'ไม่มีบัญชี' }, // passed both here, never logged in
  { learner_id: 'd', name: 'ยังไม่ผ่าน' },
]
const certificates = [
  { learner_id: 'a', kind: 'theory' }, { learner_id: 'a', kind: 'practical', source_ref: 'att-a' },
  { learner_id: 'b', kind: 'theory' }, { learner_id: 'b', kind: 'practical', source_ref: 'att-b' },
  { learner_id: 'c', kind: 'theory' }, { learner_id: 'c', kind: 'practical', source_ref: 'att-c' },
]
const identities = [{ learner_id: 'a', auth_user_id: U1 }, { learner_id: 'b', auth_user_id: U2 }]
const hubByUser = {
  [U1]: [hubCert('online', 'JIA-FIRSTAID-ONL-2026-A'), hubCert('practical', 'JIA-FIRSTAID-PRC-2026-A')],
  [U2]: [hubCert('online', 'JIA-FIRSTAID-ONL-2026-B'), { ...hubCert('practical', 'JIA-FIRSTAID-PRC-2026-OLD'), status: 'revoked' }],
}

test('each learner: Hub certificate, waiting with the reason, or not passed yet', () => {
  const { rows, totals } = buildClassCertificates({ enrollments, certificates, identities, hubByUser })
  const by = Object.fromEntries(rows.map((r) => [r.learnerId, r]))
  assert.equal(by.a.theory.state, CERT_STATE.hub)
  assert.equal(by.a.practical.number, 'JIA-FIRSTAID-PRC-2026-A')
  assert.equal(by.a.group, 'A')
  assert.equal(by.a._resend, null)
  // a revoked Hub certificate is not "has one"
  assert.equal(by.b.practical.state, CERT_STATE.waiting)
  assert.match(by.b.practical.reason, /ส่งผลที่ค้าง/)
  assert.deepEqual(by.b._resend, { userId: U2, attendanceId: 'att-b' })
  assert.equal(by.c.hasAccount, false)
  assert.equal(by.c.theory.state, CERT_STATE.waiting)
  assert.match(by.c.practical.reason, /เข้าสู่ระบบ/)
  assert.equal(by.c._resend, null)
  assert.equal(by.d.theory.state, CERT_STATE.none)
  assert.equal(by.d.practical.state, CERT_STATE.none)
  assert.deepEqual(totals, { learners: 4, theoryHub: 2, theoryWaiting: 1, practicalHub: 1, practicalWaiting: 2, resendable: 1 })
})

test('practical waits on the Hub theory certificate before anything else', () => {
  const { rows } = buildClassCertificates({ enrollments: [enrollments[1]], certificates, identities, hubByUser: { [U2]: [] } })
  assert.match(rows[0].practical.reason, /ทฤษฎี/)
})

test('publicRows hides the resend details', () => {
  const { rows } = buildClassCertificates({ enrollments, certificates, identities, hubByUser })
  const pub = publicRows(rows)
  assert.ok(pub.every((r) => !('_resend' in r)))
  assert.deepEqual(pub.map((r) => r.canResend), [false, true, false, false])
})

// Minimal admin stand-in: enrollments/certificates/line_identities/attendance/practical_sessions + rpc.
function fakeAdmin({ hubUp = true } = {}) {
  const tables = {
    enrollments: enrollments.map((e) => ({ ...e, cohort_id: 'k1' })),
    certificates, line_identities: identities,
    attendance: [{ id: 'att-b', session_id: 's1', status: 'approved' }],
    practical_sessions: [{ id: 's1', title: 'รุ่น 1', starts_at: '2026-10-26T02:00:00Z', ends_at: null, instructor_name: 'ครูเจีย' }],
  }
  const calls = []
  const from = (name) => {
    const f = []
    const q = {
      select: () => q, order: () => q, limit: () => q,
      eq: (c, v) => { f.push((r) => r[c] === v); return q },
      in: (c, vs) => { f.push((r) => vs.includes(r[c])); return q },
      maybeSingle: async () => ({ data: (tables[name] || []).find((r) => f.every((p) => p(r))) || null, error: null }),
      then: (res) => res({ data: (tables[name] || []).filter((r) => f.every((p) => p(r))), error: null }),
    }
    return q
  }
  const rpc = async (fn, args) => {
    calls.push(args)
    if (!hubUp) return { data: null, error: { message: 'down' } }
    if (args.action === 'certificatesForUsers') return { data: { users: hubByUser }, error: null }
    return { data: { certificate: { kind: 'practical' }, pending: null }, error: null }
  }
  return { from, rpc, calls, auth: {} }
}

test('resend sends only the waiting learners who have an account', async () => {
  const admin = fakeAdmin()
  const out = await resendPendingPractical(admin, 'k1')
  assert.deepEqual(out, { sent: 1, issued: 1, pending: [] })
  const sent = admin.calls.filter((c) => c.action === 'recordPractical')
  assert.equal(sent.length, 1)
  assert.equal(sent[0].payload.userId, U2)
  assert.equal(sent[0].payload.attemptRef, 'firstaid-practical:att-b')
  assert.equal(sent[0].payload.instructorName, 'ครูเจีย')
})

test('resend refuses when the Hub cannot be read (nothing is sent blind)', async () => {
  const admin = fakeAdmin({ hubUp: false })
  const out = await resendPendingPractical(admin, 'k1')
  assert.ok(out.error)
  assert.equal(admin.calls.filter((c) => c.action === 'recordPractical').length, 0)
})
