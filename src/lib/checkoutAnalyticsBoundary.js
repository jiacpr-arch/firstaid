// Payment return URLs and their referrers must not reach product analytics,
// including delayed SDK events and identify calls from the application shell.
export function isCheckoutAnalyticsUrl(value) {
  if (typeof value !== 'string' || !value) return false
  try {
    const url = new URL(value, 'https://firstaid.morroo.com')
    return url.pathname === '/buy' || url.pathname.startsWith('/api/checkout/')
      || url.searchParams.has('session_id')
  } catch { return true }
}

export function checkoutAnalyticsBlocked(location, referrer = '') {
  return isCheckoutAnalyticsUrl(location?.href) || isCheckoutAnalyticsUrl(referrer)
}

export function filterCheckoutAnalyticsEvent(event, location, referrer = '') {
  // Replay can buffer a private screen and emit it only after navigation. This
  // app's learning/payment DOM must never be a product-analytics recording.
  if (event?.event === '$snapshot') return null
  if (checkoutAnalyticsBlocked(location, referrer)) return null
  const properties = event?.properties || {}
  for (const values of [properties, properties.$set, properties.$set_once]) {
    if (!values) continue
    for (const key of ['$current_url', '$referrer', '$initial_current_url', '$initial_referrer']) {
      if (isCheckoutAnalyticsUrl(values[key])) return null
    }
  }
  return event
}
