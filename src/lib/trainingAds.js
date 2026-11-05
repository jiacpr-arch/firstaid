export const CONSENT_KEY = 'firstaid_marketing_consent_v1'

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
    return url.protocol === 'https:' && url.pathname === '/' && !url.search && !url.hash
  } catch { return false }
}

export function eligibleLanding(location, referrer = '') {
  return location.hostname === 'firstaid.morroo.com' && location.pathname === '/'
    && !location.hash && safeMarketingQuery(location.search) && safeReferrer(referrer)
}

export function anonymousLanding(learner, progress, onboarding) {
  return !!onboarding && !!progress.loaded && !progress.loading
    && !learner?.name && !learner?.phone && !learner?.email && !learner?.lineUserId
    && !learner?.cohortCode && !learner?.lineAdded && !learner?.lineSkippedAt
    && progress.readLessonIds.size === 0 && progress.passedScenarioIds.size === 0
    && !progress.preTestDone && !progress.postTestDone
}

// The caller must check both public-page eligibility and explicit consent.
export function loadTrainingPixel(win, doc, pixelId) {
  if (!/^[0-9]{10,20}$/.test(pixelId) || win.__firstaidMarketingLoaded || win.fbq) return
  const fbq = win.fbq = function (...args) {
    if (fbq.callMethod) fbq.callMethod(...args)
    else fbq.queue.push(args)
  }
  fbq.queue = []
  fbq.loaded = true
  fbq.version = '2.0'
  win._fbq = fbq
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
  try { win.fbq?.('consent', 'revoke') } catch { /* non-blocking */ }
  for (const name of ['_fbp', '_fbc']) {
    for (const domain of ['', '; Domain=firstaid.morroo.com', '; Domain=.morroo.com']) {
      try { doc.cookie = `${name}=; Max-Age=0; Path=/${domain}` } catch { /* private browser */ }
    }
  }
}

// A denial takes precedence even if localStorage later becomes read-only.
const DENIAL_KEY = CONSENT_KEY + '_denied'
export function readConsent(win) {
  try { if (win.sessionStorage.getItem(DENIAL_KEY) === '1') return 'denied' } catch { /* unavailable */ }
  try { return win.localStorage.getItem(CONSENT_KEY) } catch { return null }
}
export function saveConsent(win, value) {
  let localSaved = false
  try {
    win.localStorage.setItem(CONSENT_KEY, value)
    localSaved = win.localStorage.getItem(CONSENT_KEY) === value
  } catch { /* use session denial */ }
  if (value === 'denied') {
    let sessionSaved = false
    try {
      win.sessionStorage.setItem(DENIAL_KEY, '1')
      sessionSaved = win.sessionStorage.getItem(DENIAL_KEY) === '1'
    } catch { /* caller must use a no-ads URL if neither store works */ }
    return localSaved || sessionSaved
  }
  if (!localSaved) return false
  try { win.sessionStorage.removeItem(DENIAL_KEY) } catch { /* fail closed below */ }
  return localSaved && readConsent(win) === 'granted'
}
export function denialFallbackUrl(location) {
  const url = new URL(location.href)
  // The unknown query key makes this document ineligible. No user data is added.
  url.searchParams.set('marketing_consent', 'denied')
  return url.href
}
