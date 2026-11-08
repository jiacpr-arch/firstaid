// Standalone entry: never import the learner app, authentication, PostHog or
// its persisted landing-page grants. All consent is explicit in this document.
export const RECEIPT_KEY = 'firstaid_purchase_receipt_v1'
export const RECEIPT_PATH = '/api/checkout/receipt-page'
export const RECEIPT_URL = 'https://firstaid.morroo.com' + RECEIPT_PATH
export const PIXEL_ID = '1277103750989853'
export const GA4_ID = 'G-H10PHV2XNG'
// Account-side Enhanced Measurement/automatic user-data detection has not been
// verified off for this shared stream. Do not activate Google until reviewed.
export const GOOGLE_PURCHASE_ENABLED = false
export const choiceKey = vendor => `firstaid_purchase_${vendor}_consent_v1`
export const attemptKey = (vendor, eventId) => `firstaid_purchase_attempt_v1:${vendor}:${eventId}`
const PAGE = { page_location: RECEIPT_URL, page_referrer: '', page_title: 'Purchase | JiaCPR Training' }
const DENIED = Object.freeze({ analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' })

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
      if (win.localStorage.getItem(choiceKey(vendor)) !== 'granted' || win.localStorage.getItem(key) !== null) return false
      win.localStorage.setItem(key, 'attempted')
      return win.localStorage.getItem(key) === 'attempted'
    })
  } catch { return false }
}

function script(doc, src) {
  const node = doc.createElement('script')
  node.async = true
  node.referrerPolicy = 'no-referrer'
  node.src = src
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

export function startGoogle(win, doc, receipt, isAllowed, { enabled = GOOGLE_PURCHASE_ENABLED } = {}) {
  if (!enabled || !isAllowed() || win.gtag || win.dataLayer || !validReceipt(receipt)) return false
  win.dataLayer = []
  win.gtag = function () {
    if (!isAllowed() && !(arguments[0] === 'consent' && arguments[1] === 'update' && arguments[2] === DENIED)) return
    win.dataLayer.push(arguments)
  }
  const gtag = win.gtag
  gtag('consent', 'default', { ...DENIED })
  gtag('set', 'ads_data_redaction', true)
  gtag('set', 'url_passthrough', false)
  gtag('set', 'user_data', null)
  gtag('set', 'linker', { domains: [], accept_incoming: false, decorate_forms: false })
  gtag('set', { ...PAGE, cookie_domain: 'firstaid.morroo.com', cookie_prefix: 'firstaid_purchase', allow_google_signals: false, allow_ad_personalization_signals: false })
  gtag('consent', 'update', { ...DENIED, analytics_storage: 'granted' })
  gtag('js', new Date())
  gtag('config', GA4_ID, { ...PAGE, send_page_view: false, user_data: null, cookie_domain: 'firstaid.morroo.com', cookie_prefix: 'firstaid_purchase', allow_google_signals: false, allow_ad_personalization_signals: false, allow_enhanced_conversions: false })
  // The existing Ads LINE action is NOT a Purchase destination.
  gtag('event', 'purchase', { ...PAGE, send_to: GA4_ID, user_data: null, transaction_id: receipt.eventId, value: receipt.value, currency: receipt.currency })
  script(doc, `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`)
  return true
}

export function bootReceipt(win, doc) {
  const status = doc.getElementById('status')
  const choices = doc.getElementById('choices')
  const allowed = { meta: false, google: false }
  const loaded = { meta: false, google: false }
  const pending = { meta: false, google: false }
  let retired = false, receipt = null
  const eligible = eligibleReceiptDocument(win, doc)
  const isAllowed = vendor => {
    try { return !retired && allowed[vendor] && win.location.href === RECEIPT_URL && !doc.referrer && win.localStorage.getItem(choiceKey(vendor)) === 'granted' } catch { return false }
  }
  const revoke = () => {
    retired = true
    allowed.meta = false; allowed.google = false
    if (loaded.meta) {
      try { if (!win.fbq?.callMethod) win.fbq?.queue?.splice(0); win.fbq?.('consent', 'revoke') } catch { /* teardown still required */ }
    }
    if (loaded.google) {
      win[`ga-disable-${GA4_ID}`] = true
      try { win.dataLayer?.splice(0); win.gtag?.('consent', 'update', DENIED) } catch { /* teardown still required */ }
    }
    receipt = null
  }
  const leave = href => { revoke(); win.location.replace(href) }
  win.addEventListener('pagehide', revoke)
  win.addEventListener('pageshow', event => { if (event.persisted) leave(RECEIPT_PATH) })
  win.addEventListener('storage', event => {
    if ((event.key === null || event.key === choiceKey('meta') || event.key === choiceKey('google'))
      && ((loaded.meta && !isAllowed('meta')) || (loaded.google && !isAllowed('google')))) leave(RECEIPT_PATH)
  })
  doc.addEventListener('click', event => {
    const anchor = event.target.closest?.('a[href]')
    if (!anchor || event.button > 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
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
  })()
  for (const button of doc.querySelectorAll('button[data-vendor]')) button.addEventListener('click', async () => {
    const vendor = button.dataset.vendor, choice = button.dataset.choice
    if (!receipt || retired || !['meta', 'google'].includes(vendor)) return
    const notice = doc.getElementById(vendor + '-status')
    if (choice === 'granted' && (loaded[vendor] || pending[vendor])) return
    if (choice === 'granted' && vendor === 'google' && !GOOGLE_PURCHASE_ENABLED) {
      notice.textContent = 'ยังไม่เปิดการวัดการซื้อผ่าน Google คุณเรียนต่อได้ตามปกติ'
      return
    }
    allowed[vendor] = false
    let saved = false
    try { win.localStorage.setItem(choiceKey(vendor), choice); saved = win.localStorage.getItem(choiceKey(vendor)) === choice } catch { /* fail closed */ }
    if (choice !== 'granted' || !saved) {
      notice.textContent = 'ไม่ส่งข้อมูลการซื้อ คุณเรียนต่อได้ตามปกติ'
      if (loaded.meta || loaded.google) leave(RECEIPT_PATH)
      return
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
    const started = vendor === 'meta' ? startMeta(win, doc, receipt, () => isAllowed(vendor)) : startGoogle(win, doc, receipt, () => isAllowed(vendor))
    notice.textContent = started ? 'อนุญาตการวัดผลครั้งนี้แล้ว' : 'ไม่ได้ส่งข้อมูล คุณเรียนต่อได้ตามปกติ'
  })
  return { ready, revoke }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') bootReceipt(window, document)
