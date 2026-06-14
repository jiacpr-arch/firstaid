import { useEffect, useRef, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Upload, Trash2, Plus, X } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../config/supabaseClient'
import { lessons } from '../courses/firstaid/lessons'
import { scenarios } from '../courses/firstaid/scenarios'
import { algorithms } from '../courses/firstaid/algorithms'
import { uploadMedia, parseYouTubeId } from '../utils/mediaUpload'
import { mediaRowToStep } from '../utils/lessonMediaSteps'
import LessonStep from '../components/LessonStep'

const CONTENT_TYPES = {
  lesson: {
    label: 'บทเรียน',
    items: lessons,
    itemLabel: (l) => `บทที่ ${l.order} — ${l.title}`,
  },
  scenario: {
    label: 'สถานการณ์จำลอง',
    items: scenarios,
    itemLabel: (s) => s.title,
  },
  algorithm: {
    label: 'ผังช่วยชีวิต',
    items: algorithms,
    itemLabel: (a) => a.title,
  },
}

async function fetchRows(contentType, contentId) {
  if (!isSupabaseConfigured || !contentId) return []
  const { data } = await supabase
    .from('lesson_media')
    .select('*')
    .eq('content_type', contentType)
    .eq('lesson_id', contentId)
    .order('created_at', { ascending: true })
  return data || []
}

// Preview เนื้อหาแต่ละ step ตามประเภท
function StepPreview({ contentType, step, index }) {
  if (contentType === 'lesson') {
    return <LessonStep step={step} />
  }
  if (contentType === 'scenario') {
    return (
      <div className="card" style={{ background: 'var(--color-bg-secondary)', opacity: 0.85 }}>
        <div className="text-caption" style={{ marginBottom: 6 }}>ข้อ {index + 1}</div>
        <div className="text-body-strong" style={{ whiteSpace: 'pre-wrap', marginBottom: 8 }}>{step.prompt}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {step.choices?.map((c) => (
            <div key={c.id} style={{
              fontSize: 13, color: 'var(--color-text-secondary)',
              padding: '4px 10px', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
            }}>{c.text}</div>
          ))}
        </div>
      </div>
    )
  }
  // algorithm
  return (
    <div className="card" style={{ background: 'var(--color-bg-secondary)', opacity: 0.85 }}>
      <div className="text-caption" style={{ marginBottom: 4 }}>{step.kind}</div>
      <div className="text-body-strong">{step.text}</div>
      {step.detail && <div className="text-caption" style={{ marginTop: 4 }}>{step.detail}</div>}
    </div>
  )
}

// แผงอัปโหลด inline — โผล่ตรงจุดที่กดปุ่ม
function SlotUploader({ onSave, onCancel }) {
  const [caption, setCaption] = useState('')
  const [alt, setAlt] = useState('')
  const [youtube, setYoutube] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef(null)

  const save = async (extra) => {
    await onSave({ caption: caption.trim() || null, alt: alt.trim() || null, ...extra })
  }

  const handleFile = async (file) => {
    if (!file) return
    setErr(''); setBusy(true)
    try {
      const { url, kind } = await uploadMedia(file)
      await save({ kind, url })
    } catch (e) { setErr(e.message || 'อัปโหลดไม่สำเร็จ') }
    setBusy(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleYoutube = async () => {
    const id = parseYouTubeId(youtube)
    if (!id) { setErr('ลิงก์ YouTube ไม่ถูกต้อง'); return }
    setErr(''); setBusy(true)
    try { await save({ kind: 'video', youtube: id }) }
    catch (e) { setErr(e.message || 'เพิ่มไม่สำเร็จ') }
    setBusy(false)
  }

  return (
    <div className="card" style={{ border: '1.5px dashed var(--color-brand)', background: 'var(--color-brand-soft)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span className="text-body-strong">📎 แนบสื่อตรงนี้</span>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}
          style={{ padding: '2px 6px' }}>
          <X size={16} /> ยกเลิก
        </button>
      </div>

      <label className="label">คำบรรยายใต้สื่อ (caption)</label>
      <input className="input" value={caption} onChange={(e) => setCaption(e.target.value)}
        placeholder="ไม่ใส่ก็ได้" disabled={busy} />
      <label className="label" style={{ marginTop: 8 }}>ข้อความแทนรูป (alt)</label>
      <input className="input" value={alt} onChange={(e) => setAlt(e.target.value)}
        placeholder="ไม่ใส่ก็ได้" disabled={busy} />

      <div className="text-body-strong" style={{ marginTop: 12, marginBottom: 6 }}>① อัปไฟล์รูป/วิดีโอ</div>
      <input ref={fileRef} className="input" type="file" accept="image/*,video/*"
        disabled={!isSupabaseConfigured || busy}
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />

      <div className="text-body-strong" style={{ marginTop: 12, marginBottom: 6 }}>② หรือฝัง YouTube</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="input" value={youtube} onChange={(e) => setYoutube(e.target.value)}
          placeholder="วางลิงก์ YouTube" disabled={!isSupabaseConfigured || busy} />
        <button type="button" className="btn btn-primary"
          disabled={!isSupabaseConfigured || busy || !youtube.trim()} onClick={handleYoutube}>
          <Plus size={16} /> เพิ่ม
        </button>
      </div>

      {busy && <div className="text-caption" style={{ marginTop: 8 }}><Upload size={14} /> กำลังบันทึก…</div>}
      {err && <div className="callout callout-danger" style={{ marginTop: 8 }}>{err}</div>}
    </div>
  )
}

// ปุ่ม "+ ใส่รูปตรงนี้"
function AddSlotButton({ label, onClick, disabled }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '2px 0' }}>
      <button type="button" onClick={onClick} disabled={disabled} style={{
        fontSize: 13, color: disabled ? 'var(--color-text-secondary)' : 'var(--color-brand)',
        background: 'none', border: `1px dashed ${disabled ? 'var(--color-border)' : 'var(--color-brand)'}`,
        borderRadius: 'var(--radius)', padding: '5px 18px', cursor: disabled ? 'default' : 'pointer',
      }}>
        <Plus size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
        {label || 'ใส่รูปตรงนี้'}
      </button>
    </div>
  )
}

function Divider() {
  return <div style={{ borderTop: '1px solid var(--color-border)', margin: '2px 0' }} />
}

// การ์ดสื่อที่ผูกไว้ + ปุ่มลบ
function MediaCard({ row, onDelete }) {
  return (
    <div style={{ position: 'relative' }}>
      <LessonStep step={mediaRowToStep(row)} />
      <button type="button" onClick={() => onDelete(row)}
        title="ลบสื่อนี้"
        style={{
          position: 'absolute', top: 8, right: 8,
          background: 'white', border: '1px solid #FCA5A5',
          borderRadius: 'var(--radius)', padding: '3px 8px',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
        }}>
        <Trash2 size={14} color="#DC2626" />
      </button>
    </div>
  )
}

export default function AdminLessonMedia() {
  const [contentType, setContentType] = useState('lesson')
  const [contentId, setContentId] = useState(lessons[0]?.id || '')
  const [rows, setRows] = useState([])
  // activeSlot: { afterStep: N|null } สำหรับบทเรียน, { stepId: 'xxx' } สำหรับสถานการณ์/ผัง
  const [activeSlot, setActiveSlot] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [prevContentId, setPrevContentId] = useState(contentId)

  const cfg = CONTENT_TYPES[contentType]
  const isLesson = contentType === 'lesson'
  const item = useMemo(() => cfg.items.find((it) => it.id === contentId), [cfg, contentId])
  const steps = useMemo(() => item?.steps || [], [item])

  if (prevContentId !== contentId) {
    setPrevContentId(contentId)
    setActiveSlot(null)
  }

  const reload = () => fetchRows(contentType, contentId).then(setRows)

  const onChangeType = (t) => {
    setContentType(t)
    setContentId(CONTENT_TYPES[t].items[0]?.id || '')
    setActiveSlot(null)
  }

  useEffect(() => {
    let cancelled = false
    fetchRows(contentType, contentId).then((d) => { if (!cancelled) setRows(d) })
    return () => { cancelled = true }
  }, [contentType, contentId])

  // บันทึกสื่อลง DB โดยใช้ตำแหน่งจาก activeSlot
  const saveMedia = async (slot, extra) => {
    const position = isLesson
      ? { after_step: slot.afterStep ?? null }
      : { step_id: slot.stepId || null }
    const { caption, alt, ...rest } = extra
    const row = {
      content_type: contentType,
      lesson_id: contentId,
      caption: caption || null,
      alt: alt || null,
      ...position,
      ...rest,
    }
    const { error: e } = await supabase.from('lesson_media').insert(row)
    if (e) throw new Error(e.message)
    setActiveSlot(null)
    await reload()
  }

  const onDelete = async (row) => {
    if (!window.confirm('ลบสื่อนี้ออกจากเนื้อหา?')) return
    setDeleteError('')
    const { error: e } = await supabase.from('lesson_media').delete().eq('id', row.id)
    if (e) { setDeleteError(e.message); return }
    reload()
  }

  // จัดกลุ่มสื่อสำหรับ บทเรียน (by after_step: 0|1|2...|'end')
  const rowsByAfterStep = useMemo(() => {
    if (!isLesson) return new Map()
    const map = new Map()
    for (const r of rows) {
      const key = r.after_step ?? 'end'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(r)
    }
    return map
  }, [rows, isLesson])

  // จัดกลุ่มสื่อสำหรับ สถานการณ์/ผัง (by step_id)
  const rowsByStepId = useMemo(() => {
    if (isLesson) return new Map()
    const map = new Map()
    for (const r of rows) {
      const key = r.step_id || '__none__'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(r)
    }
    return map
  }, [rows, isLesson])

  // เปรียบเทียบ slot ว่าเปิดอยู่ไหม
  const isActiveSlot = (slot) => {
    if (!activeSlot) return false
    if (isLesson) return 'afterStep' in slot && slot.afterStep === activeSlot.afterStep
    return 'stepId' in slot && slot.stepId === activeSlot.stepId
  }

  const openSlot = (slot) => {
    if (!isSupabaseConfigured) return
    setActiveSlot(slot)
  }

  const renderSlot = (slot, label) => {
    const active = isActiveSlot(slot)
    const blocked = !active && activeSlot !== null
    if (active) {
      return (
        <SlotUploader
          key={JSON.stringify(slot)}
          onSave={(extra) => saveMedia(slot, extra)}
          onCancel={() => setActiveSlot(null)}
        />
      )
    }
    return (
      <AddSlotButton
        key={JSON.stringify(slot)}
        label={label}
        disabled={!isSupabaseConfigured || blocked}
        onClick={() => openSlot(slot)}
      />
    )
  }

  const renderMediaGroup = (mediaRows) =>
    mediaRows?.map((r) => <MediaCard key={r.id} row={r} onDelete={onDelete} />)

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
      {deleteError && (
        <div className="callout callout-danger" style={{ marginTop: 8 }}>{deleteError}</div>
      )}

      {/* เลือกเนื้อหา */}
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
          {steps.length} ขั้น · สื่อที่ผูกไว้ {rows.length} ชิ้น
          {activeSlot && <span style={{ color: 'var(--color-brand)' }}> · กำลังเพิ่มสื่อ…</span>}
        </div>
      </div>

      {/* Timeline */}
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {steps.length === 0 && (
          <div className="text-caption" style={{ textAlign: 'center', padding: 16 }}>ไม่พบข้อมูลเนื้อหา</div>
        )}

        {isLesson && steps.length > 0 && (
          <>
            {/* ก่อนขั้นแรก */}
            {renderMediaGroup(rowsByAfterStep.get(0))}
            {renderSlot({ afterStep: 0 }, 'ใส่รูปก่อนเริ่มบท')}
            <Divider />

            {steps.map((step, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* preview ขั้นนั้น */}
                <div style={{ position: 'relative' }}>
                  <div className="text-caption" style={{ marginBottom: 4, paddingLeft: 2, color: 'var(--color-text-secondary)' }}>
                    ขั้นที่ {idx + 1} / {steps.length}
                  </div>
                  <StepPreview contentType="lesson" step={step} index={idx} />
                </div>

                {/* สื่อที่ผูกหลังขั้นนี้ + ปุ่มเพิ่ม */}
                {renderMediaGroup(rowsByAfterStep.get(idx + 1))}
                {renderSlot(
                  { afterStep: idx + 1 },
                  idx === steps.length - 1 ? 'ใส่รูปท้ายบท' : 'ใส่รูปหลังขั้นนี้',
                )}
                {idx < steps.length - 1 && <Divider />}
              </div>
            ))}

            {/* ท้ายบท (after_step = null) */}
            {rowsByAfterStep.get('end')?.length > 0 && (
              <>
                <Divider />
                {renderMediaGroup(rowsByAfterStep.get('end'))}
              </>
            )}
          </>
        )}

        {!isLesson && steps.length > 0 && (
          <>
            {steps.map((step, idx) => (
              <div key={step.id || idx} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* preview step */}
                <div className="text-caption" style={{ marginBottom: 2, color: 'var(--color-text-secondary)' }}>
                  ขั้น {idx + 1} / {steps.length}
                </div>
                <StepPreview contentType={contentType} step={step} index={idx} />

                {/* สื่อที่ผูกกับ step นี้ */}
                {renderMediaGroup(rowsByStepId.get(step.id))}

                {/* ปุ่มเพิ่มสื่อ */}
                {renderSlot({ stepId: step.id }, 'ใส่รูปในขั้นนี้')}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
