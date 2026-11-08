// Only readiness is retained here. Never publish learner IDs or auth keys on
// window, in the DOM, or in vendor event data.
const pendingLookups = new WeakMap()
const activeLookups = new WeakMap()

export const entitlementLookupPending = win => pendingLookups.get(win) === true || (activeLookups.get(win) || 0) > 0
export function setEntitlementLookupReady(win, ready) {
  pendingLookups.set(win, !ready)
}

export function entitlementAllowsMarketing(win, state, expectedKey) {
  const privateResult = state.status === 'error' || state.chapters.size > 0 || state.cpr
  const ready = state.status === 'ok' && !state.loading && state.key === expectedKey && !privateResult
  if (privateResult || (win.__firstaidMarketingLoaded && !ready)) win.__firstaidPrivateDocument = true
  return ready && !entitlementLookupPending(win) && !win.__firstaidPrivateDocument
}

// Called synchronously before EVERY attempt, including retries and same-key
// refreshes. React's later render/layout effects are too late to guard fetch.
export function beginEntitlementLookup(win, retire) {
  setEntitlementLookupReady(win, false)
  if (!win.__firstaidMarketingLoaded) {
    activeLookups.set(win, (activeLookups.get(win) || 0) + 1)
    return true
  }
  win.__firstaidPrivateDocument = true
  retire()
  return false
}

export function finishEntitlementLookup(win) {
  activeLookups.set(win, Math.max(0, (activeLookups.get(win) || 0) - 1))
}

// Earlier GET URLs can retain a learner ID in Resource Timing after the lookup
// resolves. Clear and verify this buffer immediately before measurement starts.
// This is defense in depth, not a sandbox against same-origin SDK capabilities.
export function prepareMarketingResourceTimings(win) {
  if (entitlementLookupPending(win)) return false
  if (!win.performance) return false
  try {
    if (typeof win.performance.clearResourceTimings !== 'function' || typeof win.performance.getEntriesByType !== 'function') return false
    win.performance.clearResourceTimings()
    return win.performance.getEntriesByType('resource').length === 0
  } catch { return false }
}
