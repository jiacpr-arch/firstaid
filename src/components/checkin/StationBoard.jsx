import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { computeStationStats, buildBoardCsv } from '../../../api/_lib/stationLogic.js'

const fmtTime = (iso) => (iso
  ? new Date(iso).toLocaleString('th-TH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '')

function download(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// กระดานนักเรียน × ฐาน + สถิติต่อฐาน + Export CSV — กรองตามกลุ่มฝึก A–D ได้ (ตารางหมุนฐาน)
export default function StationBoard({ board, filename }) {
  const [group, setGroup] = useState('all')
  const groups = useMemo(
    () => [...new Set((board?.rows || []).map((r) => r.groupLabel).filter(Boolean))].sort(),
    [board],
  )
  const shown = useMemo(() => {
    if (!board) return board
    if (group === 'all') return board
    return { ...board, rows: board.rows.filter((r) => (group === 'none' ? !r.groupLabel : r.groupLabel === group)) }
  }, [board, group])
  const stats = useMemo(() => computeStationStats(shown), [shown])
  if (!board || board.stations.length === 0) return null

  const cell = (st, c) => {
    if (!c) return '—'
    if (st.kind !== 'exam') return '✓'
    return c.passed === true ? 'ผ่าน' : c.passed === false ? 'ไม่ผ่าน' : 'รอผล'
  }

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div className="text-body-strong" style={{ flex: 1 }}>กระดานสถานี ({shown.rows.length} คน)</div>
        <button type="button" className="btn btn-ghost" onClick={() => download(buildBoardCsv(shown, fmtTime), filename)}>
          <Download size={14} /> CSV
        </button>
      </div>
      {groups.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
          {[['all', 'ทั้งหมด'], ...groups.map((g) => [g, `กลุ่ม ${g}`]), ['none', 'ไม่มีกลุ่ม']].map(([key, label]) => (
            <button key={key} type="button" className={`btn ${group === key ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setGroup(key)}>
              {label}
            </button>
          ))}
        </div>
      )}
      <div style={{ overflowX: 'auto', marginTop: 6 }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 13, minWidth: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 4 }}>ชื่อ</th>
              <th style={{ padding: 4 }}>กลุ่ม</th>
              {board.stations.map((st) => (
                <th key={st.id} style={{ padding: 4, whiteSpace: 'nowrap' }}>{st.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.rows.map((r) => (
              <tr key={r.learnerId}>
                <td style={{ padding: 4, whiteSpace: 'nowrap' }}>{r.name || r.learnerId.slice(0, 8)}</td>
                <td style={{ padding: 4, textAlign: 'center' }}>{r.groupLabel || '—'}</td>
                {board.stations.map((st) => (
                  <td key={st.id} style={{ padding: 4, textAlign: 'center' }}>{cell(st, r.checkins[st.id])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-caption" style={{ marginTop: 8 }}>
        {stats.map((s) => (
          <div key={s.id}>
            {s.name}: มา {s.attended}/{s.total}
            {s.kind === 'exam' && ` · ผ่าน ${s.passed} · ไม่ผ่าน ${s.failed} · รอผล ${s.pending}${s.passRate != null ? ` · ผ่าน ${s.passRate}%` : ''}`}
          </div>
        ))}
      </div>
    </div>
  )
}
