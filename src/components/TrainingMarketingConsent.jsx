import { useCallback, useEffect, useRef, useState } from 'react'
import { Settings2, X } from 'lucide-react'
import OpenAITrainingConsent from './OpenAITrainingConsent'
import MetaPixel from './MetaPixel'
import GoogleTrainingConsent from './GoogleTrainingConsent'
import { consentButtons, consentBtn } from './consentStyles'
import { installMarketingLifecycleGuard } from '../lib/trainingAds'
import { installMarketingConsentStorageGuard, revokeTrainingMarketing } from '../lib/trainingMarketing'

// กล่องเดียวรวมทุกเจ้า (Meta / Google / OpenAI): ปุ่ม "อนุญาตทั้งหมด / ไม่อนุญาตทั้งหมด" กดครั้งเดียวจบ
// ("รายละเอียด / เลือกแยก" ยังเลือกทีละเจ้าได้) · เลือกแล้ว: กล่องหายไป เหลือลิงก์ "ตั้งค่าการวัดผล" ท้ายหน้าไว้ถอน/เปลี่ยนใจ
// (เดิมเป็น 3 กล่องซ้อนสูงถึง 65% ของจอ และเลือกแล้วยังเหลือปุ่มลอยค้างทับเนื้อหา)
export default function TrainingMarketingConsent({ publicLanding = false }) {
  const [statuses, setStatuses] = useState({})
  const [manageOpen, setManageOpen] = useState(false)
  const [separate, setSeparate] = useState(false)
  const choosers = useRef({})
  useEffect(() => {
    const lifecycle = installMarketingLifecycleGuard(window, document, revokeTrainingMarketing)
    const storage = installMarketingConsentStorageGuard(window, document)
    return () => { lifecycle(); storage() }
  }, [])
  const report = useCallback((vendor, status) => {
    setStatuses(prev => (prev[vendor] === status ? prev : { ...prev, [vendor]: status }))
  }, [])
  const register = useCallback((vendor, choose) => {
    if (choose) choosers.current[vendor] = choose
    else delete choosers.current[vendor]
  }, [])
  // ปุ่มรวม: ส่งคำตอบเดียวกันให้ทุกเจ้าที่ยังไม่ได้เลือก (onlyPending) หรือทุกเจ้า (จากหน้าตั้งค่า)
  // แต่ละเจ้ายังบันทึกแยก key ของตัวเอง — การอนุญาตเจ้าหนึ่งไม่เคยลามไปอีกเจ้า
  const chooseAll = (value, onlyPending) => {
    for (const vendor of ['meta', 'google', 'openai']) {
      if (onlyPending && statuses[vendor] !== 'pending') continue
      if (!statuses[vendor]) continue
      choosers.current[vendor]?.(value)
    }
  }
  const values = Object.values(statuses)
  const pending = values.includes('pending')
  const decided = values.includes('decided')
  const vendorProps = { publicLanding, onStatus: report, onRegister: register, showToggle: pending ? separate : manageOpen, showDialog: separate }
  const vendors = <>
    <MetaPixel {...vendorProps} />
    <GoogleTrainingConsent {...vendorProps} />
    <OpenAITrainingConsent {...vendorProps} />
  </>

  const panel = {
    position: 'fixed', zIndex: 1000, bottom: 78, left: 12, right: 12, maxWidth: 440, margin: '0 auto',
    maxHeight: '45vh', overflowY: 'auto', padding: '10px 12px', color: '#17212b', background: 'white',
    border: '1px solid #ccc', borderRadius: 12, boxShadow: '0 4px 20px #0002',
    display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, lineHeight: 1.45,
  }
  const link = { background: 'none', border: 0, padding: 0, color: '#4b5563', textDecoration: 'underline', fontSize: 12, cursor: 'pointer' }
  // โครงเดียวตลอด (ไม่สลับ element ครอบ) — ไม่ให้ component ของแต่ละเจ้า remount ตอนเปลี่ยนสถานะ
  const panelOpen = pending || (decided && manageOpen)
  return <>
    <div style={panelOpen ? panel : { display: 'none' }} data-testid="marketing-consent">
      {pending && <>
        <p style={{ margin: 0 }}>
          ขออนุญาตให้ <b>Meta, Google และ OpenAI</b> วัดการเข้าชมหน้านี้เพื่อดูผลโฆษณา
          ไม่ส่งชื่อ เบอร์โทร คำตอบ หรือผลการเรียน · เรียนได้ตามปกติแม้ไม่อนุญาต
        </p>
        <div style={consentButtons}>
          <button type="button" style={consentBtn(false)} onClick={() => chooseAll('denied', true)}>ไม่อนุญาตทั้งหมด</button>
          <button type="button" style={consentBtn(true)} onClick={() => chooseAll('granted', true)}>อนุญาตทั้งหมด</button>
          <button type="button" style={link} aria-expanded={separate} onClick={() => setSeparate(v => !v)}>
            {separate ? 'ซ่อนรายละเอียด' : 'รายละเอียด / เลือกแยก'}
          </button>
        </div>
      </>}
      {!pending && panelOpen && <>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <strong style={{ fontSize: 14 }}>ตั้งค่าการวัดผลโฆษณา</strong>
          <button type="button" aria-label="ปิดตั้งค่าการวัดผล" onClick={() => setManageOpen(false)}
            style={{ background: 'none', border: 0, padding: 4, color: '#4b5563', cursor: 'pointer' }}><X size={16} /></button>
        </div>
        <div style={consentButtons}>
          <button type="button" style={consentBtn(false)} onClick={() => chooseAll('denied', false)}>ถอนความยินยอมทั้งหมด</button>
          <button type="button" style={consentBtn(true)} onClick={() => chooseAll('granted', false)}>อนุญาตทั้งหมด</button>
        </div>
        <small style={{ color: '#6b7280' }}>หรือเปลี่ยนทีละเจ้า:</small>
      </>}
      {vendors}
    </div>
    {/* เลือกแล้วไม่ลอยทับเนื้อหา — เหลือแค่ลิงก์เล็กท้ายหน้า (อยู่ใน flow ปกติ) ไว้ถอน/เปลี่ยนใจ */}
    {decided && !pending && !manageOpen && <div style={{ textAlign: 'center', padding: '8px 16px 140px' }}>
      <button type="button" aria-expanded="false" onClick={() => setManageOpen(true)} style={{
        background: 'none', border: 0, padding: 4, fontSize: 12, color: '#6b7280', textDecoration: 'underline',
        display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer',
      }}>
        <Settings2 size={12} /> ตั้งค่าการวัดผล
      </button>
    </div>}
  </>
}
