import { eligibleLanding } from './trainingAds.js'

// Install before Google can observe SPA history. A post-render redirect alone
// would expose a private URL to enhanced measurement's history listeners.
// Once Google loads, even public URL changes use a new document so automatic
// history collection cannot override the fixed page metadata with a new query.
export function installMarketingNavigationBoundary(win, doc, revokeAll) {
  // Later vendor loaders must join teardown even when another vendor installed
  // the boundary first. Never replace wrappers or drop earlier callbacks.
  const revokers = win.__firstaidNavigationRevokers ||= new Set()
  if (typeof revokeAll === 'function') revokers.add(revokeAll)
  if (win.__firstaidNavigationBoundary) return
  const unsafe = value => {
    try {
      const url = new URL(value, win.location.href)
      return url.origin === win.location.origin
        && (!eligibleLanding(url, doc.referrer) || (win.__firstaidGoogleLoaded && url.href !== win.location.href))
        ? url.href : null
    } catch { return null }
  }
  const leave = (href, replace = false) => {
    win.__firstaidPrivateDocument = true
    win.__firstaidMarketingNavigationTarget = href
    for (const revoke of revokers) {
      try { revoke(win, doc) } catch { /* Still revoke other vendors and leave. */ }
    }
    if (replace) win.location.replace(href)
    else win.location.assign(href)
  }
  for (const method of ['pushState', 'replaceState']) {
    const original = win.history[method]
    win.history[method] = function (...args) {
      const target = args[2] == null ? null : unsafe(args[2])
      if (target && win.__firstaidMarketingLoaded) { leave(target, method === 'replaceState'); return }
      return original.apply(this, args)
    }
  }
  doc.addEventListener('click', event => {
    if (!win.__firstaidMarketingLoaded || event.defaultPrevented || event.button > 0
      || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const anchor = event.target.closest?.('a[href]')
    if (!anchor || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return
    const target = unsafe(anchor.href)
    if (!target) return
    event.preventDefault()
    event.stopImmediatePropagation()
    leave(target)
  }, true)
  const onHistory = event => {
    if (!win.__firstaidMarketingLoaded) return
    const target = unsafe(win.location.href)
    if (!target) return
    event.stopImmediatePropagation()
    leave(target, true)
  }
  win.addEventListener('popstate', onHistory, true)
  win.addEventListener('hashchange', onHistory, true)
  win.__firstaidNavigationBoundary = true
}
