import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Calendar, Plus, ArrowLeft, Store, Trash2, GraduationCap, HeartPulse } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../config/supabaseClient'
import { adminFetch } from '../utils/adminFetch'
import { useClassStore } from '../stores/classStore'

function makeSessionCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  let out = ''
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '')

export default function AdminSessions() {
  const navigate = useNavigate()
  const setClass = useClassStore((s) => s.setClass)
  // ทุกคลาสที่เคยเปิดจาก "คลาสของฉัน" (รวมที่ปิดแล้ว) — RLS ซ่อนจาก client จึงอ่านผ่าน API แอดมิน
  const [classes, setClasses] = useState(null)
  const [classError, setClassError] = useState('')
  const [sessions, setSessions] = useState([])
  const [cohorts, setCohorts] = useState([])
  const [loading, setLoading] = useState(() => isSupabaseConfigured)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: '', location: '', kind: 'session', cohortId: '' })

  useEffect(() => {
    let cancelled = false
    adminFetch('/api/classes/list')
      .then((r) => r.json().then((b) => [r.ok, b]))
      .then(([ok, b]) => {
        if (cancelled) return
        if (!ok) { setClassError(b.error || 'โหลดรายการคลาสไม่สำเร็จ'); setClasses([]); return }
        setClasses(b.classes || [])
      })
      .catch(() => { if (!cancelled) { setClassError('โหลดรายการคลาสไม่สำเร็จ'); setClasses([]) } })
    return () => { cancelled = true }
  }, [])

  // แตะคลาส → เปิดคลาสนั้นใน "คลาสของฉัน" (ดูภาพรวม/รายงานได้ แม้คลาสปิดแล้ว)
  const openClass = (c) => {
    if (!c.sessionId) return
    setClass({ classId: c.id, sessionId: c.sessionId, className: c.name, classCode: c.code, instructorCode: c.instructorCode || '' })
    navigate('/admin/teach')
  }

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

  // ลบรอบแบบเดิม (ไม่ผูกคลาส) — เช็คชื่อ/ฐาน/คะแนนของรอบนั้นถูกลบตาม (FK on delete cascade)
  // รอบของคลาสจาก "คลาสของฉัน" ลบที่นี่ไม่ได้ ให้ปิดคลาสที่หน้าคลาสแทน
  const remove = async (e, s) => {
    e.preventDefault()
    e.stopPropagation()
    if (s.cohort_id) return
    if (!window.confirm(`ลบรอบ "${s.title}" (รหัส ${s.qr_token})?\nข้อมูลเช็คชื่อของรอบนี้จะถูกลบด้วย และกู้คืนไม่ได้`)) return
    const { data, error } = await supabase.from('practical_sessions').delete().eq('id', s.id).is('cohort_id', null).select('id')
    if (error) { alert(error.message); return }
    if (!data?.length) { alert('ลบไม่สำเร็จ — รอบนี้อาจไม่ได้สร้างจากบัญชีนี้'); return }
    setSessions((list) => list.filter((x) => x.id !== s.id))
  }

  // รอบที่ผูกคลาสแสดงในรายการคลาสด้านบนแล้ว — ส่วนนี้เหลือเฉพาะรอบแบบเดิมที่ไม่ผูกคลาส
  const legacy = sessions.filter((x) => !x.cohort_id)

  return (
    <div className="page-container">
      <Link to="/admin" className="btn btn-ghost" style={{ paddingLeft: 0 }}>
        <ArrowLeft size={16} /> หน้าควบคุม
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
        <div style={{ flex: 1 }}>
          <div className="text-caption">ขั้นสูง</div>
          <div className="text-title">ประวัติวันอบรม & บูธแบบเดิม</div>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          <Plus size={16} /> เปิดรอบแยก
        </button>
      </div>

      <div className="callout callout-info" style={{ marginTop: 12 }}>
        <div className="text-body-strong">จะเปิดคลาสใหม่ (รวมคลาส CPR + ปฐมพยาบาล) ไม่ต้องใช้หน้านี้</div>
        <div className="text-caption" style={{ marginTop: 2 }}>
          รอบที่สร้างจากหน้านี้ไม่มีรหัสคลาสให้นักเรียน ไม่มีโค้ด CPR และจะไม่ขึ้นใน "คลาสของฉัน" —
          ใช้หน้านี้เฉพาะบูธ/งาน หรือรอบเช็คชื่อแยกเท่านั้น
        </div>
        <Link to="/admin/teach" className="btn btn-primary" style={{ marginTop: 8 }}>
          ไปสร้างคลาสที่ "คลาสของฉัน"
        </Link>
      </div>

      {creating && (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            {[['session', 'รอบเช็คชื่อแยก'], ['booth', 'บูธ / งาน']].map(([val, label]) => (
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
                ผูกแล้วผลเช็คชื่อจะขึ้นใน dashboard ของคลาสนั้น — สร้าง 1 รอบต่อ 1 ฐาน (เช่น "ฐาน CPR", "ฐาน AED")
              </div>
            </>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setCreating(false)}>ยกเลิก</button>
            <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={create}>สร้าง</button>
          </div>
        </div>
      )}

      <div className="text-body-strong" style={{ marginTop: 16 }}>คลาสทั้งหมดที่เคยเปิด{classes ? ` (${classes.length})` : ''}</div>
      <div className="text-caption">สร้างจาก "คลาสของฉัน" · ใหม่สุดก่อน · แตะเพื่อเปิดดูภาพรวม/รายงานของคลาสนั้น</div>
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {classes === null && <div className="card text-caption">กำลังโหลด…</div>}
        {classError && <div className="callout callout-danger">{classError}</div>}
        {classes && classes.length === 0 && !classError && <div className="card text-caption">ยังไม่มีคลาส</div>}
        {(classes || []).map((c) => (
          <button key={c.id} type="button" className="card card-hover" onClick={() => openClass(c)} disabled={!c.sessionId}
            style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', width: '100%' }}>
            <GraduationCap size={22} color="#0F766E" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="text-body-strong">{c.name}</div>
              <div className="text-caption">
                {[c.location, c.startsOn ? `เรียน ${fmtDate(c.startsOn)}` : `สร้าง ${fmtDate(c.createdAt)}`, `รหัส ${c.code}`,
                  `นักเรียน ${c.students}${c.maxStudents ? `/${c.maxStudents}` : ''} คน`].filter(Boolean).join(' • ')}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', flexShrink: 0 }}>
              {c.includesCpr && <span className="badge" style={{ background: '#FDECEC', color: '#B91C1C' }}><HeartPulse size={11} /> รวม CPR</span>}
              {c.closed
                ? <span className="badge badge-muted">ปิดแล้ว</span>
                : <span className="badge badge-success">เปิดอยู่</span>}
            </div>
          </button>
        ))}
      </div>

      <div className="text-body-strong" style={{ marginTop: 20 }}>รอบเช็คชื่อแยก / บูธแบบเดิม</div>
      <div className="text-caption">สร้างจากหน้านี้ ไม่มีรหัสคลาส — ลบได้</div>
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading && <div className="card text-caption">กำลังโหลด…</div>}
        {!loading && legacy.length === 0 && (
          <div className="card">
            <div className="text-body-strong">ไม่มีรอบแบบเดิม</div>
            <div className="text-caption">เปิดคลาสใหม่ที่ "คลาสของฉัน" — หน้านี้ใช้เฉพาะบูธ/รอบเช็คชื่อแยก</div>
            {!isSupabaseConfigured && (
              <div className="callout callout-info" style={{ marginTop: 8 }}>
                ยังไม่ได้เชื่อมต่อ Supabase — กรอก VITE_SUPABASE_URL/ANON_KEY ใน .env แล้ว deploy ใหม่
              </div>
            )}
          </div>
        )}
        {legacy.map((s) => (
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
              {!s.cohort_id && (
                <button type="button" className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: 12, color: '#B42318' }}
                  onClick={(e) => remove(e, s)} aria-label={`ลบรอบ ${s.title}`}>
                  <Trash2 size={13} /> ลบ
                </button>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
