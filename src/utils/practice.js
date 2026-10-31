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

// หมวดนี้ฝึกผ่านแล้วหรือยัง (หมวดที่ไม่มีฉากฝึก = ถือว่าผ่าน)
export function isChapterPracticeDone(chapterId, passedScenarioIds) {
  if (!chapterIdsWithScenarios.includes(chapterId)) return true
  return scenarios.some((s) => s.chapter === chapterId && passedScenarioIds.has(s.id))
}

// หมวดแรกที่ยังฝึกไม่ผ่าน (null = ครบแล้ว)
export function firstPendingPracticeChapter(passedScenarioIds) {
  return practiceChapterStatus(passedScenarioIds).find((c) => !c.done) ?? null
}

// ลิงก์หน้าฝึกที่เลื่อนไปหมวดนั้นเลย — ไม่ระบุหมวด = หมวดแรกที่ยังขาด
export function practiceLink(passedScenarioIds, chapterId = null) {
  const ch = chapterId ?? firstPendingPracticeChapter(passedScenarioIds)?.chapter
  return ch ? `/simulation?chapter=${ch}` : '/simulation'
}

// บทนี้เป็นบทสุดท้ายของหมวดหรือไม่ (ใช้ชวนฝึกท้ายหมวด)
export function isLastLessonOfChapter(lesson, allLessons) {
  const inChapter = allLessons.filter((l) => l.chapter === lesson.chapter)
  return inChapter.length > 0 && inChapter[inChapter.length - 1].id === lesson.id
}

// ด่านบังคับฝึกท้ายหมวด: บทที่ยังไม่เคยเรียนในหมวด N เปิดได้ต่อเมื่อฝึกผ่านทุกหมวดก่อนหน้าแล้ว
// คืนเลขหมวดที่ต้องฝึกให้ผ่านก่อน (null = เปิดได้) — บทที่เคยเรียนแล้วเปิดทบทวนได้เสมอ
export function practiceGateChapter(lesson, readLessonIds, passedScenarioIds) {
  if (!lesson || readLessonIds.has(lesson.id)) return null
  const blocking = chapterIdsWithScenarios
    .filter((id) => id < lesson.chapter)
    .find((id) => !isChapterPracticeDone(id, passedScenarioIds))
  return blocking ?? null
}
