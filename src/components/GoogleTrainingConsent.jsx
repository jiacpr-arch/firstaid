import { useEffect, useRef, useState } from 'react'
import { isAutomated } from '../lib/isAutomated'
import { consentRow, consentButtons, consentBtn } from './consentStyles'
import { denialFallbackUrl, eligibleLanding } from '../lib/trainingAds'
import { GOOGLE_TRAINING_ENABLED, loadTrainingGoogle, readGoogleConsent, revokeTrainingGoogle, saveGoogleConsent } from '../lib/trainingGoogleAds'

export default function GoogleTrainingConsent({ publicLanding = false, onStatus, onRegister, showToggle = true, showDialog = true }) {
  const [choice, setChoice] = useState(() => readGoogleConsent(window))
  const eligible = GOOGLE_TRAINING_ENABLED && !isAutomated && publicLanding
    && eligibleLanding(window.location, document.referrer)
  useEffect(() => {
    if (eligible && ['analytics', 'ads'].includes(choice)) {
      try { loadTrainingGoogle(window, document, { publicLanding }) } catch { /* never block learning */ }
    }
  }, [eligible, choice, publicLanding])
  const status = !eligible ? null : choice ? 'decided' : 'pending'
  useEffect(() => { onStatus?.('google', status) }, [onStatus, status])
  // ปุ่มรวม "อนุญาตทั้งหมด/ไม่อนุญาตทั้งหมด" เรียก choose ของแต่ละเจ้า (ref = ฟังก์ชันล่าสุดเสมอ)
  const chooseRef = useRef(null)
  useEffect(() => { onRegister?.('google', value => chooseRef.current?.(value)); return () => onRegister?.('google', null) }, [onRegister])
  const choose = value => {
    if (value === choice && readGoogleConsent(window) === value) return
    const wasLoaded = window.__firstaidGoogleLoaded
    if (wasLoaded) revokeTrainingGoogle(window, document)
    const saved = saveGoogleConsent(window, value, document)
    if (['analytics', 'ads'].includes(value) && !saved) {
      setChoice('denied')
      revokeTrainingGoogle(window, document)
      const denialSaved = saveGoogleConsent(window, 'denied', document)
      // A failed save may still leave a partial local grant behind. Only a
      // verified denial makes this document safe to keep; otherwise use the
      // no-ads URL even though the visitor originally requested a grant.
      if (!denialSaved || readGoogleConsent(window) !== 'denied') window.location.replace(denialFallbackUrl(window.location))
      else if (window.__firstaidGoogleLoaded) window.location.reload()
      return
    }
    if (['analytics', 'ads'].includes(value) && saved && window.__firstaidGoogleRevoked) {
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
  if (choice && !showToggle) return null
  if (!choice && !showDialog) return null
  return <aside role="dialog" aria-label="การวัดผล Google" style={consentRow}>
    <div style={{ flex: '1 1 200px', minWidth: 0 }}>
      <b>Google: เลือกการวัดผล</b>
      <p style={{ margin: '6px 0' }}>สถิติอย่างเดียว: Google Analytics วัดการเข้าชมและกดติดต่อในหน้านี้ โดยไม่เชื่อมกับการซื้อ</p>
      <p style={{ margin: '6px 0' }}>สถิติและโฆษณา: Google Analytics และ Google Ads ของ JiaCPR Training รับรหัสคลิกโฆษณา รหัสคุกกี้/เบราว์เซอร์ ข้อมูลการเข้าชม IP และอุปกรณ์ เพื่อเชื่อมการเข้าชมกับยอดซื้อ สกุลเงิน และรหัสรายการแบบไม่เปิดเผยเลข Stripe เมื่อคุณอนุญาตอีกครั้งหลังซื้อ FirstAid ใช้คุกกี้ของเว็บไซต์เพื่อเชื่อมรายการไม่เกิน 24 ชั่วโมงนับจากการเลือกครั้งนี้ ข้อมูลที่ส่งแล้วและคุกกี้ของ Google อยู่ภายใต้นโยบาย Google การถอนหยุดการส่งครั้งต่อไป ไม่ลบข้อมูลที่ส่งแล้ว ไม่ส่งชื่อ อีเมล เบอร์โทร หรือข้อมูลการเรียน และไม่ใช้โฆษณาเฉพาะบุคคล</p>
      <p style={{ margin: '6px 0' }}>เลือกไม่อนุญาตหรือถอนความยินยอมได้โดยไม่กระทบสิทธิ์เรียน ตัวเลือกนี้แยกจาก Meta และ OpenAI</p>
      <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">นโยบายความเป็นส่วนตัว Google</a>
    </div>
    <div style={consentButtons}>
      <button type="button" style={consentBtn(false)} onClick={() => choose('denied')}>ไม่อนุญาต / ถอนความยินยอม Google</button>
      <button type="button" style={consentBtn(false)} onClick={() => choose('analytics')}>Google สถิติอย่างเดียว</button>
      <button type="button" style={consentBtn(true)} onClick={() => choose('ads')}>Google สถิติและวัดผลโฆษณา</button>
    </div>
  </aside>
}
