import { classifyReadiness } from './readiness.js'

// รายงานประจำรุ่น (หน้าผู้สอน /admin/teach → "รายงานประจำรุ่น") — รวมผลทุกส่วนของคลาสเดียว
// ในก้อนเดียวสำหรับพิมพ์/บันทึก PDF ส่งต้นสังกัด: ทฤษฎีออนไลน์, Pre/Post-test, ภาคปฏิบัติรายฐาน,
// ใบประกาศ และผลรายคน ล้วน ๆ ไม่แตะ DB — หน้าเว็บดึงข้อมูลจาก API เดิมแล้วส่งเข้ามา
//
// learners: แถวของ api/_lib/cohortSummary.js (api/cohorts/summary)
// board:    api/attendance/board → { stations:[{id,name,kind}], rows:[{ learnerId, checkins:{[stationId]:{passed,score,checkedInAt}} }] }
// certs:    api/classes/certificates → { rows:[{ learnerId, theory:{state}, practical:{state} }] }

const avg = (nums) => (nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null)
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : null)

function examStats(learners, key) {
  const taken = learners.map((l) => l[key]).filter(Boolean)
  const passed = taken.filter((e) => e.passed).length
  const scores = taken.map((e) => e.score ?? 0)
  return {
    taken: taken.length,
    passed,
    passRate: pct(passed, taken.length),
    avg: avg(scores),
    min: scores.length ? Math.min(...scores) : null,
    max: scores.length ? Math.max(...scores) : null,
  }
}

export function buildCohortReport({ learners = [], totalLessons = 0, board = null, certs = null }) {
  const stations = board?.stations || []
  const examStations = stations.filter((s) => s.kind === 'exam')
  const boardBy = new Map((board?.rows || []).map((r) => [r.learnerId, r.checkins || {}]))
  const certBy = new Map((certs?.rows || []).map((r) => [r.learnerId, r]))
  const hasCerts = !!certs

  const students = learners.map((l) => {
    const r = classifyReadiness(l, { totalLessons })
    const checkins = boardBy.get(l.learnerId)
    const attended = !!checkins
    const stationsDone = stations.filter((s) => checkins?.[s.id]).length
    const examsPassed = examStations.filter((s) => checkins?.[s.id]?.passed === true).length
    const cert = certBy.get(l.learnerId)
    const theoryCert = cert?.theory?.state === 'hub'
    const practicalCert = cert?.practical?.state === 'hub'

    const missing = [...r.missing]
    if (stations.length) {
      if (!attended) missing.push('ยังไม่ได้เช็คชื่อวันอบรม')
      else {
        if (stationsDone < stations.length) missing.push(`เข้าฐาน ${stationsDone}/${stations.length}`)
        if (examStations.length && examsPassed < examStations.length) missing.push(`สอบปฏิบัติผ่าน ${examsPassed}/${examStations.length}`)
      }
    }
    if (hasCerts && !practicalCert) missing.push('ยังไม่ได้ใบภาคปฏิบัติ')

    return {
      learnerId: l.learnerId,
      name: l.name || '',
      phone: l.phone || '',
      group: l.groupLabel || null,
      readiness: r.status,
      lessonsRead: l.lessonsRead || 0,
      quizzesPassed: l.quizzesPassed || 0,
      pre: l.preTest || null,
      post: l.postTest || null,
      improvement: l.preTest && l.postTest ? (l.postTest.score ?? 0) - (l.preTest.score ?? 0) : null,
      attended,
      stationsDone,
      examsPassed,
      theoryCert,
      practicalCert,
      complete: missing.length === 0,
      missing,
    }
  })

  const stationStats = stations.map((st) => {
    let came = 0; let passed = 0; let failed = 0
    for (const l of learners) {
      const c = boardBy.get(l.learnerId)?.[st.id]
      if (!c) continue
      came += 1
      if (c.passed === true) passed += 1
      else if (c.passed === false) failed += 1
    }
    return { id: st.id, name: st.name, kind: st.kind, came, passed, failed, awaiting: came - passed - failed }
  })

  const improvements = students.map((s) => s.improvement).filter((v) => v != null)
  const times = learners.flatMap((l) => [l.joinedAt, l.lastActivity]).filter(Boolean).sort()

  return {
    total: learners.length,
    totalLessons,
    period: times.length ? { from: times[0], to: times[times.length - 1] } : null,
    overview: {
      lessonsComplete: students.filter((s) => totalLessons && s.lessonsRead >= totalLessons).length,
      ready: students.filter((s) => s.readiness === 'ready').length,
      pre: examStats(learners, 'preTest'),
      post: examStats(learners, 'postTest'),
      avgImprovement: avg(improvements),
      improvedCount: improvements.filter((v) => v > 0).length,
      attended: students.filter((s) => s.attended).length,
      practicalComplete: stations.length
        ? students.filter((s) => s.stationsDone === stations.length && s.examsPassed === examStations.length).length
        : null,
      theoryCerts: hasCerts ? students.filter((s) => s.theoryCert).length : null,
      practicalCerts: hasCerts ? students.filter((s) => s.practicalCert).length : null,
      complete: students.filter((s) => s.complete).length,
    },
    stationStats,
    hasPractical: stations.length > 0,
    hasCerts,
    students,
  }
}
