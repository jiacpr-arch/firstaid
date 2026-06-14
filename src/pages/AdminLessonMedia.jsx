import { useEffect, useRef, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Upload, Trash2, Image as ImageIcon, Film, Plus } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../config/supabaseClient'
import { lessons } from '../courses/firstaid/lessons'
import { scenarios } from '../courses/firstaid/scenarios'
import { algorithms } from '../courses/firstaid/algorithms'
import { uploadMedia, parseYouTubeId } from '../utils/mediaUpload'
import { mediaRowToStep } from '../utils/lessonMediaSteps'
import LessonStep from '../components/LessonStep'

// แต่ละประเภทเนื้อหา: รายการ, ฉลาก, และวิธีอ่าน step (id + ข้อความตัวอย่าง)
const CONTENT_TYPES = {
  lesson: {
    label: 'บทเรียน',
    items: lessons,
    itemLabel: (l) => `บทที่ ${l.order} — ${l.title}`,
    stepLabel: (s) => s.heading || s.body?.slice(0, 40) || s.question?.slice(0, 40) || s.type,
  },
  scenario: {
    label: 'สถานการณ์จำลอง',
    items: scenarios,
    itemLabel: (s) => s.title,
    stepLabel: (s) => s.prompt?.slice(0, 50) || s.id,
  },
  algorithm: {
    label: 'ผังช่วยชีวิต',
    items: algorithms,
    itemLabel: (a) => a.title,
    stepLabel: (s) => s.text?.slice(0, 50) || s.id,
  },
}

async function fetchRows(contentType, contentId) {
  if (!isSupabaseConfigured || !contentId) return []
  const { data } = await supabase
    .from('lesson_media')
    .select('*')
    .eq('content_type', contentType)
    .eq('lesson_id', contentId)
    .order('after_step', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
  return data || []
}

export default function AdminLessonMedia() {
  const [contentType, setContentType] = useState('lesson')
  const [contentId, setContentId] = useState(lessons[0]?.id || '')
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [afterStep, setAfterStep] = useState('')
  const [stepId, setStepId] = useState('')
  const [alt, setAlt] = useState('')
  const [caption, setCaption] = useState('')
  const [youtube, setYoutube] = useState('')
  const fileRef = useRef(null)

  const [prevContentId, setPrevContentId] = useState(contentId)

  const cfg = CONTENT_TYPES[contentType]
  const isLesson = contentType === 'lesson'
  const item = useMemo(() => cfg.items.find((it) => it.id === contentId), [cfg, contentId])
  const steps = useMemo(() => item?.steps || [], [item])
  const stepCount = steps.length

  // เปลี่ยนเนื้อหา → รีเซ็ตตำแหน่ง (set-during-render pattern)
  if (prevContentId !== contentId) {
    setPrevContentId(contentId)
    setStepId(steps[0]?.id || '')
    setAfterStep('')
  }

  const reload = () => fetchRows(contentType, contentId).then(setRows)

  // เปลี่ยนประเภท → รีเซ็ตเป็นเนื้อหาแรกของประเภทนั้น
  const onChangeType = (t) => {
    setContentType(t)
    setContentId(CONTENT_TYPES[t].items[0]?.id || '')
  }

  useEffect(() => {
    let cancelled = false
    fetchRows(contentType, contentId).then((d) => { if (!cancelled) setRows(d) })
    return () => { cancelled = true }
  }, [contentType, contentId])

  const afterStepValue = () => {
    const t = afterStep.trim()
    if (t === '') return null
    const n = parseInt(t, 10)
    return Number.isNaN(n) ? null : Math.max(0, n)
  }

  const insertRow = async (extra) => {
    const position = isLesson
      ? { after_step: afterStepValue() }
      : { step_id: stepId || null }
    const row = {
      content_type: contentType,
      lesson_id: contentId,
      alt: alt.trim() || null,
      caption: caption.trim() || null,
      ...position,
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
    if (!window.confirm('ลบสื่อนี้ออกจากเนื้อหา?')) return
    const { error: e } = await supabase.from('lesson_media').delete().eq('id', row.id)
    if (e) { setError(e.message); return }
    reload()
  }

  const stepLabels = useMemo(() => {
    const map = {}
    steps.forEach((s, i) => { map[s.id] = `${i + 1}. ${cfg.stepLabel(s)}` })
    return map
  }, [steps, cfg])

  const posLabel = (row) => {
    if (row.content_type === 'lesson') {
      const a = row.after_step
      return a == null ? 'ท้ายบท' : a === 0 ? 'ก่อนขั้นแรก' : `หลังขั้นที่ ${a}`
    }
    return row.step_id ? (stepLabels[row.step_id] || `ขั้น ${row.step_id}`) : 'ไม่ระบุขั้น'
  }

  return (
    <div className="page-container">
      <Link to="/admin" className="btn btn-ghost" style={{ paddingLeft: 0 }}>
        <ArrowLeft size={16} /> หน้าควบคุม
      </Link>
      <div style={{ marginTop: 4 }}>
        <div className="text-caption">จัดการ</div>
        <div className="text-title">ใส่รูป/วิดีโอในเนื้อหา</div>
      </div>

      {!isSupabaseConfigured && (
        <div className="callout callout-info" style={{ marginTop: 12 }}>
          ยังไม่ได้เชื่อมต่อ Supabase — ตั้งค่า env ก่อน
        </div>
      )}

      <div className="card" style={{ marginTop: 12 }}>
        <label className="label">ประเภทเนื้อหา</label>
        <select className="input" value={contentType} onChange={(e) => onChangeType(e.target.value)}>
          {Object.entries(CONTENT_TYPES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        <label className="label" style={{ marginTop: 10 }}>เลือก{cfg.label}</label>
        <select className="input" value={contentId} onChange={(e) => setContentId(e.target.value)}>
          {cfg.items.map((it) => (
            <option key={it.id} value={it.id}>{cfg.itemLabel(it)}</option>
          ))}
        </select>
        <div className="text-caption" style={{ marginTop: 6 }}>
          เนื้อหานี้มี {stepCount} ขั้น (ไม่รวมสื่อที่เพิ่ม)
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="text-headline" style={{ marginBottom: 8 }}>เพิ่มสื่อ</div>

        {isLesson ? (
          <div>
            <label className="label">แทรกหลังขั้นที่</label>
            <input className="input" inputMode="numeric" value={afterStep}
              onChange={(e) => setAfterStep(e.target.value)} placeholder={`ว่าง = ท้ายบท (1–${stepCount})`} />
          </div>
        ) : (
          <div>
            <label className="label">แสดงรูปในขั้น</label>
            <select className="input" value={stepId} onChange={(e) => setStepId(e.target.value)}>
              {steps.map((s) => (
                <option key={s.id} value={s.id}>{stepLabels[s.id]}</option>
              ))}
            </select>
          </div>
        )}
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
        <div className="text-headline" style={{ marginBottom: 8 }}>สื่อในเนื้อหานี้ ({rows.length})</div>
        <div className="text-caption" style={{ marginBottom: 8 }}>แสดงตัวอย่างเหมือนที่ผู้เรียนจะเห็นจริง</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((r) => (
            <div key={r.id} className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                {r.kind === 'image' ? <ImageIcon size={14} /> : <Film size={14} />}
                <span className="text-body-strong">
                  {r.kind === 'image' ? 'รูป' : r.youtube ? 'YouTube' : 'วิดีโอ'}
                </span>
                <span className="badge badge-muted">{posLabel(r)}</span>
                <div style={{ flex: 1 }} />
                <button type="button" className="btn btn-ghost" onClick={() => onDelete(r)} title="ลบ">
                  <Trash2 size={16} color="#DC2626" />
                </button>
              </div>
              <LessonStep step={mediaRowToStep(r)} />
            </div>
          ))}
          {isSupabaseConfigured && !rows.length && (
            <div className="text-caption" style={{ textAlign: 'center', padding: 12 }}>ยังไม่มีสื่อในเนื้อหานี้</div>
          )}
        </div>
      </div>
    </div>
  )
}
