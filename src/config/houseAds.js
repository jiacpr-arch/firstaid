// แบนเนอร์โปรโมตเว็บในเครือ morroo.com — แก้ชื่อ/คำโปรย/ลิงก์/สีได้ที่ไฟล์นี้ไฟล์เดียว
// ปิดแบนเนอร์ทั้งหมดได้โดยตั้ง HOUSE_ADS_ENABLED = false
// (ไม่รวม firstaid.morroo.com เพราะคือเว็บนี้เอง)

export const HOUSE_ADS_ENABLED = true

// หมุนเวียนแบนเนอร์ทุกกี่วินาที
export const HOUSE_ADS_ROTATE_SECONDS = 7

// tags ใช้เลือกแบนเนอร์ให้เข้ากับบริบทของหน้า:
//   general = ความรู้สุขภาพทั่วไป, cpr/aed/emergency = เวชฉุกเฉิน,
//   training = คอร์สอบรมภาคปฏิบัติ, pro = สำหรับบุคลากรการแพทย์
export const houseAds = [
  {
    id: 'morroo',
    name: 'Morroo.com',
    tagline: 'หมอรู้ — รวมความรู้สุขภาพและการแพทย์ ฉบับเข้าใจง่าย',
    url: 'https://www.morroo.com',
    color: '#16A34A',
    tags: ['general'],
  },
  {
    id: 'cpr',
    name: 'CPR.morroo.com',
    tagline: 'เรียนรู้การช่วยฟื้นคืนชีพ (CPR)',
    url: 'https://cpr.morroo.com',
    color: '#DC2626',
    tags: ['cpr', 'emergency'],
  },
  {
    id: 'bls',
    name: 'BLS.morroo.com',
    tagline: 'หลักสูตรการช่วยชีวิตขั้นพื้นฐาน (Basic Life Support)',
    url: 'https://bls.morroo.com',
    color: '#EA580C',
    tags: ['cpr', 'emergency', 'pro'],
  },
  {
    id: 'acls',
    name: 'ACLS.morroo.com',
    tagline: 'หลักสูตรการช่วยชีวิตขั้นสูง (ACLS) สำหรับบุคลากรการแพทย์',
    url: 'https://acls.morroo.com',
    color: '#9333EA',
    tags: ['emergency', 'pro'],
  },
  {
    id: 'emr',
    name: 'EMR.morroo.com',
    tagline: 'หลักสูตรผู้ปฏิบัติการฉุกเฉินการแพทย์ (EMR)',
    url: 'https://emr.morroo.com',
    color: '#0891B2',
    tags: ['emergency', 'pro'],
  },
  {
    id: 'drug',
    name: 'Drug.morroo.com',
    tagline: 'ข้อมูลยาและการใช้ยาอย่างถูกต้อง',
    url: 'https://drug.morroo.com',
    color: '#0D9488',
    tags: ['general', 'pro'],
  },
  {
    id: 'lab',
    name: 'Lab.morroo.com',
    tagline: 'อ่านและแปลผลตรวจทางห้องปฏิบัติการ',
    url: 'https://lab.morroo.com',
    color: '#4F46E5',
    tags: ['pro'],
  },
  {
    id: 'pharma',
    name: 'Pharma.morroo.com',
    tagline: 'ความรู้เภสัชวิทยาสำหรับบุคลากรสุขภาพ',
    url: 'https://pharma.morroo.com',
    color: '#DB2777',
    tags: ['pro'],
  },
  {
    id: 'icd10',
    name: 'ICD10.morroo.com',
    tagline: 'ค้นหารหัสโรค ICD-10 ฉบับใช้งานง่าย',
    url: 'https://icd10.morroo.com',
    color: '#7C3AED',
    tags: ['pro'],
  },
  {
    id: 'pocket',
    name: 'Pocket.morroo.com',
    tagline: 'คู่มือการแพทย์ฉบับพกพา เปิดดูได้ทุกที่',
    url: 'https://pocket.morroo.com',
    color: '#0EA5E9',
    tags: ['general', 'pro'],
  },
  {
    id: 'advice',
    name: 'Advice.morroo.com',
    tagline: 'คำแนะนำสุขภาพจากหมอ เชื่อถือได้',
    url: 'https://advice.morroo.com',
    color: '#65A30D',
    tags: ['general'],
  },
  {
    id: 'roodee',
    name: 'Roodee.me',
    tagline: 'รู้ดี — รวมเรื่องน่ารู้เพื่อสุขภาพ',
    url: 'https://roodee.me',
    color: '#E11D48',
    tags: ['general'],
  },
  {
    id: 'jiacpr',
    name: 'JiaCPR.com',
    tagline: 'เรียนรู้การช่วยฟื้นคืนชีพ (CPR) กับหมอเจี่ย',
    url: 'https://jiacpr.com',
    color: '#B91C1C',
    tags: ['cpr', 'emergency', 'training'],
  },
  {
    id: 'jiaaed',
    name: 'JiaAED.com',
    tagline: 'รู้จักและใช้เครื่องกระตุกหัวใจไฟฟ้า (AED) อย่างถูกต้อง',
    url: 'https://jiaaed.com',
    color: '#D97706',
    tags: ['aed', 'emergency', 'training'],
  },
  {
    id: 'jia1669',
    name: 'Jia1669.com',
    tagline: 'หมอเจี่ย — ความรู้การแพทย์ฉุกเฉินและสายด่วน 1669',
    url: 'https://www.jia1669.com',
    color: '#2563EB',
    tags: ['emergency'],
  },
  {
    id: 'jiatraining',
    name: 'อบรม CPR & AED ภาคปฏิบัติ',
    tagline: 'เรียนกับหุ่นจริง มีใบรับรอง — ทักไลน์ @jiacpr กับ Jia Training Center',
    url: 'https://line.me/R/ti/p/@jiacpr',
    color: '#059669',
    tags: ['training', 'cpr', 'aed'],
  },
]

// จับคู่ path ของหน้า → tag ที่อยากดันขึ้นก่อน (เรียงตามลำดับความสำคัญ)
function preferredTagsForPath(pathname) {
  if (/^\/(algorithms|simulation|call|pre-test|post-test)/.test(pathname)) {
    return ['emergency', 'cpr', 'aed']
  }
  if (/^\/(certificate|checkin)/.test(pathname)) {
    return ['training', 'cpr', 'aed']
  }
  if (/^\/(learn|$)/.test(pathname) || pathname === '/') {
    return ['general', 'cpr']
  }
  return []
}

// คืนรายการเวปในเครือโดยดันตัวที่ตรงบริบทขึ้นก่อน แล้วต่อด้วยที่เหลือ (ไม่ตัดทิ้ง)
export function pickAdsForRoute(pathname = '/') {
  const wanted = preferredTagsForPath(pathname)
  if (wanted.length === 0) return houseAds
  // ให้คะแนนตามลำดับ tag ที่อยากได้ (ยิ่ง tag อยู่ต้น ๆ ยิ่งคะแนนสูง)
  const score = (ad) => {
    let best = 0
    for (const tag of ad.tags || []) {
      const rank = wanted.indexOf(tag)
      if (rank !== -1) best = Math.max(best, wanted.length - rank)
    }
    return best
  }
  return houseAds
    .map((ad, i) => ({ ad, i, s: score(ad) }))
    .sort((a, b) => b.s - a.s || a.i - b.i) // คะแนนมากก่อน, เสมอกันคงลำดับเดิม
    .map((x) => x.ad)
}
