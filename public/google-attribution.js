// Shared by the isolated receipt and app. No SDK, learner data or identifiers
// are stored here. v1 grants never authorize this new measurement purpose.
export const GOOGLE_CONSENT_KEY = 'firstaid_jia_training_google_consent_v2'
export const ATTRIBUTION_TTL = 86400000
const notify = win => { if (win.Event) win.dispatchEvent?.(new win.Event('firstaid-google-consent-change')) }
export const GOOGLE_PREFIXES = ['firstaid_training', 'firstaid_attribution_v2', 'firstaid_analytics', 'firstaid_purchase']
export function readGoogleGrant(win, now = Date.now()) {
  try {
    if (win.sessionStorage.getItem(GOOGLE_CONSENT_KEY + '_denied') === '1') return null
    const p = JSON.parse(win.localStorage.getItem(GOOGLE_CONSENT_KEY))
    return p && Object.keys(p).sort().join(',') === 'expiresAt,issuedAt,mode,version'
      && p.version === 2 && ['analytics', 'ads'].includes(p.mode)
      && Number.isSafeInteger(p.issuedAt) && Number.isSafeInteger(p.expiresAt)
      && p.issuedAt <= now && p.expiresAt > now && p.expiresAt - p.issuedAt === ATTRIBUTION_TTL ? p : null
  } catch { return null }
}
export function clearGoogleCookies(doc, prefixes = GOOGLE_PREFIXES) {
  let names = prefixes.flatMap(prefix => ['_ga', '_ga_H10PHV2XNG', '_gcl_au', '_gcl_aw', '_gcl_dc', '_gcl_gb', '_aw', '_dc', '_gs', '_gb', '_ag', '_au'].map(suffix => prefix + suffix))
  try { names.push(...doc.cookie.split(';').map(x => x.trim().split('=')[0]).filter(n => prefixes.some(p => n.startsWith(p + '_')))) } catch { /* fail closed elsewhere */ }
  for (const name of new Set(names)) for (const domain of ['', '; Domain=firstaid.morroo.com', '; Domain=.morroo.com']) {
    try { doc.cookie = `${name}=; Max-Age=0; Path=/${domain}` } catch { /* storage unavailable */ }
  }
}
export function readGoogleChoice(win) {
  const grant = readGoogleGrant(win)
  if (grant) return grant.mode
  try { return win.sessionStorage.getItem(GOOGLE_CONSENT_KEY + '_denied') === '1' || win.localStorage.getItem(GOOGLE_CONSENT_KEY) === 'denied' ? 'denied' : null } catch { return null }
}
export function saveGoogleChoice(win, doc, mode, now = Date.now()) {
  if (!['analytics', 'ads', 'denied'].includes(mode)) return false
  // New grants start new identities; expired/legacy cookies are never adopted.
  clearGoogleCookies(doc)
  if (mode === 'denied') {
    let saved = false
    try { win.localStorage.setItem(GOOGLE_CONSENT_KEY, 'denied'); saved = win.localStorage.getItem(GOOGLE_CONSENT_KEY) === 'denied' } catch { /* session denial */ }
    try { win.sessionStorage.setItem(GOOGLE_CONSENT_KEY + '_denied', '1'); saved ||= win.sessionStorage.getItem(GOOGLE_CONSENT_KEY + '_denied') === '1' } catch { /* caller must leave safely */ }
    notify(win)
    return saved
  }
  const value = JSON.stringify({ version: 2, mode, issuedAt: now, expiresAt: now + ATTRIBUTION_TTL })
  try {
    win.localStorage.setItem(GOOGLE_CONSENT_KEY, value)
    win.sessionStorage.removeItem(GOOGLE_CONSENT_KEY + '_denied')
    if (win.localStorage.getItem(GOOGLE_CONSENT_KEY) === value && readGoogleGrant(win, now)?.mode === mode) { notify(win); return true }
  } catch { /* fail closed */ }
  saveGoogleChoice(win, doc, 'denied', now)
  return false
}
export function remainingGoogleSeconds(win, now = Date.now()) {
  const grant = readGoogleGrant(win, now)
  return grant ? Math.max(0, Math.floor((grant.expiresAt - now) / 1000) - 2) : 0
}
// Clamp SDK-created cookies before leaving a public document. Never copy them
// to application storage, signed receipts, payment metadata or network calls.
export function retainGoogleAttribution(win, doc, now = Date.now()) {
  const grant = readGoogleGrant(win, now), seconds = remainingGoogleSeconds(win, now)
  if (grant?.mode !== 'ads' || seconds < 1) { clearGoogleCookies(doc); return false }
  clearGoogleCookies(doc, ['firstaid_training', 'firstaid_analytics'])
  // SDK cookie_flags carry the absolute deadline, including delayed execution. Never
  // copy document.cookie values across domains during navigation.
  return true
}
// Safe on private pages: storage/cookie cleanup only, never imports an SDK.
export function installGoogleExpiryGuard(win, doc, onExpiry = () => {}) {
  let timer
  const check = () => {
    if (timer) win.clearTimeout?.(timer)
    const seconds = remainingGoogleSeconds(win)
    if (!seconds) { clearGoogleCookies(doc, ['firstaid_training', 'firstaid_attribution_v2', 'firstaid_analytics']); onExpiry(); return }
    if (readGoogleGrant(win)?.mode !== 'ads') clearGoogleCookies(doc, ['firstaid_training', 'firstaid_attribution_v2'])
    timer = win.setTimeout?.(check, seconds * 1000 + 1)
  }
  const storage = event => { if (event.key === null || event.key === GOOGLE_CONSENT_KEY) check() }
  check()
  win.addEventListener('storage', storage)
  win.addEventListener('pageshow', check)
  win.addEventListener('firstaid-google-consent-change', check)
  return () => { if (timer) win.clearTimeout?.(timer); win.removeEventListener('storage', storage); win.removeEventListener('pageshow', check); win.removeEventListener('firstaid-google-consent-change', check) }
}

// Supported SDK flags set absolute cookie expiry, including delayed script loads.
export function googleCookieFlags(expiresAt) {
  return Number.isSafeInteger(expiresAt) && expiresAt > Date.now()
    ? 'SameSite=Lax;Secure;Expires=' + new Date(expiresAt).toUTCString() : null
}

// A retained grant must not adopt same-name cookies from the parent domain.
// Delete only this app's owned namespace at the broader domain, preserving the
// exact firstaid host cookies and every unrelated site's cookies.
export function clearBroadGoogleCookies(doc, prefix) {
  if (!GOOGLE_PREFIXES.includes(prefix)) return false
  try {
    const names = new Set(['_ga','_ga_H10PHV2XNG','_aw','_dc','_gs','_gb','_ag','_au'].map(s => prefix + s))
    for (const part of doc.cookie.split(';')) {
      const name = part.trim().split('=')[0]
      if (name.startsWith(prefix + '_')) names.add(name)
    }
    for (const name of names) doc.cookie = `${name}=; Max-Age=0; Path=/; Domain=.morroo.com`
    return true
  } catch { return false }
}
