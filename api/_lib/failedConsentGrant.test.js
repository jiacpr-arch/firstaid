import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import { CONSENT_KEY, readConsent, saveConsent, revokeTrainingPixel, denialFallbackUrl, eligibleLanding } from '../../src/lib/trainingAds.js'
import { GOOGLE_CONSENT_KEY, readGoogleConsent, saveGoogleConsent, revokeTrainingGoogle } from '../../src/lib/trainingGoogleAds.js'

// Run the actual component choice handler, before its JSX return, with fake
// browser/storage objects. No React renderer, browser, SDK or network is used.
function componentChoice(path, dependencies, { rollbackBlocked }) {
  const source = readFileSync(new URL('../../' + path, import.meta.url), 'utf8')
  const match = source.match(/const choose = value => \{([\s\S]*?)\n {2}\}/)
  assert.ok(match, 'Component must expose its local choice handler for this regression')
  const values = new Map(), session = new Map(), navigations = [], choices = []
  let grantWritten = false
  const win = {
    location: Object.assign(new URL('https://firstaid.morroo.com/'), {
      replace: url => navigations.push(['replace', url]), reload: () => navigations.push(['reload']),
    }),
    localStorage: {
      getItem: key => values.get(key) || null,
      setItem(key, value) {
        if (rollbackBlocked && grantWritten) throw Error('Synthetic denial write failure')
        values.set(key, value)
        if (value === 'granted' || value.includes('"version":2')) grantWritten = true
      },
    },
    sessionStorage: {
      getItem: key => session.get(key) || null,
      removeItem() { throw Error('Synthetic session removal failure after local grant') },
      setItem(key, value) {
        if (rollbackBlocked) throw Error('Synthetic session denial write failure')
        session.set(key, value)
      },
    },
  }
  const context = createContext({ choice: null, window: win, document: { cookie: '' }, setChoice: value => choices.push(value), denialFallbackUrl, ...dependencies })
  const choose = runInContext(`(value => {${match[1]}\n})`, context)
  return { win, choose, choices, navigations, values }
}

for (const [vendor, path, key, read, dependencies, revoked] of [
  ['Meta', 'src/components/MetaPixel.jsx', CONSENT_KEY, readConsent, { readConsent, saveConsent, revokeTrainingPixel }, '__firstaidMetaRevoked'],
  ['Google', 'src/components/GoogleTrainingConsent.jsx', GOOGLE_CONSENT_KEY, readGoogleConsent, { readGoogleConsent, saveGoogleConsent, revokeTrainingGoogle }, '__firstaidGoogleRevoked'],
]) {
  test(`${vendor} failed grant uses no-ads fallback when partial local grant cannot be rolled back`, () => {
    const f = componentChoice(path, dependencies, { rollbackBlocked: true })
    f.choose(vendor === 'Google' ? 'ads' : 'granted')
    assert.deepEqual(f.choices, ['denied'])
    assert.ok(f.values.get(key)?.includes(vendor === 'Google' ? '"mode":"ads"' : 'granted'), 'Exercise the surviving partial write, not a clean rollback')
    assert.equal(read(f.win), vendor === 'Google' ? 'ads' : 'granted', 'Stored consent alone is unsafe after this failed save')
    assert.equal(f.win[revoked], true)
    assert.equal(f.win.gtag, undefined)
    assert.equal(f.win.fbq, undefined)
    assert.equal(f.navigations.length, 1)
    assert.equal(f.navigations[0][0], 'replace')
    const target = new URL(f.navigations[0][1])
    assert.equal(target.searchParams.get('marketing_consent'), 'denied')
    assert.equal(eligibleLanding(target), false, 'Fallback document cannot load either vendor despite stale storage')
  })

  test(`${vendor} failed grant can retain the document only after verifying a successful denial rollback`, () => {
    const f = componentChoice(path, dependencies, { rollbackBlocked: false })
    f.choose(vendor === 'Google' ? 'ads' : 'granted')
    assert.deepEqual(f.choices, ['denied'])
    assert.equal(read(f.win), 'denied')
    assert.equal(f.win[revoked], true)
    assert.equal(f.win.gtag, undefined)
    assert.equal(f.win.fbq, undefined)
    assert.deepEqual(f.navigations, [])
  })
}
