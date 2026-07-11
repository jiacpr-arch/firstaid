import { scenarios } from '../courses/firstaid/scenarios'
import { chapters } from '../courses/firstaid/lessons'

// เกณฑ์ปลดล็อก Post-test ภาคปฏิบัติ: ต้อง "ผ่าน" ฉากฝึกอย่างน้อย 1 ฉากในทุกบทที่มีฉากฝึก
// (ไม่ต้องผ่านครบทั้ง 40 ฉาก — แค่พิสูจน์ว่าได้ฝึกครอบคลุมทุกบท)
export const chapterIdsWithScenarios = chapters
  .map((c) => c.id)
  .filter((id) => scenarios.some((s) => s.chapter === id))

// สถานะฝึกรายบท: [{ chapter, title, color, done }]
export function practiceChapterStatus(passedScenarioIds) {
  return chapters
    .filter((c) => chapterIdsWithScenarios.includes(c.id))
    .map((c) => ({
      chapter: c.id,
      title: c.title,
      color: c.color,
      done: scenarios.some((s) => s.chapter === c.id && passedScenarioIds.has(s.id)),
    }))
}

// ผ่านเกณฑ์ฝึกครบทุกบทหรือยัง
export function isPracticeDone(passedScenarioIds) {
  return chapterIdsWithScenarios.every((id) =>
    scenarios.some((s) => s.chapter === id && passedScenarioIds.has(s.id))
  )
}

// จำนวนบทที่ยังฝึกไม่ผ่าน — ใช้โชว์ข้อความ "เหลืออีก N บท"
export function practiceChaptersRemaining(passedScenarioIds) {
  return practiceChapterStatus(passedScenarioIds).filter((c) => !c.done).length
}
