// สไตล์ร่วมของกล่องขออนุญาตวัดผล (TrainingMarketingConsent)
export const consentRow = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '4px 8px' }
export const consentButtons = { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }
export const consentBtn = primary => ({
  // หน้าตาเดียวกับแถบคุกกี้ JIA ของเว็บอื่น (ปุ่มแคปซูล ปุ่มหลักสีแบรนด์)
  padding: '7px 14px', fontSize: 13, fontWeight: 600, borderRadius: 999, cursor: 'pointer', font: 'inherit',
  border: primary ? '1px solid var(--color-brand, #0f766e)' : '1px solid #d1d5db',
  background: primary ? 'var(--color-brand, #0f766e)' : 'white', color: primary ? 'white' : '#4b5563',
})
export const consentToggle = {
  padding: '6px 10px', fontSize: 13, textAlign: 'left', color: '#17212b', background: '#f9fafb',
  border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer',
}
