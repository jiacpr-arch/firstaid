import { FIRST_AID_CHECKLISTS } from './checklists/firstAidChecklists'

// ชุดฐานมาตรฐานสำหรับ session ภาคปฏิบัติ — ปุ่ม "เพิ่มฐานมาตรฐาน" ในหน้ารายละเอียดคลาส
// ครูแก้ชื่อ/ลบ/เพิ่มเองได้ทั้งหมด; checklistId เป็นแค่คำแนะนำเริ่มต้นให้ใบประเมิน
// (ครูเปลี่ยนใบที่ใช้จริงตอนให้คะแนนได้เสมอ)
export const DEFAULT_STATIONS = [
  { name: 'ฐาน 1: CPR ผู้ใหญ่ + AED', kind: 'practice', checklistId: 'cprAed' },
  { name: 'ฐาน 2: สำลัก (Heimlich)', kind: 'practice', checklistId: 'choking' },
  { name: 'ฐาน 3: ห้ามเลือดและพันแผล', kind: 'practice', checklistId: 'bleeding' },
  { name: 'ฐาน 4: แผลไหม้', kind: 'practice', checklistId: 'burns' },
  { name: 'ฐาน 5: จัดท่าตะแคง', kind: 'practice', checklistId: 'recovery' },
  { name: 'ฐาน 6: กระดูกหัก/เข้าเฝือก', kind: 'practice', checklistId: 'fracture' },
  { name: 'สอบปฏิบัติ', kind: 'exam', checklistId: 'cprAed' },
]

export const STATION_KIND_META = {
  practice: { label: 'เช็คชื่อ' },
  exam: { label: 'สอบ' },
}

// หาใบประเมินแนะนำจากชื่อฐาน (ฐานที่ครูตั้งชื่อเองคืน null)
export function suggestedChecklistId(stationName) {
  const match = DEFAULT_STATIONS.find((s) => s.name === stationName)
  return match && FIRST_AID_CHECKLISTS[match.checklistId] ? match.checklistId : null
}
