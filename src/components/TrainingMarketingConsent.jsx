import { useEffect } from 'react'
import MetaPixel from './MetaPixel'
import GoogleTrainingConsent from './GoogleTrainingConsent'
import { installMarketingLifecycleGuard } from '../lib/trainingAds'
import { installMarketingConsentStorageGuard, revokeTrainingMarketing } from '../lib/trainingMarketing'

// One scrollable container prevents independent vendor controls overlapping.
export default function TrainingMarketingConsent({ publicLanding = false }) {
  useEffect(() => {
    const lifecycle = installMarketingLifecycleGuard(window, document, revokeTrainingMarketing)
    const storage = installMarketingConsentStorageGuard(window, document)
    return () => { lifecycle(); storage() }
  }, [])
  return <div style={{ position: 'fixed', zIndex: 1000, bottom: 78, left: 12, right: 12, maxWidth: 580, maxHeight: '65vh', overflowY: 'auto', margin: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
    <MetaPixel publicLanding={publicLanding} />
    <GoogleTrainingConsent publicLanding={publicLanding} />
  </div>
}
