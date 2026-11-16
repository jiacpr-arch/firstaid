import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ATTRIBUTION_STORAGE_KEY, ATTRIBUTION_MAX_AGE_MS, sanitizeAttribution, sanitizeAttributionValue,
  attributionFromSearch, captureAttribution, readAttribution,
} from '../../src/lib/checkoutAttribution.js'
import { checkoutAttribution, checkoutItem, sessionParams } from './stripeCheckout.js'

function storage(values = new Map()) {
  return { values, getItem: k => values.has(k) ? values.get(k) : null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) }
}
const win = (search = '', values) => ({ location: { search }, localStorage: storage(values) })

test('sanitizeAttribution keeps only known keys with safe string values', () => {
  assert.deepEqual(sanitizeAttribution({
    utm_source: ' facebook ', utm_medium: 'paid_social', utm_campaign: 'FirstAid-Nov.2026', utm_content: 'ad_a',
    utm_term: 'cpr+aed', fbclid: 'IwAR0abc_DEF-123', fbc: 'fb.1.1700000000000.IwAR0abc', gclid: 'Cj0KCQ~x/y=z:1',
    gbraid: '0AAAAA', wbraid: 'wb_1', ttclid: 'tt.1',
    learner_id: 'evil', guest: '0', buyer_phone: '0812345678', email: 'a@b.co', chapter: '9',
  }), {
    utm_source: 'facebook', utm_medium: 'paid_social', utm_campaign: 'FirstAid-Nov.2026', utm_content: 'ad_a',
    utm_term: 'cpr+aed', fbclid: 'IwAR0abc_DEF-123', fbc: 'fb.1.1700000000000.IwAR0abc', gclid: 'Cj0KCQ~x/y=z:1',
    gbraid: '0AAAAA', wbraid: 'wb_1', ttclid: 'tt.1',
  })
})

test('sanitizeAttribution drops bad types, charsets, lengths and phone-like utm values', () => {
  for (const bad of [123, true, null, undefined, {}, ['x'], '', '   ', 'a b', 'a@b.com', '<script>', 'x&y', 'ไทย', 'x'.repeat(201), 'a\nb', 'a%40b']) {
    assert.equal(sanitizeAttributionValue('utm_source', bad), null, JSON.stringify(bad))
  }
  assert.equal(sanitizeAttributionValue('utm_source', 'x'.repeat(200)), 'x'.repeat(200))
  assert.equal(sanitizeAttributionValue('utm_term', '0812345678'), null)
  assert.equal(sanitizeAttributionValue('utm_term', '12345678'), '12345678')
  assert.equal(sanitizeAttributionValue('not_a_key', 'ok'), null)
  for (const input of [null, undefined, 'utm_source=x', ['x'], 42]) assert.deepEqual(sanitizeAttribution(input), {})
  assert.deepEqual(sanitizeAttribution(Object.create({ utm_source: 'inherited' })), {})
})

test('attributionFromSearch reads landing URL, first value wins, never fbc', () => {
  assert.deepEqual(attributionFromSearch('?chapter=0&utm_source=fb&utm_source=other&fbclid=IwAR_1&fbc=fb.1.2.x&email=a%40b.com'),
    { utm_source: 'fb', fbclid: 'IwAR_1' })
  assert.deepEqual(attributionFromSearch(''), {})
})

test('captureAttribution stores last touch, ignores landings without keys, expires after ~90 days', () => {
  const values = new Map()
  const now = 1_800_000_000_000
  assert.equal(captureAttribution(win('?utm_source=facebook&utm_campaign=c1', values), now), true)
  assert.equal(captureAttribution(win('?chapter=0', values), now + 1000), false)
  assert.deepEqual(readAttribution(win('', values), now + 1000), { utm_source: 'facebook', utm_campaign: 'c1' })
  assert.equal(captureAttribution(win('?gclid=Cj0_new', values), now + 2000), true)
  assert.deepEqual(readAttribution(win('', values), now + 3000), { gclid: 'Cj0_new' })
  assert.deepEqual(readAttribution(win('', values), now + 2000 + ATTRIBUTION_MAX_AGE_MS + 1), {})
  assert.equal(values.has(ATTRIBUTION_STORAGE_KEY), false)
})

test('readAttribution fails closed on corrupt or tampered storage', () => {
  const now = 1_800_000_000_000
  for (const raw of ['{', '"x"', JSON.stringify({ v: 2, savedAt: now, touch: { utm_source: 'x' } }), JSON.stringify({ v: 1, savedAt: now + 1, touch: { utm_source: 'x' } })]) {
    assert.deepEqual(readAttribution(win('', new Map([[ATTRIBUTION_STORAGE_KEY, raw]])), now), {}, raw)
  }
  const tampered = JSON.stringify({ v: 1, savedAt: now, touch: { utm_source: 'ok', learner_id: 'x', utm_term: 'a@b' } })
  assert.deepEqual(readAttribution(win('', new Map([[ATTRIBUTION_STORAGE_KEY, tampered]])), now), { utm_source: 'ok' })
  const broken = { location: { search: '?utm_source=x' }, localStorage: { getItem() { throw Error('blocked') }, setItem() { throw Error('blocked') } } }
  assert.deepEqual(readAttribution(broken), {})
  assert.equal(captureAttribution(broken), false)
})

test('checkoutAttribution: fbc only from the _fbc cookie, never fabricated', () => {
  assert.deepEqual(checkoutAttribution({ attribution: { utm_source: 'fb', fbclid: 'IwAR_1', fbc: 'fb.1.2.forged' } }, ''),
    { utm_source: 'fb', fbclid: 'IwAR_1' })
  assert.deepEqual(checkoutAttribution({ attribution: { fbc: 'forged' } }, 'a=1; _fbc=fb.1.1700000000000.IwAR_1; _fbp=fb.1.2.3'),
    { fbc: 'fb.1.1700000000000.IwAR_1' })
  assert.deepEqual(checkoutAttribution({}, '_fbc=bad value<>'), {})
  assert.deepEqual(checkoutAttribution(undefined, undefined), {})
})

test('sessionParams merges attribution without overwriting existing metadata', () => {
  const item = checkoutItem(0)
  const attribution = { utm_source: 'facebook', gclid: 'Cj0_1', learner_id: 'evil', chapter: '9', guest: '0' }
  const guest = sessionParams({ item, buyer: { name: 'สมชาย ใจดี', phone: '0812345678' }, attribution, base: 'https://x.test' })
  assert.equal(guest.get('metadata[utm_source]'), 'facebook')
  assert.equal(guest.get('metadata[gclid]'), 'Cj0_1')
  assert.equal(guest.get('metadata[guest]'), '1')
  assert.equal(guest.get('metadata[chapter]'), '0')
  assert.equal(guest.get('metadata[learner_id]'), null)
  assert.equal(guest.get('metadata[buyer_phone]'), '0812345678')
  const member = sessionParams({ item, learnerId: 'L1', userId: 'U1', attribution: { fbc: 'fb.1.2.x' }, base: 'https://x.test' })
  assert.equal(member.get('metadata[learner_id]'), 'L1')
  assert.equal(member.get('metadata[fbc]'), 'fb.1.2.x')
  assert.equal(member.getAll('metadata[learner_id]').length, 1)
  const plain = sessionParams({ item, learnerId: 'L1', base: 'https://x.test' })
  assert.equal([...plain.keys()].some(k => /utm_|clid|fbc|braid/.test(k)), false)
})
