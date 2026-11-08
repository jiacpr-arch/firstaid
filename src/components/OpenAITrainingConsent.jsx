import { useEffect, useRef, useState } from 'react'
import { isAutomated } from '../lib/isAutomated'
import { consentRow, consentButtons, consentBtn, consentToggle } from './consentStyles'
import { applyOpenAIConsentChoice, eligibleOpenAIDocument, loadTrainingOpenAI, readOpenAIConsent } from '../lib/trainingOpenAIAds'

export default function OpenAITrainingConsent({ publicLanding = false, onStatus, onRegister, showToggle = true, showDialog = true }) {
  const [choice, setChoice] = useState(() => readOpenAIConsent(window))
  const eligible = !isAutomated && eligibleOpenAIDocument(window, document, publicLanding)
  useEffect(() => {
    if (eligible && choice === 'granted') loadTrainingOpenAI(window, document, { publicLanding })
  }, [eligible, choice, publicLanding])
  const status = !eligible ? null : choice ? 'decided' : 'pending'
  useEffect(() => { onStatus?.('openai', status) }, [onStatus, status])
  // ปุ่มรวม "อนุญาตทั้งหมด/ไม่อนุญาตทั้งหมด" เรียก choose ของแต่ละเจ้า (ref = ฟังก์ชันล่าสุดเสมอ)
  const chooseRef = useRef(null)
  useEffect(() => { onRegister?.('openai', value => chooseRef.current?.(value)); return () => onRegister?.('openai', null) }, [onRegister])
  const choose = value => setChoice(applyOpenAIConsentChoice(window, value))
  useEffect(() => { chooseRef.current = choose })
  if (!eligible) return null
  if (choice) {
    if (!showToggle) return null
    return <button type="button" onClick={() => choose(choice === 'granted' ? 'denied' : 'granted')} style={consentToggle}>{choice === 'granted' ? 'ถอนความยินยอม OpenAI' : 'อนุญาต OpenAI'}</button>
  }
  if (!showDialog) return null
  return <aside role="dialog" aria-label="การวัดผล OpenAI" style={consentRow}>
    <details style={{ flex: '1 1 200px', minWidth: 0 }}>
      <summary style={{ cursor: 'pointer' }}><b>OpenAI</b> — รูปภาพวัดผลการเข้าชมหน้านี้</summary>
      <p style={{ margin: '6px 0 0' }}>อนุญาตให้ OpenAI รับข้อมูลการเข้าชมหน้าแนะนำคอร์สนี้ผ่านรูปภาพวัดผลโฆษณาหรือไม่? คำขอรูปภาพส่งชื่อเว็บไซต์ ข้อมูลเบราว์เซอร์ และ IP ไม่ส่งชื่อ เบอร์โทร อีเมล ข้อมูลผู้เรียน หรือผลการเรียน ไม่ติดตามการกด LINE ตัวเลือกนี้แยกจาก Meta และ Google คุณเรียนได้ตามปกติแม้ไม่อนุญาต และถอนความยินยอมสำหรับการส่งครั้งต่อไปได้</p>
      <a href="https://openai.com/policies/privacy-policy/" target="_blank" rel="noopener noreferrer">นโยบายความเป็นส่วนตัว OpenAI</a>
    </details>
    <div style={consentButtons}>
      <button type="button" style={consentBtn(false)} onClick={() => choose('denied')}>ไม่อนุญาต OpenAI</button>
      <button type="button" style={consentBtn(true)} onClick={() => choose('granted')}>อนุญาต OpenAI</button>
    </div>
  </aside>
}
