import { useEffect, useState } from 'react'
import { isAutomated } from '../lib/isAutomated'
import { applyOpenAIConsentChoice, eligibleOpenAIDocument, loadTrainingOpenAI, readOpenAIConsent } from '../lib/trainingOpenAIAds'

export default function OpenAITrainingConsent({ publicLanding = false }) {
  const [choice, setChoice] = useState(() => readOpenAIConsent(window))
  const eligible = !isAutomated && eligibleOpenAIDocument(window, document, publicLanding)
  useEffect(() => {
    if (eligible && choice === 'granted') loadTrainingOpenAI(window, document, { publicLanding })
  }, [eligible, choice, publicLanding])
  if (!eligible) return null
  const choose = value => setChoice(applyOpenAIConsentChoice(window, value))
  const style = { padding: 12, color: '#17212b', background: 'white', border: '1px solid #bbb', borderRadius: 12 }
  if (choice) return <button type="button" onClick={() => choose(choice === 'granted' ? 'denied' : 'granted')} style={style}>{choice === 'granted' ? 'ถอนความยินยอม OpenAI' : 'อนุญาต OpenAI'}</button>
  return <aside role="dialog" aria-label="การวัดผล OpenAI" style={style}>
    <p>อนุญาตให้ OpenAI รับข้อมูลการเข้าชมหน้าแนะนำคอร์สนี้ผ่านรูปภาพวัดผลโฆษณาหรือไม่? คำขอรูปภาพส่งชื่อเว็บไซต์ ข้อมูลเบราว์เซอร์ และ IP ไม่ส่งชื่อ เบอร์โทร อีเมล ข้อมูลผู้เรียน หรือผลการเรียน ไม่ติดตามการกด LINE ตัวเลือกนี้แยกจาก Meta และ Google คุณเรียนได้ตามปกติแม้ไม่อนุญาต และถอนความยินยอมสำหรับการส่งครั้งต่อไปได้</p>
    <a href="https://openai.com/policies/privacy-policy/" target="_blank" rel="noopener noreferrer">นโยบายความเป็นส่วนตัว OpenAI</a>{' · '}
    <button type="button" onClick={() => choose('denied')}>ไม่อนุญาต OpenAI</button>{' · '}
    <button type="button" onClick={() => choose('granted')}>อนุญาต OpenAI</button>
  </aside>
}
