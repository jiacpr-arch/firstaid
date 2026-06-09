// Certificate templates (Theory + Practical) + pass criteria

export const CERT_KINDS = {
  theory: {
    kind: 'theory',
    title: 'ใบประกาศนียบัตรภาคทฤษฎี',
    subtitle: 'หลักสูตรปฐมพยาบาลเบื้องต้นสำหรับประชาชน',
    description: 'ผ่านการอบรมและทดสอบความรู้ทางทฤษฎี ตามมาตรฐาน TH-FirstAid-Layperson-2026',
    accent: '#16A34A',
  },
  practical: {
    kind: 'practical',
    title: 'ใบประกาศนียบัตรภาคปฏิบัติ',
    subtitle: 'หลักสูตรปฐมพยาบาลเบื้องต้นสำหรับประชาชน',
    description: 'ผ่านการฝึกปฏิบัติกับครูผู้สอน ณ หน่วยงานสอน',
    accent: '#2563EB',
  },
}

export function evaluateTheoryEligibility({ postTestAttempt }) {
  if (!postTestAttempt) return { eligible: false, reason: 'ยังไม่ได้ทำแบบทดสอบหลังเรียน' }
  if (!postTestAttempt.passed) return { eligible: false, reason: `คะแนนยังไม่ถึง 80% (ได้ ${postTestAttempt.score}%)` }
  return { eligible: true }
}

export function evaluatePracticalEligibility({ hasTheory, approvedAttendance }) {
  if (!hasTheory) return { eligible: false, reason: 'ต้องได้ใบประกาศภาคทฤษฎีก่อน' }
  if (!approvedAttendance) return { eligible: false, reason: 'รอครูผู้สอนอนุมัติการเช็คชื่อภาคปฏิบัติ' }
  return { eligible: true }
}

// 8-char verification code (no ambiguous chars)
export function generateCertCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  let out = ''
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return `FA-${out}`
}
