import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, Users } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../config/supabaseClient'

function makeCohortCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  let out = ''
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export default function AdminCohorts() {
  const [cohorts, setCohorts] = useState([])
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const loadCohorts = () => {
    if (!isSupabaseConfigured) return Promise.resolve([])
    return supabase
      .from('cohorts')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => data || [])
  }
  const load = () => loadCohorts().then((data) => setCohorts(data))

  useEffect(() => {
    let cancelled = false
    loadCohorts().then((data) => { if (!cancelled) setCohorts(data) })
    return () => { cancelled = true }
  }, [])

  const create = async () => {
    if (!name.trim() || !isSupabaseConfigured) return
    setBusy(true)
    const { data: { user } } = await supabase.auth.getUser()
    const row = { instructor_id: user.id, name: name.trim(), code: makeCohortCode() }
    const { error } = await supabase.from('cohorts').insert(row)
    setBusy(false)
    if (error) { alert(error.message); return }
    setName('')
    load()
  }

  return (
    <div className="page-container">
      <Link to="/admin" className="btn btn-ghost" style={{ paddingLeft: 0 }}>
        <ArrowLeft size={16} /> หน้าควบคุม
      </Link>
      <div style={{ marginTop: 4 }}>
        <div className="text-caption">จัดการ</div>
        <div className="text-title">กลุ่มผู้เรียน (Cohorts)</div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <label className="label">ชื่อกลุ่ม</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น รุ่นที่ 7 / มิ.ย. 68" />
        <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 10 }}
          disabled={busy || !name.trim()} onClick={create}>
          <Plus size={16} /> สร้างกลุ่มใหม่
        </button>
      </div>

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!isSupabaseConfigured && (
          <div className="callout callout-info">ยังไม่ได้เชื่อมต่อ Supabase</div>
        )}
        {cohorts.map((c) => (
          <div key={c.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Users size={22} color="#16A34A" />
            <div style={{ flex: 1 }}>
              <div className="text-body-strong">{c.name}</div>
              <div className="text-caption">รหัสเข้าร่วม {c.code}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
