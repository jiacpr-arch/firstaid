import { readGoogleGrant } from '../../public/google-attribution.js'
import { OPENAI_CONSENT_KEY, readOpenAIConsent, revokeTrainingOpenAI } from './trainingOpenAIAds.js'
import { CONSENT_KEY, readConsent, revokeTrainingPixel } from './trainingAds.js'
import { GOOGLE_CONSENT_KEY, readGoogleConsent, revokeTrainingGoogle, retireTrainingGoogle } from './trainingGoogleAds.js'

// This flag means the entire document is unsafe to reuse for marketing. A
// vendor-specific denial must never set it or grant/revoke the other vendor.
export function revokeTrainingMarketing(win, doc) {
  win.__firstaidMarketingRevoked = true
  revokeTrainingPixel(win, doc)
  revokeTrainingGoogle(win, doc)
  revokeTrainingOpenAI(win)
}

export function retireTrainingMarketing(win, doc) {
  win.__firstaidMarketingRevoked = true
  revokeTrainingPixel(win, doc)
  retireTrainingGoogle(win, doc)
  revokeTrainingOpenAI(win)
}

// A withdrawal or localStorage.clear() in another tab must terminate this tab's
// loaded SDK as well. A grant in another tab never auto-loads an SDK here.
export function installMarketingConsentStorageGuard(win, doc) {
  const changed = event => {
    const metaDenied = (event.key === null || event.key === CONSENT_KEY)
      && win.__firstaidMetaLoaded && readConsent(win) !== 'granted'
    const googleDenied = (event.key === null || event.key === GOOGLE_CONSENT_KEY)
      && win.__firstaidGoogleLoaded && (!['analytics', 'ads'].includes(readGoogleConsent(win)) || JSON.stringify(readGoogleGrant(win)) !== win.__firstaidGoogleGrant)
    const openaiDenied = (event.key === null || event.key === OPENAI_CONSENT_KEY)
      && win.__firstaidOpenAILoaded && readOpenAIConsent(win) !== 'granted'
    if (!metaDenied && !googleDenied && !openaiDenied) return
    revokeTrainingMarketing(win, doc)
    win.location.reload()
  }
  win.addEventListener('storage', changed)
  return () => win.removeEventListener('storage', changed)
}
