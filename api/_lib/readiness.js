// ความพร้อมเข้าอบรมภาคปฏิบัติ — ให้ครูเห็นว่านักเรียนคนไหน "พร้อมเข้ามาเรียน" แล้ว (แบบหน้า
// ภาพรวมของ ACLS: เขียว ผ่านครบ / เหลือง ค้างอยู่ / เทา ยังไม่เริ่ม พร้อมรายการที่ยังขาด)
//
// เกณฑ์ "พร้อม" = สอบ Post-test ผ่าน — ตรงกับเงื่อนไขออกใบเซอร์ทฤษฎี และใบเซอร์ภาคปฏิบัติ
// ต้องมีใบทฤษฎีก่อน (api/_lib/issuePractical.js) ถ้าจะเปลี่ยนเกณฑ์ ให้แก้ที่ isReady() ที่เดียว
// คลาสรวม CPR (opts.requireCpr): ต้องเรียน CPR & AED ออนไลน์ (cpr.morroo.com) จบด้วย — l.cpr มาจาก
// api/_lib/cprProgress.js (จับคู่ด้วยเบอร์) ไม่มีข้อมูล = ยังไม่เรียน
// การนับต่าง ๆ มาจากแถวสรุปของ api/_lib/cohortSummary.js

export const READINESS = {
  ready: { label: 'พร้อม', tone: 'success' },
  almost: { label: 'ใกล้พร้อม', tone: 'warning' },
  in_progress: { label: 'กำลังเรียน', tone: 'warning' },
  not_started: { label: 'ยังไม่เริ่ม', tone: 'neutral' },
}

const cprDone = (l) => l.cpr?.completed === true
export const isReady = (l, { requireCpr = false } = {}) => l.postTest?.passed === true && (!requireCpr || cprDone(l))

export function classifyReadiness(l, { totalLessons, requireCpr = false }) {
  const lessonsLeft = Math.max(0, totalLessons - (l.lessonsRead || 0))
  const hasPost = !!l.postTest
  const active = (l.lessonsRead || 0) > 0 || (l.quizzesPassed || 0) > 0
    || !!l.preTest || hasPost || (l.scenariosPassed || 0) > 0 || !!l.gameBest
    || (requireCpr && (!!l.cpr?.redeemed || (l.cpr?.modulesDone || 0) > 0))

  const missing = []
  if (lessonsLeft > 0) missing.push(`ยังไม่ได้อ่าน ${lessonsLeft} บทเรียน`)
  if (!hasPost) missing.push('ยังไม่ได้ทำ Post-test')
  else if (!l.postTest.passed) missing.push(`Post-test ยังไม่ผ่าน (ดีที่สุด ${l.postTest.score}%)`)
  if (requireCpr && !cprDone(l)) {
    missing.push(l.cpr?.modulesDone > 0 ? `CPR & AED ออนไลน์ยังไม่จบ (${l.cpr.modulesDone}/7 บท)` : 'ยังไม่ได้เรียน CPR & AED ออนไลน์')
  }

  const ready = isReady(l, { requireCpr })
  let status
  if (ready) status = 'ready'
  else if (!active) status = 'not_started'
  else if (lessonsLeft === 0 || l.postTest?.passed) status = 'almost'
  else status = 'in_progress'

  return { status, missing: ready ? [] : missing }
}

export function summarizeReadiness(learners, opts) {
  const counts = { ready: 0, almost: 0, in_progress: 0, not_started: 0 }
  for (const l of learners) counts[classifyReadiness(l, opts).status] += 1
  return { total: learners.length, ...counts }
}
