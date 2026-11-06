import { CONSENT_KEY, readConsent, revokeTrainingPixel } from './trainingAds.js'
import { GOOGLE_CONSENT_KEY, readGoogleConsent, revokeTrainingGoogle } from './trainingGoogleAds.js'

// This flag means the entire document is unsafe to reuse for marketing. A
// vendor-specific denial must never set it or grant/revoke the other vendor.
export function revokeTrainingMarketing(win, doc) {
  win.__firstaidMarketingRevoked = true
  revokeTrainingPixel(win, doc)
  revokeTrainingGoogle(win, doc)
}

// A withdrawal or localStorage.clear() in another tab must terminate this tab's
// loaded SDK as well. A grant in another tab never auto-loads an SDK here.
export function installMarketingConsentStorageGuard(win, doc) {
  const changed = event => {
    const metaDenied = (event.key === null || event.key === CONSENT_KEY)
      && win.__firstaidMetaLoaded && readConsent(win) !== 'granted'
    const googleDenied = (event.key === null || event.key === GOOGLE_CONSENT_KEY)
      && win.__firstaidGoogleLoaded && readGoogleConsent(win) !== 'granted'
    if (!metaDenied && !googleDenied) return
    revokeTrainingMarketing(win, doc)
    win.location.reload()
  }
  win.addEventListener('storage', changed)
  return () => win.removeEventListener('storage', changed)
}
