import { denialFallbackUrl, eligibleLanding } from './trainingAds.js'
import { readVendorConsent, saveVendorConsent } from './trainingConsent.js'
import { installMarketingNavigationBoundary } from './trainingNavigation.js'
import { revokeTrainingMarketing } from './trainingMarketing.js'
import { entitlementLookupPending, prepareMarketingResourceTimings } from './entitlementMarketingBoundary.js'

export const OPENAI_PIXEL_ID = 'QGaBG3DEsN1QQ4mvnw3Jdu'
// Fresh vendor-specific choice. Never migrate a Meta or Google grant.
export const OPENAI_CONSENT_KEY = 'firstaid_jia_training_openai_consent_v1'
export const OPENAI_IMAGE_URL = `https://bzr.openai.com/v1/sdk/events?pid=${OPENAI_PIXEL_ID}&event=page_viewed&data%5Btype%5D=contents`
export const readOpenAIConsent = win => readVendorConsent(win, OPENAI_CONSENT_KEY)
export const saveOpenAIConsent = (win, value) => saveVendorConsent(win, OPENAI_CONSENT_KEY, value)

export function eligibleOpenAIDocument(win, doc, publicLanding = false) {
  try {
    if (entitlementLookupPending(win) || !publicLanding || win.location.origin !== 'https://firstaid.morroo.com'
      || win.oaiq || win.navigator?.webdriver === true || win.__firstaidPrivateDocument
      || win.__firstaidMarketingRevoked || win.__firstaidOpenAIRevoked
      || !eligibleLanding(win.location, doc.referrer)) return false
    // App's publicLanding resolves auth and local learning progress. Reading both
    // stores here also fails closed if browser storage becomes unavailable.
    win.localStorage.getItem(OPENAI_CONSENT_KEY)
    win.sessionStorage.getItem(OPENAI_CONSENT_KEY + '_denied')
    for (let i = 0; i < win.localStorage.length; i++) {
      const key = win.localStorage.key(i) || ''
      if (/^(sb-.*-auth-token|LIFF_STORE:)/.test(key) && win.localStorage.getItem(key)) return false
    }
    return true
  } catch { return false }
}

export function loadTrainingOpenAI(win, doc, { publicLanding = false } = {}) {
  try {
    if (win.__firstaidOpenAILoaded || !eligibleOpenAIDocument(win, doc, publicLanding)
      || readOpenAIConsent(win) !== 'granted' || !doc.body) return false
    if (!prepareMarketingResourceTimings(win)) return false
    installMarketingNavigationBoundary(win, doc, revokeTrainingMarketing)
    const image = doc.createElement('img')
    image.id = 'firstaid-training-openai'
    image.width = 1
    image.height = 1
    image.alt = ''
    image.style.display = 'none'
    image.referrerPolicy = 'origin'
    win.__firstaidOpenAILoaded = true
    win.__firstaidMarketingLoaded = true
    win.__firstaidOpenAIImage = image
    // The URL is fixed: no DOM, cookies, identifiers, URL/query, or form data.
    // No JS SDK, noscript fallback, attribution capture, or retry is installed.
    image.src = OPENAI_IMAGE_URL
    doc.body.appendChild(image)
    return true
  } catch { return false }
}

export function revokeTrainingOpenAI(win) {
  win.__firstaidOpenAIRevoked = true
  try {
    win.__firstaidOpenAIImage?.removeAttribute('src')
    win.__firstaidOpenAIImage?.remove()
  } catch { /* Best effort; withdrawal cannot recall an already-sent request. */ }
}

// Keep the component's persistence/redirect decision testable without a browser.
// A failed grant can leave a readable stale grant after a partial storage write.
export function applyOpenAIConsentChoice(win, value) {
  const saved = saveOpenAIConsent(win, value)
  if (value === 'granted' && !saved) {
    if (!saveOpenAIConsent(win, 'denied')) {
      revokeTrainingOpenAI(win)
      win.location.replace(denialFallbackUrl(win.location))
    }
    return 'denied'
  }
  if (value === 'denied') {
    if (win.__firstaidOpenAILoaded || !saved) revokeTrainingOpenAI(win)
    if (!saved) win.location.replace(denialFallbackUrl(win.location))
    else if (win.__firstaidOpenAILoaded) win.location.reload()
  }
  return value
}
