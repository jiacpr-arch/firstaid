import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Plus, ArrowLeft, Store } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../config/supabaseClient'

function makeSessionCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  let out = ''
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export default function AdminSessions() {
  const [sessions, setSessions] = useState([])
  const [cohorts, setCohorts] = useState([])
  const [loading, setLoading] = useState(() => isSupabaseConfigured)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: '', location: '', kind: 'session', cohortId: '' })

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
    // คลาส (cohorts) สำหรับผูก session เข้ากับห้องเรียน — โชว์ผลเช็คชื่อบน dashboard คลาส
    supabase
      .from('cohorts')
      .select('id, name')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (!cancelled) setCohorts(data || []) })
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
      kind: form.kind,
      cohort_id: form.cohortId || null,
      starts_at: new Date().toISOString(),
    }
    const { data, error } = await supabase.from('practical_sessions').insert(row).select().single()
    if (error) { alert(error.message); return }
    setSessions((s) => [data, ...s])
    setCreating(false)
    setForm({ title: '', location: '', kind: 'session', cohortId: '' })
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            {[['session', 'คลาสปฏิบัติ'], ['booth', 'บูธ / งาน']].map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setForm({ ...form, kind: val })}
                style={{
                  padding: '10px', borderRadius: 10, fontWeight: 700, fontSize: 13,
                  border: `2px solid ${form.kind === val ? 'var(--color-brand)' : 'var(--color-border)'}`,
                  background: form.kind === val ? 'var(--color-brand-soft)' : 'var(--color-bg-secondary)',
                  color: form.kind === val ? 'var(--color-brand)' : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {val === 'booth' ? <Store size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> : <Calendar size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />}
                {label}
              </button>
            ))}
          </div>
          <label className="label">ชื่อ{form.kind === 'booth' ? 'บูธ/งาน' : 'คลาส'}</label>
          <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={form.kind === 'booth' ? 'เช่น Health Expo 2025' : 'เช่น รุ่นที่ 7 / 5 มิ.ย. 68'} />
          <label className="label" style={{ marginTop: 10 }}>สถานที่</label>
          <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="เช่น ห้องประชุม รพ.ABC" />
          {form.kind === 'session' && cohorts.length > 0 && (
            <>
              <label className="label" style={{ marginTop: 10 }}>ผูกกับคลาส (ไม่บังคับ)</label>
              <select className="input" value={form.cohortId} onChange={(e) => setForm({ ...form, cohortId: e.target.value })}>
                <option value="">— ไม่ผูกคลาส —</option>
                {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="text-caption" style={{ marginTop: 4 }}>
                ผูกแล้วผลเช็คชื่อจะขึ้นใน dashboard ของคลาสนั้น — สร้าง 1 session ต่อ 1 ฐาน (เช่น "ฐาน CPR", "ฐาน AED")
              </div>
            </>
          )}
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
            {s.kind === 'booth'
              ? <Store size={22} color="#7C3AED" />
              : <Calendar size={22} color="#2563EB" />}
            <div style={{ flex: 1 }}>
              <div className="text-body-strong">{s.title}</div>
              <div className="text-caption">{s.location || 'ไม่ระบุสถานที่'} • รหัส {s.qr_token}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
              {s.kind === 'booth' && <span className="badge" style={{ background: '#EDE9FE', color: '#5B21B6' }}>บูธ</span>}
              {s.closed_at
                ? <span className="badge badge-muted">ปิดแล้ว</span>
                : <span className="badge badge-success">เปิดอยู่</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
