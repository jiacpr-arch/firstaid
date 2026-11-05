import { useEffect, useState } from 'react'
import { isAutomated } from '../lib/isAutomated'
import { CONSENT_KEY, eligibleLanding, loadTrainingPixel, revokeTrainingPixel } from '../lib/trainingAds'

// Legacy VITE_META_PIXEL_ID=1524889459310260 has unverified ownership.
// Preserve that deployment config, but fail closed until an owner-approved
// FirstAid dataset is verified and recorded here. Never infer another site's ID.
const VERIFIED_META_PIXEL_ID = ''
const PIXEL_ID = VERIFIED_META_PIXEL_ID && import.meta.env.VITE_META_PIXEL_ID === VERIFIED_META_PIXEL_ID
  ? VERIFIED_META_PIXEL_ID : ''
const readChoice = () => { try { return localStorage.getItem(CONSENT_KEY) } catch { return null } }

export default function MetaPixel({ publicLanding = false }) {
  const [choice, setChoice] = useState(readChoice)
  const eligible = !isAutomated && publicLanding && !!PIXEL_ID
    && eligibleLanding(window.location, document.referrer)

  useEffect(() => {
    if (eligible && choice === 'granted') {
      try { loadTrainingPixel(window, document, PIXEL_ID) } catch { /* never block learning */ }
    }
  }, [eligible, choice])

  if (!eligible) return null
  const choose = value => {
    try { localStorage.setItem(CONSENT_KEY, value) } catch { /* memory-only choice */ }
    setChoice(value)
    if (value === 'denied' && window.__firstaidMarketingLoaded) {
      revokeTrainingPixel(window, document)
      window.location.reload()
    }
  }
  if (choice) return <button type="button" onClick={() => choose(choice === 'granted' ? 'denied' : 'granted')} style={{ position: 'fixed', zIndex: 1000, bottom: 78, right: 8, padding: 8, color: '#17212b', background: 'white', border: '1px solid #bbb', borderRadius: 8 }}>{choice === 'granted' ? 'ถอนความยินยอมวัดผลโฆษณา' : 'อนุญาตวัดผลโฆษณา'}</button>
  return <aside role="dialog" aria-label="การวัดผลโฆษณา" style={{ position: 'fixed', zIndex: 1000, bottom: 78, left: 12, right: 12, maxWidth: 580, margin: 'auto', padding: 16, color: '#17212b', background: 'white', border: '1px solid #bbb', borderRadius: 12, boxShadow: '0 4px 20px #0002' }}>
    <p>อนุญาตให้ใช้ Meta Pixel วัดการเข้าชมหน้าแนะนำคอร์สและการกดติดต่อเพื่อปรับปรุงโฆษณาหรือไม่? ไม่ส่งข้อมูลส่วนตัว คำตอบ หรือผลการเรียน คุณเรียนได้ตามปกติแม้ไม่อนุญาต</p>
    <button type="button" onClick={() => choose('denied')}>ไม่อนุญาต</button>{' · '}
    <button type="button" onClick={() => choose('granted')}>อนุญาต</button>
  </aside>
}
