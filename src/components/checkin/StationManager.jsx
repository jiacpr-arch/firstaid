import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { adminFetch } from '../../utils/adminFetch'
import { DEFAULT_STATIONS, STATION_KIND_META } from '../../data/checkinStations'

// จัดการสถานีของ session: เพิ่มชุดมาตรฐาน / เพิ่มเอง / เปลี่ยนชนิด / ลบ
export default function StationManager({ sessionId, stations, onChanged, fetcher = adminFetch }) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState('practice')
  const [busy, setBusy] = useState(false)

  const call = async (url, opts) => {
    setBusy(true)
    try {
      const resp = await fetcher(url, opts)
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok) { alert(body.error || 'ไม่สำเร็จ'); return false }
      await onChanged()
      return true
    } finally { setBusy(false) }
  }

  const addDefaults = () => call('/api/attendance/stations', {
    method: 'POST',
    body: JSON.stringify({ sessionId, stations: DEFAULT_STATIONS.map(({ name: n, kind: k }) => ({ name: n, kind: k })) }),
  })

  const addOne = async () => {
    if (!name.trim()) return
    if (await call('/api/attendance/stations', {
      method: 'POST', body: JSON.stringify({ sessionId, stations: [{ name: name.trim(), kind }] }),
    })) setName('')
  }

  const remove = (st) => {
    if (!confirm(`ลบ "${st.name}"? ผลเช็คชื่อและคะแนนของฐานนี้จะหายไปด้วย`)) return
    call(`/api/attendance/stations?id=${st.id}`, { method: 'DELETE' })
  }

  const toggleKind = (st) => call('/api/attendance/stations', {
    method: 'PATCH', body: JSON.stringify({ id: st.id, kind: st.kind === 'exam' ? 'practice' : 'exam' }),
  })

  return (
    <div className="card" style={{ marginTop: 8 }}>
      {stations.length === 0 && (
        <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={addDefaults}>
          <Plus size={16} /> เพิ่มฐานมาตรฐานปฐมพยาบาล
        </button>
      )}
      {stations.map((st) => (
        <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
          <div className="text-body" style={{ flex: 1 }}>{st.name}</div>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => toggleKind(st)} title="สลับชนิดฐาน">
            {STATION_KIND_META[st.kind].label}
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => remove(st)} aria-label="ลบ"><Trash2 size={14} /></button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input className="input" style={{ flex: 1 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อฐานใหม่" />
        <select className="input" style={{ width: 90 }} value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="practice">เช็คชื่อ</option>
          <option value="exam">สอบ</option>
        </select>
        <button type="button" className="btn btn-secondary" disabled={busy || !name.trim()} onClick={addOne}><Plus size={16} /></button>
      </div>
    </div>
  )
}
