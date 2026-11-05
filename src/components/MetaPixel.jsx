import { useEffect, useState } from 'react'
import { isAutomated } from '../lib/isAutomated'
import { eligibleLanding, loadTrainingPixel, revokeTrainingPixel, readConsent, saveConsent, denialFallbackUrl, TRAINING_PIXEL_ID, installMarketingLifecycleGuard } from '../lib/trainingAds'

// The owner selected the verified JIA training dataset for FirstAid.
// Ignore the unverified legacy environment ID instead of forwarding to it.
const PIXEL_ID = TRAINING_PIXEL_ID
const readChoice = () => readConsent(window)

export default function MetaPixel({ publicLanding = false }) {
  const [choice, setChoice] = useState(readChoice)
  const eligible = !isAutomated && publicLanding && !!PIXEL_ID
    && eligibleLanding(window.location, document.referrer)

  useEffect(() => installMarketingLifecycleGuard(window, document), [])

  useEffect(() => {
    if (eligible && choice === 'granted') {
      try {
        if (window.__firstaidMarketingLoaded && !window.__firstaidMarketingRevoked) window.fbq?.('consent', 'grant')
        else loadTrainingPixel(window, document, PIXEL_ID)
      } catch { /* never block learning */ }
    }
  }, [eligible, choice])

  if (!eligible) return null
  const choose = value => {
    const saved = saveConsent(window, value)
    if (value === 'granted' && saved && window.__firstaidMarketingRevoked) {
      if (window.__firstaidMarketingLoaded) { window.location.reload(); return }
      window.__firstaidMarketingRevoked = false
    }
    setChoice(value === 'granted' && !saved ? 'denied' : value)
    if (value === 'denied') {
      revokeTrainingPixel(window, document)
      if (!saved) window.location.replace(denialFallbackUrl(window.location))
      else if (window.__firstaidMarketingLoaded) window.location.reload()
    }
  }
  if (choice) return <button type="button" onClick={() => choose(choice === 'granted' ? 'denied' : 'granted')} style={{ position: 'fixed', zIndex: 1000, bottom: 78, right: 8, padding: 8, color: '#17212b', background: 'white', border: '1px solid #bbb', borderRadius: 8 }}>{choice === 'granted' ? 'ถอนความยินยอมวัดผลโฆษณา' : 'อนุญาตวัดผลโฆษณา'}</button>
  return <aside role="dialog" aria-label="การวัดผลโฆษณา" style={{ position: 'fixed', zIndex: 1000, bottom: 78, left: 12, right: 12, maxWidth: 580, margin: 'auto', padding: 16, color: '#17212b', background: 'white', border: '1px solid #bbb', borderRadius: 12, boxShadow: '0 4px 20px #0002' }}>
    <p>อนุญาตให้ Meta Pixel ของ JiaCPR Training วัดการเข้าชมและการกดติดต่อในหน้าแนะนำคอร์สนี้หรือไม่? Meta จะได้รับข้อมูลการเข้าชมและรหัสคุกกี้เพื่อวัดผลโฆษณา ไม่ส่งชื่อ เบอร์โทร คำตอบ หรือผลการเรียน คุณเรียนได้ตามปกติแม้ไม่อนุญาต</p>
    <button type="button" onClick={() => choose('denied')}>ไม่อนุญาต</button>{' · '}
    <button type="button" onClick={() => choose('granted')}>อนุญาต</button>
  </aside>
}
