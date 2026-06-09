import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Plus, ArrowLeft } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../config/supabaseClient'

function makeSessionCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  let out = ''
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export default function AdminSessions() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(() => isSupabaseConfigured)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: '', location: '' })

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let cancelled = false
    supabase
      .from('practical_sessions')
      .select('*')
      .order('starts_at', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return
        setSessions(data || [])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const create = async () => {
    if (!form.title.trim()) return
    if (!isSupabaseConfigured) { alert('ยังไม่ได้เชื่อมต่อ Supabase'); return }
    const code = makeSessionCode()
    const { data: { user } } = await supabase.auth.getUser()
    const row = {
      instructor_id: user.id,
      title: form.title.trim(),
      location: form.location.trim(),
      qr_token: code,
      starts_at: new Date().toISOString(),
    }
    const { data, error } = await supabase.from('practical_sessions').insert(row).select().single()
    if (error) { alert(error.message); return }
    setSessions((s) => [data, ...s])
    setCreating(false)
    setForm({ title: '', location: '' })
  }

  return (
    <div className="page-container">
      <Link to="/admin" className="btn btn-ghost" style={{ paddingLeft: 0 }}>
        <ArrowLeft size={16} /> หน้าควบคุม
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
        <div style={{ flex: 1 }}>
          <div className="text-caption">ภาคปฏิบัติ</div>
          <div className="text-title">คลาสที่เปิดอยู่</div>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          <Plus size={16} /> เปิดคลาส
        </button>
      </div>

      {creating && (
        <div className="card" style={{ marginTop: 12 }}>
          <label className="label">ชื่อคลาส</label>
          <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="เช่น รุ่นที่ 7 / 5 มิ.ย. 68" />
          <label className="label" style={{ marginTop: 10 }}>สถานที่</label>
          <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="เช่น ห้องประชุม รพ.ABC" />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setCreating(false)}>ยกเลิก</button>
            <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={create}>สร้าง</button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading && <div className="card text-caption">กำลังโหลด…</div>}
        {!loading && sessions.length === 0 && (
          <div className="card">
            <div className="text-body-strong">ยังไม่มีคลาส</div>
            <div className="text-caption">กดปุ่ม "เปิดคลาส" เพื่อสร้างคลาสภาคปฏิบัติใหม่</div>
            {!isSupabaseConfigured && (
              <div className="callout callout-info" style={{ marginTop: 8 }}>
                ยังไม่ได้เชื่อมต่อ Supabase — กรอก VITE_SUPABASE_URL/ANON_KEY ใน .env แล้ว deploy ใหม่
              </div>
            )}
          </div>
        )}
        {sessions.map((s) => (
          <Link key={s.id} to={`/admin/sessions/${s.id}`} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Calendar size={22} color="#2563EB" />
            <div style={{ flex: 1 }}>
              <div className="text-body-strong">{s.title}</div>
              <div className="text-caption">{s.location || 'ไม่ระบุสถานที่'} • รหัส {s.qr_token}</div>
            </div>
            {s.closed_at
              ? <span className="badge badge-muted">ปิดแล้ว</span>
              : <span className="badge badge-success">เปิดอยู่</span>}
          </Link>
        ))}
      </div>
    </div>
  )
}
