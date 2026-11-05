import { useEffect, useState } from 'react'
import { isAutomated } from '../lib/isAutomated'
import { denialFallbackUrl, eligibleLanding } from '../lib/trainingAds'
import { GOOGLE_TRAINING_ENABLED, loadTrainingGoogle, readGoogleConsent, revokeTrainingGoogle, saveGoogleConsent } from '../lib/trainingGoogleAds'

export default function GoogleTrainingConsent({ publicLanding = false }) {
  const [choice, setChoice] = useState(() => readGoogleConsent(window))
  const eligible = GOOGLE_TRAINING_ENABLED && !isAutomated && publicLanding
    && eligibleLanding(window.location, document.referrer)
  useEffect(() => {
    if (eligible && choice === 'granted') {
      try { loadTrainingGoogle(window, document, { publicLanding }) } catch { /* never block learning */ }
    }
  }, [eligible, choice, publicLanding])
  if (!eligible) return null
  const choose = value => {
    const saved = saveGoogleConsent(window, value)
    if (value === 'granted' && saved && window.__firstaidGoogleRevoked) {
      if (window.__firstaidGoogleLoaded) { window.location.reload(); return }
      window.__firstaidGoogleRevoked = false
    }
    setChoice(value === 'granted' && !saved ? 'denied' : value)
    if (value === 'denied') {
      revokeTrainingGoogle(window, document)
      if (!saved) window.location.replace(denialFallbackUrl(window.location))
      else if (window.__firstaidGoogleLoaded) window.location.reload()
    }
  }
  const style = { padding: 12, color: '#17212b', background: 'white', border: '1px solid #bbb', borderRadius: 12 }
  if (choice) return <button type="button" onClick={() => choose(choice === 'granted' ? 'denied' : 'granted')} style={style}>{choice === 'granted' ? 'ถอนความยินยอม Google' : 'อนุญาต Google'}</button>
  return <aside role="dialog" aria-label="การวัดผล Google" style={style}>
    <p>อนุญาตให้ Google Analytics และ Google Ads ของ JiaCPR Training วัดการเข้าชมและการกดติดต่อ LINE ในหน้าแนะนำคอร์สนี้หรือไม่? Google จะได้รับข้อมูลการเข้าชม รหัสคุกกี้ และข้อมูลอุปกรณ์เพื่อวัดผล ไม่ส่งชื่อ เบอร์โทร อีเมล คำตอบ หรือผลการเรียน และไม่ใช้เพื่อโฆษณาเฉพาะบุคคล ตัวเลือกนี้แยกจาก Meta คุณเรียนได้ตามปกติแม้ไม่อนุญาต</p>
    <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">นโยบายความเป็นส่วนตัว Google</a>{' · '}
    <button type="button" onClick={() => choose('denied')}>ไม่อนุญาต Google</button>{' · '}
    <button type="button" onClick={() => choose('granted')}>อนุญาต Google</button>
  </aside>
}
