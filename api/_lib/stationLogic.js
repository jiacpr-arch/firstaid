// ตรรกะล้วนของระบบสถานี (ไม่แตะ DB) — ใช้ทั้งฝั่ง API และหน้าแอดมิน

// ต้องเช็คชื่อฐานฝึกครบทุกฐานก่อน ถึงจะเข้าฐานสอบได้
// คืนรายชื่อฐานฝึกที่ยังขาด (ว่าง = เข้าสอบได้)
export function missingPracticeStations(stations, doneStationIds) {
  const done = new Set(doneStationIds)
  return stations.filter((s) => s.kind === 'practice' && !done.has(s.id))
}

// นับข้อที่ทำได้ + ข้อวิกฤต (critical) ที่ทำได้ครบหรือไม่
export function tallyChecklist(items, checked) {
  const total = items.length
  const checkedCount = items.filter((it) => checked[it.no]).length
  const criticalDone = items.filter((it) => it.critical).every((it) => checked[it.no])
  return { total, checkedCount, criticalDone }
}

// กติกาผ่านที่แนะนำ: ข้อวิกฤตครบ และทำได้ ≥ minPercent ของทั้งหมด (ครูตัดสินเองได้เสมอ)
export function suggestPass({ total, checkedCount, criticalDone }, rule = {}) {
  const minPercent = rule.minPercent ?? 80
  if (!criticalDone) return false
  if (total === 0) return false
  return (checkedCount / total) * 100 >= minPercent
}

// สถิติต่อฐานจากกระดาน { stations, rows:[{ checkins:{[stationId]:{passed}} }] }
export function computeStationStats(board) {
  const stations = board?.stations || []
  const rows = board?.rows || []
  return stations.map((st) => {
    let attended = 0; let passed = 0; let failed = 0
    for (const r of rows) {
      const c = r.checkins?.[st.id]
      if (!c) continue
      attended += 1
      if (c.passed === true) passed += 1
      else if (c.passed === false) failed += 1
    }
    return {
      id: st.id, name: st.name, kind: st.kind,
      attended, total: rows.length, passed, failed,
      pending: attended - passed - failed,
      passRate: passed + failed > 0 ? Math.round((passed / (passed + failed)) * 100) : null,
    }
  })
}

const esc = (v) => {
  if (v == null) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// CSV กว้าง 1 แถวต่อนักเรียน (UTF-8 BOM ให้ Excel อ่านไทยได้) — ฐานสอบมีคอลัมน์ผล/คะแนนเพิ่ม
export function buildBoardCsv(board, formatTime = (iso) => iso) {
  const stations = board?.stations || []
  const rows = board?.rows || []
  const headers = ['ลำดับ', 'ชื่อ-สกุล', 'เบอร์โทร']
  for (const st of stations) {
    headers.push(`${st.name} — เช็คชื่อ`)
    if (st.kind === 'exam') headers.push(`${st.name} — ผล`, `${st.name} — คะแนน`)
  }
  const lines = [headers.map(esc).join(',')]
  rows.forEach((r, i) => {
    const cells = [i + 1, r.name || '', r.phone || '']
    for (const st of stations) {
      const c = r.checkins?.[st.id]
      cells.push(c ? formatTime(c.checkedInAt) : '')
      if (st.kind === 'exam') {
        cells.push(c ? (c.passed === true ? 'ผ่าน' : c.passed === false ? 'ไม่ผ่าน' : 'รอตัดสิน') : '')
        cells.push(c?.score ?? '')
      }
    }
    lines.push(cells.map(esc).join(','))
  })
  return '﻿' + lines.join('\n')
}
