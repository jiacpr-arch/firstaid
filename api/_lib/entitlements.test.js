import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveChapters, resolveEntitlements, cleanLocalLearnerId } from './entitlements.js'

// fake ขั้นต่ำ: lesson_entitlements, enrollments+cohorts (unlock), line_identities, rpc hub
function fake({ purchases = {}, unlockedLearners = [], lineBound = [], hubBound = [] } = {}) {
  return {
    rpc: async (_name, { payload }) => ({ data: { bound: hubBound.includes(payload.learnerId) }, error: null }),
    from(table) {
      const f = {}
      const q = {
        select: () => q,
        eq: (c, v) => { f[c] = v; return q },
        is: () => q,
        or: () => q,
        limit: () => q,
        maybeSingle: async () => ({ data: table === 'line_identities' && lineBound.includes(f.learner_id) ? { learner_id: f.learner_id } : null, error: null }),
        then: (ok) => {
          if (table === 'lesson_entitlements') return ok({ data: (purchases[f.learner_id] || []).map((chapter) => ({ chapter })), error: null })
          if (table === 'enrollments') return ok({ data: unlockedLearners.includes(f.learner_id) ? [{}] : [], error: null })
          return ok({ data: [], error: null })
        },
      }
      return q
    },
  }
}

test('local learner in an unlocked class gets the whole course even when the token has no learner (admin account on the device)', async () => {
  const db = fake({ unlockedLearners: ['local-1234'] })
  assert.deepEqual(await resolveChapters(db, { tokenLearnerId: null, localLearnerId: 'local-1234' }), [0])
})

test('local learner bound to a real account is not trusted without its own token', async () => {
  assert.deepEqual(await resolveChapters(fake({ unlockedLearners: ['bound-123'], lineBound: ['bound-123'] }), { localLearnerId: 'bound-123' }), [])
  assert.deepEqual(await resolveChapters(fake({ unlockedLearners: ['hub-1234'], hubBound: ['hub-1234'] }), { localLearnerId: 'hub-1234' }), [])
})

test('token learner keeps purchases and class unlock; local id never grants purchases', async () => {
  const db = fake({ purchases: { 'tok-1234': [2], 'local-1234': [3] }, unlockedLearners: [] })
  assert.deepEqual(await resolveChapters(db, { tokenLearnerId: 'tok-1234', localLearnerId: 'local-1234' }), [2])
  const db2 = fake({ unlockedLearners: ['tok-1234'] })
  assert.deepEqual(await resolveChapters(db2, { tokenLearnerId: 'tok-1234' }), [0])
})

test('no class, no purchase → nothing', async () => {
  assert.deepEqual(await resolveChapters(fake(), { localLearnerId: 'local-1234' }), [])
})

test('cleanLocalLearnerId rejects junk and duplicates of the token learner', () => {
  assert.equal(cleanLocalLearnerId('980f0e64-0bab-4358-8460-b569be34ed35', null), '980f0e64-0bab-4358-8460-b569be34ed35')
  assert.equal(cleanLocalLearnerId('same-1234', 'same-1234'), null)
  assert.equal(cleanLocalLearnerId('bad id;', null), null)
  assert.equal(cleanLocalLearnerId(undefined, null), null)
})

test('CPR (chapter 5) opens only from a purchase — a class that unlocks every lesson does not include CPR', async () => {
  const db = fake({ purchases: { 'tok-cpr1': [5], 'tok-all1': [0], 'tok-fa22': [2] }, unlockedLearners: ['tok-cls1', 'local-1234'] })
  assert.deepEqual(await resolveEntitlements(db, { tokenLearnerId: 'tok-cpr1' }), { chapters: [5], cpr: true })
  assert.deepEqual(await resolveEntitlements(db, { tokenLearnerId: 'tok-all1' }), { chapters: [0], cpr: true })
  assert.deepEqual(await resolveEntitlements(db, { tokenLearnerId: 'tok-fa22' }), { chapters: [2], cpr: false })
  // คลาสเปิดทุกบท: ได้หมวด 1–4 (chapter 0) แต่ไม่ได้ CPR
  assert.deepEqual(await resolveEntitlements(db, { tokenLearnerId: 'tok-cls1' }), { chapters: [0], cpr: false })
  assert.deepEqual(await resolveEntitlements(db, { localLearnerId: 'local-1234' }), { chapters: [0], cpr: false })
})
