// สไตล์ร่วมของกล่องขออนุญาตวัดผล (TrainingMarketingConsent)
export const consentRow = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '4px 8px' }
export const consentButtons = { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }
export const consentBtn = primary => ({
  padding: '5px 10px', fontSize: 12, borderRadius: 8, cursor: 'pointer',
  border: primary ? '1px solid var(--color-brand, #0f766e)' : '1px solid #bbb',
  background: primary ? 'var(--color-brand, #0f766e)' : 'white', color: primary ? 'white' : '#17212b',
})
export const consentToggle = {
  padding: '6px 10px', fontSize: 13, textAlign: 'left', color: '#17212b', background: '#f9fafb',
  border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer',
}
