import { readVendorConsent, saveVendorConsent } from './trainingConsent.js'

// Verified JiaCPR Training dataset, owned by the JIA training business.
export const TRAINING_PIXEL_ID = '1277103750989853'
// A new dataset requires fresh consent; never reuse the legacy grant.
export const CONSENT_KEY = 'firstaid_jia_training_meta_consent_v2'

export function safeMarketingQuery(search) {
  const params = new URLSearchParams(search)
  const seen = new Set()
  if (params.size > 5) return false
  for (const [key, value] of params) {
    if (seen.has(key)) return false
    seen.add(key)
    if (['utm_source', 'utm_medium', 'utm_campaign'].includes(key)) {
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(value) || /^[0-9]{9,}$/.test(value)) return false
    } else if (['fbclid', 'gclid'].includes(key)) {
      if (!/^[A-Za-z0-9_-]{8,256}$/.test(value)) return false
    } else return false
  }
  return true
}

export function safeReferrer(referrer) {
  if (!referrer) return true
  try {
    const url = new URL(referrer)
    return url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash
  } catch { return false }
}

export function eligibleLanding(location, referrer = '') {
  return location.hostname === 'firstaid.morroo.com' && location.pathname === '/'
    && !location.hash && safeMarketingQuery(location.search) && safeReferrer(referrer)
}

export function anonymousLanding(learner, progress, onboarding, auth) {
  // Fail closed while auth or local progress is unresolved.
  return auth?.loading === false && !auth.session
    && !!onboarding && !!progress?.loaded && !progress.loading
    && !learner?.name && !learner?.phone && !learner?.email && !learner?.lineUserId
    && !learner?.cohortCode && !learner?.lineAdded && !learner?.lineSkippedAt
    && progress.readLessonIds?.size === 0 && progress.passedScenarioIds?.size === 0
    && !progress.preTestDone && !progress.postTestDone
}

// A document that has displayed a private route or resolved learner context can
// never become a marketing document through SPA back/forward navigation.
export function canUseMarketingDocument(win, { urlEligible, anonymous, auth, progress }) {
  if (!urlEligible || auth?.session || (auth?.loading === false && progress?.loaded && !anonymous)) {
    win.__firstaidPrivateDocument = true
  }
  return !!urlEligible && !!anonymous && !win.__firstaidPrivateDocument
}

// The caller must check both public-page eligibility and explicit consent.
export function loadTrainingPixel(win, doc, pixelId) {
  if (pixelId !== TRAINING_PIXEL_ID || win.__firstaidMetaLoaded || win.__firstaidMetaRevoked || win.__firstaidMarketingRevoked || win.__firstaidPrivateDocument || win.fbq) return
  const fbq = win.fbq = function (...args) {
    if (fbq.callMethod) fbq.callMethod(...args)
    else fbq.queue.push(args)
  }
  fbq.queue = []
  fbq.loaded = true
  fbq.version = '2.0'
  win._fbq = fbq
  win.__firstaidMetaLoaded = true
  win.__firstaidMarketingLoaded = true
  fbq('set', 'autoConfig', false, pixelId)
  fbq('consent', 'grant')
  fbq('init', pixelId)
  fbq('trackSingle', pixelId, 'PageView')
  const script = doc.createElement('script')
  script.async = true
  script.referrerPolicy = 'no-referrer'
  script.src = 'https://connect.facebook.net/en_US/fbevents.js'
  doc.head.appendChild(script)
}

export function revokeTrainingPixel(win, doc) {
  win.__firstaidMetaRevoked = true
  try { win.fbq?.('consent', 'revoke') } catch { /* non-blocking */ }
  for (const name of ['_fbp', '_fbc']) {
    for (const domain of ['', '; Domain=firstaid.morroo.com', '; Domain=.morroo.com']) {
      try { doc.cookie = `${name}=; Max-Age=0; Path=/${domain}` } catch { /* private browser */ }
    }
  }
}

// A denial takes precedence even if localStorage later becomes read-only.
export const readConsent = win => readVendorConsent(win, CONSENT_KEY)
export const saveConsent = (win, value) => saveVendorConsent(win, CONSENT_KEY, value)
export function denialFallbackUrl(location) {
  const url = new URL(location.href)
  // The unknown query key makes this document ineligible. No user data is added.
  url.searchParams.set('marketing_consent', 'denied')
  return url.href
}


export function installMarketingLifecycleGuard(win, doc, revokeAll = revokeTrainingPixel) {
  const onHide = () => {
    if (!win.__firstaidMarketingLoaded) return
    win.__firstaidMarketingRevoked = true
    revokeAll(win, doc)
  }
  const onShow = event => {
    // A cached anonymous page may have stale auth/profile state after learning.
    if (event.persisted && win.__firstaidMarketingLoaded) win.location.reload()
  }
  win.addEventListener('pagehide', onHide)
  win.addEventListener('pageshow', onShow)
  return () => {
    win.removeEventListener('pagehide', onHide)
    win.removeEventListener('pageshow', onShow)
  }
}


export function trackLandingContact(win, doc) {
  if (!win.__firstaidMetaLoaded || win.__firstaidMetaRevoked || win.__firstaidMarketingRevoked || win.__firstaidPrivateDocument
    || readConsent(win) !== 'granted' || !eligibleLanding(win.location, doc.referrer)) return false
  try {
    win.fbq?.('trackSingle', TRAINING_PIXEL_ID, 'Contact', {
      content_name: 'cpr_aed_inperson_course', source: 'firstaid_landing', channel: 'line',
    })
    return typeof win.fbq === 'function'
  } catch { return false }
}
