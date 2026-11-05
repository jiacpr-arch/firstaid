// Separate keys ensure a vendor's grant never authorizes another vendor.
export function readVendorConsent(win, key) {
  let sessionReadable = false
  try {
    if (win.sessionStorage.getItem(key + '_denied') === '1') return 'denied'
    sessionReadable = true
  } catch { /* An unreadable per-tab denial must never become a grant. */ }
  try {
    const value = win.localStorage.getItem(key)
    if (value !== 'granted' && value !== 'denied') return null
    return value === 'granted' && !sessionReadable ? null : value
  } catch { return null }
}
export function saveVendorConsent(win, key, value) {
  if (value !== 'granted' && value !== 'denied') return false
  let localSaved = false
  try {
    win.localStorage.setItem(key, value)
    localSaved = win.localStorage.getItem(key) === value
  } catch { /* use session denial */ }
  if (value === 'denied') {
    let sessionSaved = false
    try {
      win.sessionStorage.setItem(key + '_denied', '1')
      sessionSaved = win.sessionStorage.getItem(key + '_denied') === '1'
    } catch { /* caller must use a no-ads URL if neither store works */ }
    return localSaved || sessionSaved
  }
  if (!localSaved) { saveVendorConsent(win, key, 'denied'); return false }
  try { win.sessionStorage.removeItem(key + '_denied') } catch {
    saveVendorConsent(win, key, 'denied')
    return false
  }
  if (readVendorConsent(win, key) === 'granted') return true
  saveVendorConsent(win, key, 'denied')
  return false
}
