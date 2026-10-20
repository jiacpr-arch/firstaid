// สรุปสถานะรอบอบรมสำหรับส่งเข้า LINE ของครู (api/attendance/session-report.js)
// ล้วน ๆ ไม่แตะ DB — ตัวเลขรวมเท่านั้น ไม่ใส่ชื่อนักเรียน

const TZ = 'Asia/Bangkok'

// ผ่านครบ = เช็คชื่อฐานฝึกครบทุกฐาน และผ่านฐานสอบทุกฐาน
export function buildSessionReport({
  session,
  attendance = [],
  stations = [],
  stationCheckins = [],
  enrolled = null,
  readyCount = null,
  certCount = 0,
}) {
  const here = [...new Set(attendance.filter((a) => a.status !== 'rejected').map((a) => a.learner_id))]
  const hereSet = new Set(here)
  const checkedIn = here.length

  // เก็บเฉพาะการเช็คชื่อฐานของคนที่อยู่ในรอบนี้
  const byStation = new Map(stations.map((s) => [s.id, new Map()]))
  for (const c of stationCheckins) {
    if (hereSet.has(c.learner_id) && byStation.has(c.station_id)) byStation.get(c.station_id).set(c.learner_id, c)
  }

  const stationStats = stations.map((st) => {
    const rows = [...byStation.get(st.id).values()]
    const passed = rows.filter((r) => r.passed === true).length
    const failed = rows.filter((r) => r.passed === false).length
    const came = rows.length
    return {
      id: st.id, name: st.name, kind: st.kind, came,
      passed, failed, awaiting: came - passed - failed,
      notTaken: checkedIn - came,
      // ยังไม่เสร็จฐานนี้: ฐานฝึก = ยังไม่มาเช็คชื่อ, ฐานสอบ = ยังสอบไม่ผ่าน
      remaining: st.kind === 'exam' ? checkedIn - passed : checkedIn - came,
    }
  })

  let finished = 0
  let remainingItems = 0
  for (const learnerId of here) {
    let left = 0
    for (const st of stations) {
      const c = byStation.get(st.id).get(learnerId)
      if (st.kind === 'exam' ? c?.passed !== true : !c) left += 1
    }
    remainingItems += left
    if (stations.length > 0 && left === 0) finished += 1
  }

  const worst = stationStats
    .filter((s) => s.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining)[0] || null

  return {
    title: session.title,
    location: session.location || null,
    checkedIn,
    enrolled,
    readyCount,
    hasStations: stations.length > 0,
    stations: stationStats,
    finished,
    remainingItems,
    worst: worst ? { name: worst.name, remaining: worst.remaining } : null,
    certCount,
  }
}

export function formatSessionReport(r, now = new Date()) {
  const when = now.toLocaleString('th-TH', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  const lines = ['📋 สรุปรอบอบรม', r.location ? `${r.title} (${r.location})` : r.title, `🕐 ${when}`]

  if (r.enrolled != null) {
    lines.push(`👥 เช็คชื่อแล้ว ${r.checkedIn} คน (จาก ${r.enrolled} คนในคลาส · ยังไม่มา ${Math.max(0, r.enrolled - r.checkedIn)})`)
  } else {
    lines.push(`👥 เช็คชื่อแล้ว ${r.checkedIn} คน`)
  }
  if (r.readyCount != null && r.enrolled != null) {
    lines.push(`🎯 พร้อมเข้าอบรม (Post-test ผ่าน) ${r.readyCount}/${r.enrolled}`)
  }

  if (r.hasStations) {
    lines.push('📍 ฐาน')
    for (const s of r.stations) {
      if (s.kind === 'exam') {
        lines.push(`• ${s.name}: ผ่าน ${s.passed} · ไม่ผ่าน ${s.failed} · รอผล ${s.awaiting} · ยังไม่ได้สอบ ${s.notTaken}`)
      } else {
        lines.push(`• ${s.name}: มา ${s.came}/${r.checkedIn}`)
      }
    }
    lines.push(`✅ ผ่านครบทุกฐาน ${r.finished} คน · ยังเหลือ ${r.remainingItems} รายการ`)
    if (r.worst) lines.push(`⏳ ค้างมากที่สุด: ${r.worst.name} (${r.worst.remaining} คน)`)
  }

  lines.push(`🎓 ออกใบเซอร์ภาคปฏิบัติแล้ว ${r.certCount} ใบ`)
  return lines.join('\n').slice(0, 4900)
}
