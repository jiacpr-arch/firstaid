import { eligibleLanding, revokeTrainingPixel } from './trainingAds.js'
import { installMarketingNavigationBoundary } from './trainingNavigation.js'
import { GOOGLE_CONSENT_KEY, readGoogleChoice, readGoogleGrant, saveGoogleChoice, clearGoogleCookies, retainGoogleAttribution, remainingGoogleSeconds, googleCookieFlags, clearBroadGoogleCookies } from '../../public/google-attribution.js'
export { GOOGLE_CONSENT_KEY }
import { entitlementLookupPending, prepareMarketingResourceTimings } from './entitlementMarketingBoundary.js'

// The owner confirmed this existing JIA training stream for FirstAid and CPR.
// Google tag settings in Admin are not changed by this integration.
export const TRAINING_GA4_ID = 'G-H10PHV2XNG'
export const TRAINING_GOOGLE_ADS_ID = 'AW-873507669'
export const TRAINING_GOOGLE_LINE_CONVERSION = `${TRAINING_GOOGLE_ADS_ID}/nOwLCPvsjdgYENXWwqAD`
// Optional emergency kill switch. Consent and the public document boundary are
// still mandatory when enabled. No other Google ID is accepted from environment.
export const GOOGLE_TRAINING_ENABLED = import.meta.env?.VITE_ENABLE_TRAINING_GOOGLE_TAGS !== 'false'
export const GOOGLE_COOKIE_PREFIX = 'firstaid_attribution_v2'
export const GOOGLE_PUBLIC_PAGE = Object.freeze({
  page_location: 'https://firstaid.morroo.com/',
  page_title: 'FirstAid | JiaCPR Training',
  page_referrer: '',
})
const DENIED = Object.freeze({
  analytics_storage: 'denied', ad_storage: 'denied',
  ad_user_data: 'denied', ad_personalization: 'denied',
})
export const readGoogleConsent = win => readGoogleChoice(win)
export const saveGoogleConsent = (win, value, doc = win.document) => saveGoogleChoice(win, doc, value)

// Build from constants, never forward a visitor's URL or arbitrary campaign data.
// Analytics needs click IDs in document location for consented auto-tagging.
export function googleLandingPage(win, doc, expectedGrant) {
  const grant = readGoogleGrant(win)
  if (!grant || (expectedGrant && JSON.stringify(grant) !== JSON.stringify(expectedGrant))
    || entitlementLookupPending(win) || win.__firstaidPrivateDocument
    || win.__firstaidMarketingRevoked || win.__firstaidGoogleRevoked
    || !eligibleLanding(win.location, doc.referrer)) return null
  const url = new URL(GOOGLE_PUBLIC_PAGE.page_location)
  if (grant.mode === 'ads') {
    const query = new URLSearchParams(win.location.search)
    for (const key of ['gclid', 'gbraid', 'wbraid']) {
      if (query.has(key)) url.searchParams.set(key, query.get(key))
    }
  }
  return { ...GOOGLE_PUBLIC_PAGE, page_location: url.href }
}

export function loadTrainingGoogle(win, doc, { enabled = GOOGLE_TRAINING_ENABLED, publicLanding = false } = {}) {
  // No Google script, consent ping, iframe, preload or dataLayer before consent.
  // Never attach our tags to an unknown pre-existing Google queue.
  if (entitlementLookupPending(win) || !enabled || !publicLanding || !eligibleLanding(win.location, doc.referrer)
    || !readGoogleGrant(win) || win.__firstaidPrivateDocument
    || win.__firstaidMarketingRevoked || win.__firstaidGoogleRevoked
    || win.__firstaidGoogleLoaded || win.gtag || win.dataLayer) return false
  if (!prepareMarketingResourceTimings(win)) return false
  installMarketingNavigationBoundary(win, doc, (currentWindow, currentDocument) => {
    currentWindow.__firstaidMarketingRevoked = true
    revokeTrainingPixel(currentWindow, currentDocument)
    retireTrainingGoogle(currentWindow, currentDocument)
  })
  const grant = readGoogleGrant(win)
  if (!grant) return false
  const advertising = grant.mode === 'ads'
  const cookie = { cookie_domain: 'firstaid.morroo.com', cookie_prefix: advertising ? GOOGLE_COOKIE_PREFIX : 'firstaid_analytics', cookie_expires: remainingGoogleSeconds(win), cookie_update: false, cookie_flags: googleCookieFlags(grant.expiresAt) }
  if (cookie.cookie_expires < 1 || !clearBroadGoogleCookies(doc, cookie.cookie_prefix) || !cookie.cookie_flags) return false
  const page = googleLandingPage(win, doc, grant)
  if (!page) return false
  win.dataLayer = []
  win.gtag = function () {
    const revoked = win.__firstaidGoogleRevoked || win.__firstaidMarketingRevoked || win.__firstaidPrivateDocument
    // Only our immutable denial may pass after revocation. A captured gtag
    // reference must not requeue events, config or a stale consent grant.
    const internalDenial = arguments.length === 3 && arguments[0] === 'consent'
      && arguments[1] === 'update' && arguments[2] === DENIED
    if (revoked && !internalDenial) return
    win.dataLayer.push(arguments)
  }
  win.__firstaidGoogleGrant = JSON.stringify(grant)
  win.__firstaidGoogleLoaded = true
  win.__firstaidMarketingLoaded = true // Any vendor requires document teardown.
  win[`ga-disable-${TRAINING_GA4_ID}`] = false
  const gtag = win.gtag
  gtag('consent', 'default', { ...DENIED })
  gtag('set', 'ads_data_redaction', true)
  gtag('set', 'url_passthrough', false)
  // Explicit empty user_data overrides account-side automatic data collection.
  // It does not claim to disable the SDK's DOM detector itself.
  gtag('set', 'user_data', null)
  gtag('set', 'linker', { domains: [], accept_incoming: false, decorate_forms: false })
  gtag('set', { ...page, ...cookie, allow_google_signals: false, allow_ad_personalization_signals: false })
  gtag('consent', 'update', { ...DENIED, analytics_storage: 'granted', ...(advertising ? { ad_storage: 'granted', ad_user_data: 'granted' } : {}) })
  gtag('js', new Date())
  // Documented options only. send_page_view:false does not disable server-side
  // Enhanced Measurement. SDK isolation, not that setting, protects private UI.
  gtag('config', TRAINING_GA4_ID, {
    ...page, user_data: null, send_page_view: false, ...cookie,
    allow_google_signals: false, allow_ad_personalization_signals: false,
  })
  if (advertising) gtag('config', TRAINING_GOOGLE_ADS_ID, {
    ...page, user_data: null, send_page_view: false, ...cookie,
    allow_ad_personalization_signals: false, allow_enhanced_conversions: false,
  })
  gtag('event', 'page_view', { ...page, user_data: null, send_to: TRAINING_GA4_ID })
  const script = doc.createElement('script')
  script.async = true
  script.referrerPolicy = 'no-referrer'
  script.src = `https://www.googletagmanager.com/gtag/js?id=${TRAINING_GA4_ID}`
  doc.head.appendChild(script)
  return true
}

function stopTrainingGoogle(win) {
  win.__firstaidGoogleRevoked = true
  win[`ga-disable-${TRAINING_GA4_ID}`] = true
  if (win.__firstaidGoogleLoaded) {
    // Preserve the array and any installed push handler. Clearing only its
    // buffered entries prevents a late SDK from replaying an earlier grant,
    // config, pageview or contact before it reaches the denial below.
    try { win.dataLayer?.splice(0) } catch { /* still deny and discard document */ }
    try { win.gtag?.('consent', 'update', DENIED) } catch { /* non-blocking */ }
  }
  // The caller must discard a loaded document; removing a script cannot unload
  // an SDK. Cookie cleanup is best-effort and never replaces that boundary.
}

export function revokeTrainingGoogle(win, doc) {
  stopTrainingGoogle(win)
  clearGoogleCookies(doc)
}

// Ordinary navigation stops SDKs and discards the document but does not withdraw
// the explicit attribution purpose. The absolute deadline is never renewed.
export function retireTrainingGoogle(win, doc) {
  stopTrainingGoogle(win)
  retainGoogleAttribution(win, doc)
}

// A click is contact intent only. Never a sale, enrollment or successful form.
// This function is wired only to the public practical-course LINE link, not tel:1669.
export function trackGoogleLandingContact(win, doc) {
  if (!win.__firstaidGoogleLoaded || win.__firstaidGoogleRevoked || win.__firstaidMarketingRevoked
    || win.__firstaidPrivateDocument || !readGoogleGrant(win)
    || !eligibleLanding(win.location, doc.referrer) || typeof win.gtag !== 'function') return false
  const page = googleLandingPage(win, doc)
  if (!page || JSON.stringify(readGoogleGrant(win)) !== win.__firstaidGoogleGrant) return false
  const context = { ...page, user_data: null, content_name: 'cpr_aed_inperson_course', source: 'firstaid_landing', channel: 'line' }
  try {
    win.gtag('event', 'contact', { ...context, send_to: TRAINING_GA4_ID })
    if (readGoogleGrant(win)?.mode === 'ads') win.gtag('event', 'conversion', { ...context, send_to: TRAINING_GOOGLE_LINE_CONVERSION })
    return true
  } catch { return false }
}
