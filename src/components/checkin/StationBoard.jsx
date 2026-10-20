import { useMemo } from 'react'
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

// กระดานนักเรียน × ฐาน + สถิติต่อฐาน + Export CSV
export default function StationBoard({ board, filename }) {
  const stats = useMemo(() => computeStationStats(board), [board])
  if (!board || board.stations.length === 0) return null

  const cell = (st, c) => {
    if (!c) return '—'
    if (st.kind !== 'exam') return '✓'
    return c.passed === true ? 'ผ่าน' : c.passed === false ? 'ไม่ผ่าน' : 'รอผล'
  }

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div className="text-body-strong" style={{ flex: 1 }}>กระดานสถานี ({board.rows.length} คน)</div>
        <button type="button" className="btn btn-ghost" onClick={() => download(buildBoardCsv(board, fmtTime), filename)}>
          <Download size={14} /> CSV
        </button>
      </div>
      <div style={{ overflowX: 'auto', marginTop: 6 }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 13, minWidth: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 4 }}>ชื่อ</th>
              {board.stations.map((st) => (
                <th key={st.id} style={{ padding: 4, whiteSpace: 'nowrap' }}>{st.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {board.rows.map((r) => (
              <tr key={r.learnerId}>
                <td style={{ padding: 4, whiteSpace: 'nowrap' }}>{r.name || r.learnerId.slice(0, 8)}</td>
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
