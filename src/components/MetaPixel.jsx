import { useEffect, useRef, useState } from 'react'
import { isAutomated } from '../lib/isAutomated'
import { consentRow, consentButtons, consentBtn, consentToggle } from './consentStyles'
import { eligibleLanding, loadTrainingPixel, revokeTrainingPixel, readConsent, saveConsent, denialFallbackUrl, TRAINING_PIXEL_ID } from '../lib/trainingAds'

// The owner selected the verified JIA training dataset for FirstAid.
// Ignore the unverified legacy environment ID instead of forwarding to it.
const PIXEL_ID = TRAINING_PIXEL_ID
const readChoice = () => readConsent(window)

export default function MetaPixel({ publicLanding = false, onStatus, onRegister, showToggle = true, showDialog = true }) {
  const [choice, setChoice] = useState(readChoice)
  const eligible = !isAutomated && publicLanding && !!PIXEL_ID
    && eligibleLanding(window.location, document.referrer)

  useEffect(() => {
    if (eligible && choice === 'granted') {
      try {
        if (window.__firstaidMetaLoaded && !window.__firstaidMetaRevoked && !window.__firstaidMarketingRevoked) window.fbq?.('consent', 'grant')
        else loadTrainingPixel(window, document, PIXEL_ID)
      } catch { /* never block learning */ }
    }
  }, [eligible, choice])

  const status = !eligible ? null : choice ? 'decided' : 'pending'
  useEffect(() => { onStatus?.('meta', status) }, [onStatus, status])
  // ปุ่มรวม "อนุญาตทั้งหมด/ไม่อนุญาตทั้งหมด" เรียก choose ของแต่ละเจ้า (ref = ฟังก์ชันล่าสุดเสมอ)
  const chooseRef = useRef(null)
  useEffect(() => { onRegister?.('meta', value => chooseRef.current?.(value)); return () => onRegister?.('meta', null) }, [onRegister])

  const choose = value => {
    const saved = saveConsent(window, value)
    if (value === 'granted' && !saved) {
      setChoice('denied')
      revokeTrainingPixel(window, document)
      const denialSaved = saveConsent(window, 'denied')
      // A failed save may still leave a partial local grant behind. Only a
      // verified denial makes this document safe to keep; otherwise use the
      // no-ads URL even though the visitor originally requested a grant.
      if (!denialSaved || readConsent(window) !== 'denied') window.location.replace(denialFallbackUrl(window.location))
      else if (window.__firstaidMetaLoaded) window.location.reload()
      return
    }
    if (value === 'granted' && saved && window.__firstaidMetaRevoked) {
      if (window.__firstaidMetaLoaded) { window.location.reload(); return }
      window.__firstaidMetaRevoked = false
    }
    setChoice(value)
    if (value === 'denied') {
      revokeTrainingPixel(window, document)
      if (!saved || readConsent(window) !== 'denied') window.location.replace(denialFallbackUrl(window.location))
      else if (window.__firstaidMetaLoaded) window.location.reload()
    }
  }
  useEffect(() => { chooseRef.current = choose })
  if (!eligible) return null
  if (choice) {
    if (!showToggle) return null
    return <button type="button" onClick={() => choose(choice === 'granted' ? 'denied' : 'granted')} style={consentToggle}>{choice === 'granted' ? 'ถอนความยินยอมวัดผลโฆษณา' : 'อนุญาตวัดผลโฆษณา'}</button>
  }
  if (!showDialog) return null
  return <aside role="dialog" aria-label="การวัดผลโฆษณา" style={consentRow}>
    <details style={{ flex: '1 1 200px', minWidth: 0 }}>
      <summary style={{ cursor: 'pointer' }}><b>Meta</b> — วัดการเข้าชมหน้านี้เพื่อดูผลโฆษณา</summary>
      <p style={{ margin: '6px 0 0' }}>อนุญาตให้ Meta Pixel ของ JiaCPR Training วัดการเข้าชมและการกดติดต่อในหน้าแนะนำคอร์สนี้หรือไม่? Meta จะได้รับข้อมูลการเข้าชมและรหัสคุกกี้เพื่อวัดผลโฆษณา ไม่ส่งชื่อ เบอร์โทร คำตอบ หรือผลการเรียน คุณเรียนได้ตามปกติแม้ไม่อนุญาต</p>
    </details>
    <div style={consentButtons}>
      <button type="button" style={consentBtn(false)} onClick={() => choose('denied')}>ไม่อนุญาต</button>
      <button type="button" style={consentBtn(true)} onClick={() => choose('granted')}>อนุญาต</button>
    </div>
  </aside>
}
