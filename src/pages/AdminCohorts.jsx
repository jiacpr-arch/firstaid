import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, Users, ChevronRight, GraduationCap } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../config/supabaseClient'
import { adminFetch } from '../utils/adminFetch'

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
    // ผ่าน API (service role) เพราะคลาสที่ผู้สอนสร้างจากแอปไม่มีเจ้าของ RLS จึงมองไม่เห็นจาก client
    return adminFetch('/api/classes/list')
      .then((r) => r.json())
      .then((b) => b.classes || [])
      .catch(() => [])
  }
  const load = () => loadCohorts().then((data) => setCohorts(data))

  useEffect(() => {
    let cancelled = false
    loadCohorts().then((data) => { if (!cancelled) setCohorts(data) })
    return () => { cancelled = true }
  }, [])

  const closeClass = async (c) => {
    if (!confirm(`ปิดคลาส “${c.name}”? รหัสผู้ช่วยจะใช้ไม่ได้อีก (ข้อมูลนักเรียนไม่ถูกลบ)`)) return
    const resp = await adminFetch('/api/classes/close', { method: 'POST', body: JSON.stringify({ cohortId: c.id }) })
    const body = await resp.json().catch(() => ({}))
    if (!resp.ok) { alert(body.error || 'ปิดคลาสไม่สำเร็จ'); return }
    load()
  }

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
          <div key={c.id} className="card" style={{ opacity: c.closed ? 0.65 : 1 }}>
            <Link to={`/admin/cohorts/${c.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
              {c.createdVia === 'app' ? <GraduationCap size={22} color="#2E6D5D" /> : <Users size={22} color="#16A34A" />}
              <div style={{ flex: 1 }}>
                <div className="text-body-strong">
                  {c.name}{' '}
                  <span className="badge">{c.createdVia === 'app' ? 'สร้างจากหน้าผู้สอน' : 'สร้างจากหน้ากลุ่ม'}</span>
                  {c.closed && <span className="badge badge-danger" style={{ marginLeft: 4 }}>ปิดแล้ว</span>}
                </div>
                <div className="text-caption">รหัสเข้าร่วม {c.code} · นักเรียน {c.students} คน — แตะดู dashboard</div>
              </div>
              <ChevronRight size={18} color="var(--color-text-muted)" />
            </Link>
            {(c.instructorCode || !c.closed) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                {c.instructorCode && <div className="text-caption" style={{ flex: 1 }}>รหัสผู้ช่วย: <b style={{ letterSpacing: 2 }}>{c.instructorCode}</b></div>}
                {!c.closed && c.createdVia === 'app' && (
                  <button type="button" className="btn btn-ghost" style={{ fontSize: 13, color: '#B42318' }} onClick={() => closeClass(c)}>ปิดคลาส</button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
