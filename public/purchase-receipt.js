import { clearBroadGoogleCookies, googleCookieFlags, GOOGLE_CONSENT_KEY, readGoogleGrant, remainingGoogleSeconds, clearGoogleCookies, retainGoogleAttribution, saveGoogleChoice } from './google-attribution.js'

// Standalone entry: never import the learner app, authentication, PostHog or
// any automatic consent reuse. All consent is explicit in this document.
export const RECEIPT_KEY = 'firstaid_purchase_receipt_v1'
export const RECEIPT_PATH = '/api/checkout/receipt-page'
export const RECEIPT_URL = 'https://firstaid.morroo.com' + RECEIPT_PATH
export const PIXEL_ID = '1277103750989853'
export const GA4_ID = 'G-H10PHV2XNG'
export const GTM_ID = 'GTM-54LV8DZ5'
export const GOOGLE_PURCHASE_EVENT = 'firstaid_receipt_purchase'
export const GOOGLE_ADS_PURCHASE_EVENT = 'firstaid_receipt_ads_purchase'
// Verified Training GA4-only destination. Shared automatic detectors remain on;
// the isolated page has no personal fields and requires its own fresh consent.
// This dedicated container must be reviewed and published before deployment.
// No Ads destination or shared GTM container is configured here.
export const GOOGLE_PURCHASE_ENABLED = true
export const choiceKey = vendor => `firstaid_purchase_${vendor}_consent_v${vendor === 'google' ? 2 : 1}`
export const attemptKey = (vendor, eventId) => `firstaid_purchase_attempt_v1:${vendor}:${eventId}`
const PAGE = { page_location: RECEIPT_URL, page_referrer: '', page_title: 'Purchase | JiaCPR Training' }
const DENIED = Object.freeze({ analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' })
function googleGrantSnapshot(win) {
  try { return readGoogleGrant(win)?.mode === 'ads' ? win.localStorage.getItem(GOOGLE_CONSENT_KEY) : null } catch { return null }
}

export function eligibleReceiptDocument(win, doc) {
  return win.location.href === RECEIPT_URL && !doc.referrer && !win.fbq && !win.gtag && !win.dataLayer
    && !win.__firstaidMarketingLoaded && !win.__firstaidPrivateDocument && !win.navigator.webdriver
}

export function validReceipt(p, now = Date.now()) {
  return !!p && Object.keys(p).sort().join(',') === 'currency,eventId,expiresAt,value'
    && /^fa_purchase_[a-f0-9]{64}$/.test(p.eventId) && p.currency === 'THB'
    && Number.isFinite(p.value) && p.value > 0 && Number.isSafeInteger(p.expiresAt)
    && p.expiresAt * 1000 > now && p.expiresAt * 1000 <= now + 900_000
}

export async function consumeReceipt(win, request = win.fetch.bind(win)) {
  let token
  try {
    token = win.sessionStorage.getItem(RECEIPT_KEY)
    win.sessionStorage.removeItem(RECEIPT_KEY)
    if (win.sessionStorage.getItem(RECEIPT_KEY) !== null) return null
  } catch { return null }
  if (typeof token !== 'string' || token.length > 1024 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return null
  try {
    const response = await request('/api/checkout/receipt', {
      method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ receipt: token }),
    })
    token = null
    const payload = await response.json()
    return response.ok && validReceipt(payload) ? payload : null
  } catch { return null } finally { token = null }
}

// At-most-once *attempt*, not a delivery receipt. Claim before initializing a
// vendor and never retry uncertain sends. Unsupported locks/storage fail closed.
export async function claimAttempt(win, vendor, receipt) {
  if (!['meta', 'google'].includes(vendor) || !validReceipt(receipt) || !win.navigator.locks?.request) return false
  const key = attemptKey(vendor, receipt.eventId)
  try {
    return await win.navigator.locks.request(key, { mode: 'exclusive' }, () => {
      const choice = win.localStorage.getItem(choiceKey(vendor))
      if (!(vendor === 'google' ? ['analytics', 'ads'].includes(choice) : choice === 'granted') || win.localStorage.getItem(key) !== null) return false
      if (vendor === 'google' && choice === 'ads' && (readGoogleGrant(win)?.mode !== 'ads' || remainingGoogleSeconds(win) < 1)) return false
      win.localStorage.setItem(key, 'attempted')
      return win.localStorage.getItem(key) === 'attempted'
    })
  } catch { return false }
}

function script(doc, src, onload) {
  const node = doc.createElement('script')
  node.async = true
  node.referrerPolicy = 'no-referrer'
  node.src = src
  if (onload) node.onload = onload
  doc.head.appendChild(node)
}

export function startMeta(win, doc, receipt, isAllowed) {
  if (!isAllowed() || win.fbq || !validReceipt(receipt)) return false
  const fbq = win.fbq = function (...args) {
    if (!isAllowed() && !(args[0] === 'consent' && args[1] === 'revoke')) return
    if (fbq.callMethod) fbq.callMethod(...args)
    else fbq.queue.push(args)
  }
  fbq.queue = []; fbq.loaded = true; fbq.version = '2.0'; win._fbq = fbq
  fbq('set', 'autoConfig', false, PIXEL_ID)
  fbq('consent', 'grant')
  fbq('init', PIXEL_ID)
  fbq('trackSingle', PIXEL_ID, 'Purchase', { value: receipt.value, currency: receipt.currency }, { eventID: receipt.eventId })
  script(doc, 'https://connect.facebook.net/en_US/fbevents.js')
  return true
}

export function startGoogle(win, doc, receipt, isAllowed, { enabled = GOOGLE_PURCHASE_ENABLED, mode = 'analytics' } = {}) {
  if (!enabled || !isAllowed() || win.gtag || win.dataLayer || !validReceipt(receipt)) return false
  if (!['analytics', 'ads'].includes(mode)) return false
  const ads = mode === 'ads'
  if (ads && (readGoogleGrant(win)?.mode !== 'ads' || remainingGoogleSeconds(win) < 1)) return false
  const landingGrant = ads ? googleGrantSnapshot(win) : null
  const authorized = () => isAllowed() && validReceipt(receipt) && (!ads || (remainingGoogleSeconds(win) > 0 && googleGrantSnapshot(win) === landingGrant))
  const prefix = ads ? 'firstaid_attribution_v2' : 'firstaid_purchase'
  const seconds = ads ? remainingGoogleSeconds(win) : Math.floor((receipt.expiresAt * 1000 - Date.now()) / 1000)
  if (seconds < 1 || seconds > 86400) return false
  const deadline = ads ? readGoogleGrant(win)?.expiresAt : receipt.expiresAt * 1000
  if (!clearBroadGoogleCookies(doc, prefix)) return false
  const flags = googleCookieFlags(deadline)
  if (!flags) return false
  // Contract for Version-1 native GTM data-layer variables: exact types.
  // One flat custom event owns setup + purchase in the dedicated container.
  const purchase = {
    event: ads ? GOOGLE_ADS_PURCHASE_EVENT : GOOGLE_PURCHASE_EVENT,
    fa_receipt_transaction_id: receipt.eventId,
    fa_receipt_value: receipt.value,
    fa_receipt_cookie_prefix: prefix,
    fa_receipt_ads_measurement: ads ? 'granted' : 'denied',
    fa_receipt_cookie_expires: seconds,
    fa_receipt_cookie_flags: flags,
    fa_receipt_false: false,
    fa_receipt_true: true,
    fa_receipt_null: null,
    fa_receipt_empty: '',
    fa_receipt_linker: { domains: [], accept_incoming: false, decorate_forms: false },
  }
  win.dataLayer = []
  win.gtag = function () {
    if (!authorized() && !(arguments[0] === 'consent' && arguments[1] === 'update' && arguments[2] === DENIED)) return
    win.dataLayer.push(arguments)
  }
  const gtag = win.gtag
  gtag('consent', 'default', { ...DENIED })
  gtag('set', 'ads_data_redaction', true)
  gtag('set', 'url_passthrough', false)
  gtag('set', 'user_data', null)
  gtag('set', 'linker', { domains: [], accept_incoming: false, decorate_forms: false })
  gtag('set', { ...PAGE, cookie_domain: 'firstaid.morroo.com', cookie_prefix: prefix, cookie_expires: seconds, cookie_flags: flags, cookie_update: false, allow_google_signals: false, allow_ad_personalization_signals: false, allow_enhanced_conversions: false, send_page_view: false })
  gtag('consent', 'update', { ...DENIED, analytics_storage: 'granted', ...(ads ? { ad_storage: 'granted', ad_user_data: 'granted' } : {}) })
  // The native Google runtime requires this bootstrap for initialization. The
  // dedicated container has no tags triggered by it; purchase still waits below.
  win.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' })
  let emitted = false
  // Loading can finish after withdrawal, navigation or receipt expiry. Never
  // retry a failed/uncertain attempt, and never let a repeated callback replay it.
  script(doc, `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`, () => {
    if (emitted || !authorized()) return
    purchase.fa_receipt_cookie_expires = ads ? remainingGoogleSeconds(win) : Math.floor((receipt.expiresAt * 1000 - Date.now()) / 1000)
    if (purchase.fa_receipt_cookie_expires < 1) return
    emitted = true
    win.dataLayer.push(purchase)
  })
  return true
}

export function bootReceipt(win, doc) {
  const status = doc.getElementById('status')
  const choices = doc.getElementById('choices')
  const allowed = { meta: false, google: false }
  const loaded = { meta: false, google: false }
  const pending = { meta: false, google: false }
  let retired = false, receipt = null, googleMode = null, googleLandingGrant = null, expiryTimer
  const adsAvailable = () => readGoogleGrant(win)?.mode === 'ads' && remainingGoogleSeconds(win) > 0
  const eligible = eligibleReceiptDocument(win, doc)
  const isAllowed = vendor => {
    try { return !retired && !!receipt && validReceipt(receipt) && allowed[vendor] && win.location.href === RECEIPT_URL && !doc.referrer
      && win.localStorage.getItem(choiceKey(vendor)) === (vendor === 'google' ? googleMode : 'granted')
      && (vendor !== 'google' || googleMode !== 'ads' || (adsAvailable() && googleGrantSnapshot(win) === googleLandingGrant)) } catch { return false }
  }
  const revoke = () => {
    retired = true
    if (expiryTimer) win.clearTimeout?.(expiryTimer)
    allowed.meta = false; allowed.google = false
    if (loaded.meta) {
      try { if (!win.fbq?.callMethod) win.fbq?.queue?.splice(0); win.fbq?.('consent', 'revoke') } catch { /* teardown still required */ }
    }
    if (loaded.google) {
      win[`ga-disable-${GA4_ID}`] = true
      try { win.dataLayer?.splice(0); win.gtag?.('consent', 'update', DENIED) } catch { /* teardown still required */ }
    }
    if (googleMode === 'ads' && adsAvailable()) retainGoogleAttribution(win, doc)
    else clearGoogleCookies(doc, ['firstaid_purchase'])
    receipt = null
  }
  const leave = href => { revoke(); win.location.replace(href) }
  win.addEventListener('pagehide', revoke)
  win.addEventListener('pageshow', event => { if (event.persisted) leave(RECEIPT_PATH) })
  win.addEventListener('storage', event => {
    if ((event.key === null || event.key === GOOGLE_CONSENT_KEY) && (!adsAvailable() || (googleMode === 'ads' && googleGrantSnapshot(win) !== googleLandingGrant))) {
      clearGoogleCookies(doc)
      if (googleMode === 'ads' && (loaded.google || pending.google)) { leave(RECEIPT_PATH); return }
      for (const button of doc.querySelectorAll('button[data-choice="ads"]')) button.disabled = true
    }
    if ((event.key === null || event.key === choiceKey('meta') || event.key === choiceKey('google'))
      && ((loaded.meta && !isAllowed('meta')) || (loaded.google && !isAllowed('google')))) leave(RECEIPT_PATH)
  })
  doc.addEventListener('click', event => {
    const anchor = event.target.closest?.('a[href]')
    if (!anchor || anchor.target === '_blank' || event.button > 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    event.preventDefault(); event.stopImmediatePropagation(); leave('/learn')
  }, true)
  // This document has no SPA routes. Even programmatic history must discard it.
  for (const method of ['pushState', 'replaceState']) win.history[method] = () => leave(RECEIPT_PATH)
  win.addEventListener('popstate', () => leave(RECEIPT_PATH), true)
  win.addEventListener('hashchange', () => leave(RECEIPT_PATH), true)

  const ready = (async () => {
    const candidate = await consumeReceipt(win)
    if (!eligible || retired || !candidate) {
      status.textContent = 'ไม่มีรายการสำหรับวัดผลในหน้านี้ ไปหน้าบทเรียนเพื่อตรวจสอบสิทธิ์ได้ตามปกติ'
      return
    }
    receipt = candidate
    doc.getElementById('title').textContent = 'ชำระเงินสำเร็จ ปลดล็อกแล้ว'
    status.textContent = `ยอดชำระ ${receipt.value.toFixed(2)} บาท`
    choices.hidden = false
    for (const button of doc.querySelectorAll('button[data-choice="ads"]')) button.disabled = !adsAvailable()
    const lifetime = Math.min(receipt.expiresAt * 1000 - Date.now(), adsAvailable() ? remainingGoogleSeconds(win) * 1000 : Infinity)
    expiryTimer = win.setTimeout?.(() => { clearGoogleCookies(doc); leave(RECEIPT_PATH) }, Math.max(1, lifetime))
  })()
  for (const button of doc.querySelectorAll('button[data-vendor]')) button.addEventListener('click', async () => {
    const vendor = button.dataset.vendor, choice = button.dataset.choice
    if (!receipt || retired || !['meta', 'google'].includes(vendor)) return
    const notice = doc.getElementById(vendor + '-status')
    const granting = vendor === 'google' ? ['analytics', 'ads'].includes(choice) : choice === 'granted'
    if (granting && (loaded[vendor] || pending[vendor])) return
    if (vendor === 'google' && choice === 'ads' && !adsAvailable()) { notice.textContent = 'ไม่มีความยินยอมเชื่อมโฆษณาที่ยังใช้งานได้ กรุณาเลือกวัดยอดซื้ออย่างเดียว'; return }
    if (vendor === 'google' && choice === 'denied') saveGoogleChoice(win, doc, 'denied')
    if (granting && vendor === 'google' && !GOOGLE_PURCHASE_ENABLED) {
      notice.textContent = 'ยังไม่เปิดการวัดการซื้อผ่าน Google คุณเรียนต่อได้ตามปกติ'
      return
    }
    allowed[vendor] = false
    let saved = false
    try { win.localStorage.setItem(choiceKey(vendor), choice); saved = win.localStorage.getItem(choiceKey(vendor)) === choice } catch { /* fail closed */ }
    if (!granting || !saved) {
      if (vendor === 'google') saveGoogleChoice(win, doc, 'denied')
      notice.textContent = 'ไม่ส่งข้อมูลการซื้อ คุณเรียนต่อได้ตามปกติ'
      if (loaded.meta || loaded.google) leave(RECEIPT_PATH)
      return
    }
    if (vendor === 'google') {
      googleMode = choice
      googleLandingGrant = choice === 'ads' ? googleGrantSnapshot(win) : null
      clearGoogleCookies(doc, ['firstaid_purchase'])
    }
    allowed[vendor] = true
    pending[vendor] = true
    if (!(await claimAttempt(win, vendor, receipt)) || !isAllowed(vendor) || !receipt) {
      pending[vendor] = false
      allowed[vendor] = false
      notice.textContent = 'ไม่ได้ส่งซ้ำ หรือเบราว์เซอร์ไม่พร้อมสำหรับการวัดผล คุณเรียนต่อได้ตามปกติ'
      return
    }
    loaded[vendor] = true
    pending[vendor] = false
    const started = vendor === 'meta' ? startMeta(win, doc, receipt, () => isAllowed(vendor)) : startGoogle(win, doc, receipt, () => isAllowed(vendor), { mode: googleMode })
    notice.textContent = started ? 'อนุญาตการวัดผลครั้งนี้แล้ว' : 'ไม่ได้ส่งข้อมูล คุณเรียนต่อได้ตามปกติ'
  })
  return { ready, revoke }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') bootReceipt(window, document)
