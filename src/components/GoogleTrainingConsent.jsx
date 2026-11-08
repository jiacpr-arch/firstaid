import { useEffect, useRef, useState } from 'react'
import { isAutomated } from '../lib/isAutomated'
import { consentRow, consentButtons, consentBtn, consentToggle } from './consentStyles'
import { denialFallbackUrl, eligibleLanding } from '../lib/trainingAds'
import { GOOGLE_TRAINING_ENABLED, loadTrainingGoogle, readGoogleConsent, revokeTrainingGoogle, saveGoogleConsent } from '../lib/trainingGoogleAds'

export default function GoogleTrainingConsent({ publicLanding = false, onStatus, onRegister, showToggle = true, showDialog = true }) {
  const [choice, setChoice] = useState(() => readGoogleConsent(window))
  const eligible = GOOGLE_TRAINING_ENABLED && !isAutomated && publicLanding
    && eligibleLanding(window.location, document.referrer)
  useEffect(() => {
    if (eligible && choice === 'granted') {
      try { loadTrainingGoogle(window, document, { publicLanding }) } catch { /* never block learning */ }
    }
  }, [eligible, choice, publicLanding])
  const status = !eligible ? null : choice ? 'decided' : 'pending'
  useEffect(() => { onStatus?.('google', status) }, [onStatus, status])
  // ปุ่มรวม "อนุญาตทั้งหมด/ไม่อนุญาตทั้งหมด" เรียก choose ของแต่ละเจ้า (ref = ฟังก์ชันล่าสุดเสมอ)
  const chooseRef = useRef(null)
  useEffect(() => { onRegister?.('google', value => chooseRef.current?.(value)); return () => onRegister?.('google', null) }, [onRegister])
  const choose = value => {
    const saved = saveGoogleConsent(window, value)
    if (value === 'granted' && !saved) {
      setChoice('denied')
      revokeTrainingGoogle(window, document)
      const denialSaved = saveGoogleConsent(window, 'denied')
      // A failed save may still leave a partial local grant behind. Only a
      // verified denial makes this document safe to keep; otherwise use the
      // no-ads URL even though the visitor originally requested a grant.
      if (!denialSaved || readGoogleConsent(window) !== 'denied') window.location.replace(denialFallbackUrl(window.location))
      else if (window.__firstaidGoogleLoaded) window.location.reload()
      return
    }
    if (value === 'granted' && saved && window.__firstaidGoogleRevoked) {
      if (window.__firstaidGoogleLoaded) { window.location.reload(); return }
      window.__firstaidGoogleRevoked = false
    }
    setChoice(value)
    if (value === 'denied') {
      revokeTrainingGoogle(window, document)
      if (!saved || readGoogleConsent(window) !== 'denied') window.location.replace(denialFallbackUrl(window.location))
      else if (window.__firstaidGoogleLoaded) window.location.reload()
    }
  }
  useEffect(() => { chooseRef.current = choose })
  if (!eligible) return null
  if (choice) {
    if (!showToggle) return null
    return <button type="button" onClick={() => choose(choice === 'granted' ? 'denied' : 'granted')} style={consentToggle}>{choice === 'granted' ? 'ถอนความยินยอม Google' : 'อนุญาต Google'}</button>
  }
  if (!showDialog) return null
  return <aside role="dialog" aria-label="การวัดผล Google" style={consentRow}>
    <details style={{ flex: '1 1 200px', minWidth: 0 }}>
      <summary style={{ cursor: 'pointer' }}><b>Google</b> — Analytics และ Ads วัดการเข้าชมหน้านี้</summary>
      <p style={{ margin: '6px 0 0' }}>อนุญาตให้ Google Analytics และ Google Ads ของ JiaCPR Training วัดการเข้าชมและการกดติดต่อ LINE ในหน้าแนะนำคอร์สนี้หรือไม่? Google จะได้รับข้อมูลการเข้าชม รหัสคุกกี้ และข้อมูลอุปกรณ์เพื่อวัดผล ไม่ส่งชื่อ เบอร์โทร อีเมล คำตอบ หรือผลการเรียน และไม่ใช้เพื่อโฆษณาเฉพาะบุคคล ตัวเลือกนี้แยกจาก Meta คุณเรียนได้ตามปกติแม้ไม่อนุญาต</p>
      <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">นโยบายความเป็นส่วนตัว Google</a>
    </details>
    <div style={consentButtons}>
      <button type="button" style={consentBtn(false)} onClick={() => choose('denied')}>ไม่อนุญาต Google</button>
      <button type="button" style={consentBtn(true)} onClick={() => choose('granted')}>อนุญาต Google</button>
    </div>
  </aside>
}
