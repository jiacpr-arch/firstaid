import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { isSupabaseConfigured } from '../config/supabaseClient'
import { lessons } from '../courses/firstaid/lessons'
import { parseYouTubeId } from '../utils/mediaUpload'
import {
  fetchAllLessonVideos, saveLessonVideo, deleteLessonVideo, validateLessonVideo,
} from '../utils/lessonVideo'
import { LessonVideo } from '../components/Media'
import VideoQuiz from '../components/VideoQuiz'

const CHOICE_IDS = ['a', 'b', 'c', 'd']

const blankQuestion = () => ({
  question: '',
  choices: [{ id: 'a', text: '' }, { id: 'b', text: '' }],
  correctId: 'a',
  explanation: '',
})

// ค่าเริ่มต้นของฟอร์มจากบทนั้น: DB → lessons.js → ว่าง
function initialForm(lesson, dbRow) {
  const v = dbRow || lesson?.video
  if (!v) return { youtube: '', orientation: 'portrait', quiz: [blankQuestion()] }
  return {
    youtube: v.youtube,
    orientation: v.orientation || 'portrait',
    quiz: v.quiz.map((q) => ({ explanation: '', ...q, choices: q.choices.map((c) => ({ ...c })) })),
  }
}

export default function AdminLessonVideos() {
  const [lessonId, setLessonId] = useState(lessons[0]?.id || '')
  const [rows, setRows] = useState(new Map())
  const [form, setForm] = useState(() => initialForm(lessons[0], null))
  const [loaded, setLoaded] = useState(!isSupabaseConfigured)
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [busy, setBusy] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [formKey, setFormKey] = useState(`${lessons[0]?.id}:0`)

  const lesson = useMemo(() => lessons.find((l) => l.id === lessonId), [lessonId])
  const dbRow = rows.get(lessonId)

  const reload = () => fetchAllLessonVideos().then((m) => { setRows(m); return m })

  useEffect(() => {
    let cancelled = false
    fetchAllLessonVideos().then((m) => {
      if (cancelled) return
      setRows(m)
      setForm(initialForm(lessons[0], m.get(lessons[0]?.id)))
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [])

  const pickLesson = (id) => {
    setLessonId(id)
    setForm(initialForm(lessons.find((l) => l.id === id), rows.get(id)))
    setMsg({ type: '', text: '' })
    setPreviewing(false)
    setFormKey(`${id}:${Date.now()}`)
  }

  const setQ = (qi, patch) =>
    setForm((f) => ({ ...f, quiz: f.quiz.map((q, i) => (i === qi ? { ...q, ...patch } : q)) }))
  const setChoice = (qi, ci, text) =>
    setForm((f) => ({
      ...f,
      quiz: f.quiz.map((q, i) =>
        i === qi ? { ...q, choices: q.choices.map((c, j) => (j === ci ? { ...c, text } : c)) } : q),
    }))
  const addChoice = (qi) =>
    setForm((f) => ({
      ...f,
      quiz: f.quiz.map((q, i) =>
        i === qi && q.choices.length < CHOICE_IDS.length
          ? { ...q, choices: [...q.choices, { id: CHOICE_IDS[q.choices.length], text: '' }] }
          : q),
    }))
  const removeChoice = (qi, ci) =>
    setForm((f) => ({
      ...f,
      quiz: f.quiz.map((q, i) => {
        if (i !== qi || q.choices.length <= 2) return q
        // เรียง id ใหม่ให้ต่อเนื่อง a,b,c… และย้าย correctId ตาม
        const removedId = q.choices[ci].id
        const kept = q.choices.filter((_, j) => j !== ci)
        const idMap = Object.fromEntries(kept.map((c, j) => [c.id, CHOICE_IDS[j]]))
        return {
          ...q,
          choices: kept.map((c, j) => ({ ...c, id: CHOICE_IDS[j] })),
          correctId: q.correctId === removedId ? CHOICE_IDS[0] : idMap[q.correctId],
        }
      }),
    }))

  const cleaned = () => ({
    youtube: parseYouTubeId(form.youtube),
    orientation: form.orientation,
    quiz: form.quiz.map((q) => ({
      question: q.question.trim(),
      choices: q.choices.map((c) => ({ id: c.id, text: c.text.trim() })),
      correctId: q.correctId,
      explanation: (q.explanation || '').trim(),
    })),
  })

  const onSave = async () => {
    const err = validateLessonVideo({ youtube: form.youtube, quiz: form.quiz })
    if (err) { setMsg({ type: 'danger', text: err }); return }
    setBusy(true)
    try {
      await saveLessonVideo(lessonId, cleaned())
      await reload()
      setMsg({ type: 'info', text: 'บันทึกแล้ว — ผู้เรียนเห็นทันทีที่เปิดบทนี้' })
    } catch (e) {
      setMsg({ type: 'danger', text: e.message || 'บันทึกไม่สำเร็จ (ตาราง lesson_videos สร้างแล้วหรือยัง?)' })
    }
    setBusy(false)
  }

  const onDelete = async () => {
    if (!window.confirm('ลบคลิปของบทนี้จากหลังบ้าน?')) return
    setBusy(true)
    try {
      await deleteLessonVideo(lessonId)
      const m = await reload()
      setForm(initialForm(lesson, m.get(lessonId)))
      setMsg({ type: 'info', text: 'ลบแล้ว' })
    } catch (e) {
      setMsg({ type: 'danger', text: e.message || 'ลบไม่สำเร็จ' })
    }
    setBusy(false)
  }

  const ytId = parseYouTubeId(form.youtube)
  const previewQuiz = useMemo(
    () => (previewing ? cleaned().quiz : []),
    [previewing, form], // eslint-disable-line react-hooks/exhaustive-deps
  )

  return (
    <div className="page-container">
      <Link to="/admin" className="btn btn-ghost" style={{ paddingLeft: 0 }}>
        <ArrowLeft size={16} /> หน้าควบคุม
      </Link>
      <div style={{ marginTop: 4 }}>
        <div className="text-caption">จัดการ</div>
        <div className="text-title">คลิปประจำบท + mini quiz</div>
        <div className="text-body" style={{ marginTop: 4 }}>
          ผู้เรียนต้องดูคลิปถึง 90% แล้วตอบ mini quiz ผ่าน 70% จึงเข้าเนื้อหาของบทได้
        </div>
      </div>

      {!isSupabaseConfigured && (
        <div className="callout callout-info" style={{ marginTop: 12 }}>
          ยังไม่ได้เชื่อมต่อ Supabase — ตั้งค่า env ก่อน
        </div>
      )}

      <label className="label" style={{ marginTop: 14 }}>เลือกบท</label>
      <select className="input" value={lessonId} onChange={(e) => pickLesson(e.target.value)}>
        {lessons.map((l) => (
          <option key={l.id} value={l.id}>
            {rows.has(l.id) || l.video ? '🎬 ' : ''}บทที่ {l.order} — {l.title}
          </option>
        ))}
      </select>
      <div className="text-caption" style={{ marginTop: 4 }}>
        🎬 = บทที่มีคลิปแล้ว {lesson?.video && !dbRow && '· บทนี้ตั้งไว้ใน lessons.js (บันทึกที่นี่จะทับค่านั้น)'}
      </div>

      {!loaded ? (
        <div className="text-caption" style={{ marginTop: 16 }}>กำลังโหลด…</div>
      ) : (
        <div key={formKey}>
          <label className="label" style={{ marginTop: 14 }}>ลิงก์หรือรหัสวิดีโอ YouTube (ตั้งเป็น Unlisted)</label>
          <input className="input" value={form.youtube} placeholder="https://youtu.be/xxxxxxxxxxx"
            onChange={(e) => setForm((f) => ({ ...f, youtube: e.target.value }))} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {[['portrait', 'แนวตั้ง 9:16'], ['landscape', 'แนวนอน 16:9']].map(([v, label]) => (
              <button key={v} type="button"
                className={form.orientation === v ? 'btn btn-primary' : 'btn btn-secondary'}
                onClick={() => setForm((f) => ({ ...f, orientation: v }))}>
                {label}
              </button>
            ))}
          </div>
          {ytId && (
            <div style={{ marginTop: 10, maxWidth: form.orientation === 'portrait' ? 240 : undefined }}>
              <LessonVideo youtube={ytId} title="พรีวิว" />
            </div>
          )}

          <div className="text-body-strong" style={{ marginTop: 18 }}>mini quiz (แนะนำ 3 ข้อ)</div>
          {form.quiz.map((q, qi) => (
            <div key={qi} className="card" style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-body-strong">ข้อ {qi + 1}</span>
                {form.quiz.length > 1 && (
                  <button type="button" className="btn btn-ghost" title="ลบข้อนี้"
                    onClick={() => setForm((f) => ({ ...f, quiz: f.quiz.filter((_, i) => i !== qi) }))}>
                    <Trash2 size={16} color="#DC2626" />
                  </button>
                )}
              </div>
              <textarea className="input" rows={2} value={q.question} placeholder="คำถาม (ถามสิ่งที่เห็นในคลิป)"
                onChange={(e) => setQ(qi, { question: e.target.value })} />
              {q.choices.map((c, ci) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <input type="radio" name={`correct-${qi}`} checked={q.correctId === c.id}
                    title="ข้อที่ถูก" onChange={() => setQ(qi, { correctId: c.id })} />
                  <input className="input" value={c.text} placeholder={`ตัวเลือก ${ci + 1}`}
                    onChange={(e) => setChoice(qi, ci, e.target.value)} />
                  {q.choices.length > 2 && (
                    <button type="button" className="btn btn-ghost" title="ลบตัวเลือก"
                      onClick={() => removeChoice(qi, ci)}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              <div className="text-caption" style={{ marginTop: 4 }}>จุดวงกลม = ข้อที่ถูก</div>
              {q.choices.length < CHOICE_IDS.length && (
                <button type="button" className="btn btn-ghost" onClick={() => addChoice(qi)}>
                  <Plus size={14} /> เพิ่มตัวเลือก
                </button>
              )}
              <input className="input" style={{ marginTop: 6 }} value={q.explanation || ''}
                placeholder="คำอธิบายหลังตอบ (ไม่ใส่ก็ได้)"
                onChange={(e) => setQ(qi, { explanation: e.target.value })} />
            </div>
          ))}
          <button type="button" className="btn btn-secondary" style={{ marginTop: 10 }}
            onClick={() => setForm((f) => ({ ...f, quiz: [...f.quiz, blankQuestion()] }))}>
            <Plus size={16} /> เพิ่มคำถาม
          </button>

          {msg.text && (
            <div className={`callout callout-${msg.type}`} style={{ marginTop: 12 }}>{msg.text}</div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" disabled={busy || !isSupabaseConfigured} onClick={onSave}>
              บันทึก
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => {
              const err = validateLessonVideo({ youtube: form.youtube, quiz: form.quiz })
              if (err) { setMsg({ type: 'danger', text: err }); return }
              setMsg({ type: '', text: '' }); setPreviewing((p) => !p)
            }}>
              {previewing ? 'ปิดพรีวิว quiz' : 'พรีวิว mini quiz'}
            </button>
            {dbRow && (
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={onDelete}>
                <Trash2 size={16} color="#DC2626" /> ลบคลิปของบทนี้
              </button>
            )}
          </div>

          {previewing && previewQuiz.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="text-caption" style={{ marginBottom: 6 }}>พรีวิว (ไม่บันทึกผล)</div>
              <VideoQuiz key={JSON.stringify(previewQuiz)} questions={previewQuiz} onComplete={() => {}} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
