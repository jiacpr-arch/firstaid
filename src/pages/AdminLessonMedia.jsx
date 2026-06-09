import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Upload, Trash2, Image as ImageIcon, Film, Plus } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../config/supabaseClient'
import { lessons } from '../courses/firstaid/lessons'
import { uploadMedia, parseYouTubeId } from '../utils/mediaUpload'

async function fetchRows(lessonId) {
  if (!isSupabaseConfigured || !lessonId) return []
  const { data } = await supabase
    .from('lesson_media')
    .select('*')
    .eq('lesson_id', lessonId)
    .order('after_step', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
  return data || []
}

export default function AdminLessonMedia() {
  const [lessonId, setLessonId] = useState(lessons[0]?.id || '')
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [afterStep, setAfterStep] = useState('')
  const [alt, setAlt] = useState('')
  const [caption, setCaption] = useState('')
  const [youtube, setYoutube] = useState('')
  const fileRef = useRef(null)

  const lesson = lessons.find((l) => l.id === lessonId)
  const stepCount = lesson?.steps.length || 0

  const reload = () => fetchRows(lessonId).then(setRows)

  useEffect(() => {
    let cancelled = false
    fetchRows(lessonId).then((d) => { if (!cancelled) setRows(d) })
    return () => { cancelled = true }
  }, [lessonId])

  const afterStepValue = () => {
    const t = afterStep.trim()
    if (t === '') return null
    const n = parseInt(t, 10)
    return Number.isNaN(n) ? null : Math.max(0, n)
  }

  const insertRow = async (extra) => {
    const row = {
      lesson_id: lessonId,
      after_step: afterStepValue(),
      alt: alt.trim() || null,
      caption: caption.trim() || null,
      ...extra,
    }
    const { error: e } = await supabase.from('lesson_media').insert(row)
    if (e) { setError(e.message); return false }
    return true
  }

  const clearForm = () => { setAlt(''); setCaption(''); setAfterStep(''); setYoutube('') }

  const onFile = async (file) => {
    if (!file || !isSupabaseConfigured) return
    setError(''); setBusy(true)
    try {
      const { url, kind } = await uploadMedia(file)
      if (await insertRow({ kind, url })) { clearForm(); await reload() }
    } catch (e) { setError(e.message || 'อัปโหลดไม่สำเร็จ') }
    setBusy(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const onAddYoutube = async () => {
    const id = parseYouTubeId(youtube)
    if (!id) { setError('ลิงก์หรือรหัส YouTube ไม่ถูกต้อง'); return }
    setError(''); setBusy(true)
    if (await insertRow({ kind: 'video', youtube: id })) { clearForm(); await reload() }
    setBusy(false)
  }

  const onDelete = async (row) => {
    if (!window.confirm('ลบสื่อนี้ออกจากบทเรียน?')) return
    const { error: e } = await supabase.from('lesson_media').delete().eq('id', row.id)
    if (e) { setError(e.message); return }
    reload()
  }

  const posLabel = (after) =>
    after == null ? 'ท้ายบท' : after === 0 ? 'ก่อนขั้นแรก' : `หลังขั้นที่ ${after}`

  return (
    <div className="page-container">
      <Link to="/admin" className="btn btn-ghost" style={{ paddingLeft: 0 }}>
        <ArrowLeft size={16} /> หน้าควบคุม
      </Link>
      <div style={{ marginTop: 4 }}>
        <div className="text-caption">จัดการ</div>
        <div className="text-title">ใส่รูป/วิดีโอในบทเรียน</div>
      </div>

      {!isSupabaseConfigured && (
        <div className="callout callout-info" style={{ marginTop: 12 }}>
          ยังไม่ได้เชื่อมต่อ Supabase — ตั้งค่า env ก่อน
        </div>
      )}

      <div className="card" style={{ marginTop: 12 }}>
        <label className="label">เลือกบทเรียน</label>
        <select className="input" value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>บทที่ {l.order} — {l.title}</option>
          ))}
        </select>
        <div className="text-caption" style={{ marginTop: 6 }}>
          บทนี้มี {stepCount} ขั้น (ไม่รวมสื่อที่เพิ่ม)
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="text-headline" style={{ marginBottom: 8 }}>เพิ่มสื่อ</div>

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label className="label">แทรกหลังขั้นที่</label>
            <input className="input" inputMode="numeric" value={afterStep}
              onChange={(e) => setAfterStep(e.target.value)} placeholder={`ว่าง = ท้ายบท (1–${stepCount})`} />
          </div>
        </div>
        <label className="label" style={{ marginTop: 10 }}>คำบรรยายใต้สื่อ (caption)</label>
        <input className="input" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="ไม่ใส่ก็ได้" />
        <label className="label" style={{ marginTop: 10 }}>ข้อความแทนรูป (alt — เพื่อการเข้าถึง)</label>
        <input className="input" value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="ไม่ใส่ก็ได้" />

        <div className="text-body-strong" style={{ marginTop: 14, marginBottom: 6 }}>① อัปไฟล์รูป/วิดีโอ</div>
        <input ref={fileRef} className="input" type="file" accept="image/*,video/*"
          disabled={!isSupabaseConfigured || busy}
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />

        <div className="text-body-strong" style={{ marginTop: 14, marginBottom: 6 }}>② หรือฝังวิดีโอ YouTube</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" value={youtube} onChange={(e) => setYoutube(e.target.value)}
            placeholder="วางลิงก์ YouTube หรือรหัสวิดีโอ" disabled={!isSupabaseConfigured || busy} />
          <button type="button" className="btn btn-primary" disabled={!isSupabaseConfigured || busy || !youtube.trim()}
            onClick={onAddYoutube}><Plus size={16} /> เพิ่ม</button>
        </div>

        {busy && <div className="text-caption" style={{ marginTop: 10 }}><Upload size={14} /> กำลังบันทึก…</div>}
        {error && <div className="callout callout-danger" style={{ marginTop: 10 }}>{error}</div>}
      </div>

      <div style={{ marginTop: 16 }}>
        <div className="text-headline" style={{ marginBottom: 8 }}>สื่อในบทนี้ ({rows.length})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((r) => {
            const thumb = r.kind === 'image' ? r.url
              : r.youtube ? `https://img.youtube.com/vi/${r.youtube}/default.jpg` : null
            return (
              <div key={r.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {thumb
                  ? <img src={thumb} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--color-border)' }} />
                  : <div style={{ width: 56, height: 56, borderRadius: 8, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Film size={22} color="#fff" /></div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="text-body-strong" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {r.kind === 'image' ? <ImageIcon size={14} /> : <Film size={14} />}
                    {r.kind === 'image' ? 'รูป' : r.youtube ? 'YouTube' : 'วิดีโอ'}
                    <span className="badge badge-muted" style={{ marginLeft: 4 }}>{posLabel(r.after_step)}</span>
                  </div>
                  <div className="text-caption" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.caption || r.url || r.youtube}
                  </div>
                </div>
                <button type="button" className="btn btn-ghost" onClick={() => onDelete(r)} title="ลบ">
                  <Trash2 size={16} color="#DC2626" />
                </button>
              </div>
            )
          })}
          {isSupabaseConfigured && !rows.length && (
            <div className="text-caption" style={{ textAlign: 'center', padding: 12 }}>ยังไม่มีสื่อในบทนี้</div>
          )}
        </div>
      </div>
    </div>
  )
}
