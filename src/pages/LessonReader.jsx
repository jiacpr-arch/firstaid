import { useParams, useNavigate, Link } from 'react-router-dom'
import { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, ChevronRight, CheckCircle2 } from 'lucide-react'
import { lessonsById, lessons } from '../courses/firstaid/lessons'
import LessonStep from '../components/LessonStep'
import { useEnsureLearner } from '../hooks/useLearner'
import { useLearnerStore } from '../stores/learnerStore'
import { useProgressStore } from '../stores/progressStore'
import { markLessonRead, saveQuizAttempt } from '../db/database'
import { fetchLessonMedia, mediaRowToStep } from '../utils/lessonMediaSteps'
import ProgressBar from '../components/ProgressBar'

export default function LessonReader() {
  useEnsureLearner()
  const { lessonId } = useParams()
  const navigate = useNavigate()
  const learner = useLearnerStore((s) => s.learner)
  const markReadStore = useProgressStore((s) => s.markRead)

  const lesson = lessonsById[lessonId]
  const [prevLessonId, setPrevLessonId] = useState(lessonId)
  const [stepIdx, setStepIdx] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [quizCount, setQuizCount] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [extraMedia, setExtraMedia] = useState([])

  // Reset state when lessonId changes — set-during-render pattern
  if (prevLessonId !== lessonId) {
    setPrevLessonId(lessonId)
    setStepIdx(0)
    setCorrectCount(0)
    setQuizCount(0)
    setCompleted(false)
  }

  // โหลดสื่อที่แอดมินผูกไว้กับบทนี้ (รูป/วิดีโอจาก Supabase)
  useEffect(() => {
    let cancelled = false
    fetchLessonMedia(lessonId).then((rows) => { if (!cancelled) setExtraMedia(rows) })
    return () => { cancelled = true }
  }, [lessonId])

  const steps = useMemo(() => lesson?.steps || [], [lesson])

  // จัดกลุ่มสื่อตามขั้น: after_step 1..len = ในขั้นนั้น; 0/ก่อนเริ่ม = หน้าปก; ว่าง/เกิน = ขั้นสุดท้าย
  const mediaByStep = useMemo(() => {
    const len = steps.length
    const map = new Map()
    for (const row of extraMedia) {
      let n = row.after_step
      if (n == null || n > len) n = len
      else if (n < 0) n = 0
      if (!map.has(n)) map.set(n, [])
      map.get(n).push(row)
    }
    return map
  }, [steps.length, extraMedia])

  // ลำดับสไลด์: หน้าปก (ถ้ามีรูป after_step=0) ก่อน แล้วตามด้วยแต่ละขั้นเนื้อหา
  const slides = useMemo(() => {
    const out = []
    const cover = mediaByStep.get(0)
    if (cover?.length) out.push({ kind: 'cover', media: cover })
    steps.forEach((s, i) => out.push({ kind: 'step', step: s, media: mediaByStep.get(i + 1) }))
    return out
  }, [steps, mediaByStep])

  if (!lesson) {
    return (
      <div className="page-container">
        <div className="card">ไม่พบบทเรียน</div>
        <Link to="/learn" className="btn btn-primary btn-block" style={{ marginTop: 12 }}>
          กลับไปหน้าบทเรียน
        </Link>
      </div>
    )
  }

  const slide = slides[stepIdx]
  const isLast = stepIdx === slides.length - 1
  const idx = lesson.order - 1
  const nextLesson = lessons[idx + 1]

  const finishLesson = async () => {
    if (!learner?.id) return
    await markLessonRead(learner.id, lesson.id)
    markReadStore(lesson.id)
    if (quizCount > 0) {
      const score = Math.round((correctCount / quizCount) * 100)
      await saveQuizAttempt({
        learnerId: learner.id,
        lessonId: lesson.id,
        score,
        correctCount,
        totalQuestions: quizCount,
        passed: score >= 70,
      })
    }
    setCompleted(true)
  }

  const onAnswered = (_id, correct) => {
    setQuizCount((c) => c + 1)
    if (correct) setCorrectCount((c) => c + 1)
  }

  const advance = () => {
    if (!isLast) setStepIdx((i) => i + 1)
    else finishLesson()
  }

  if (completed) {
    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: 'center', padding: 28 }}>
          <CheckCircle2 size={48} color="#10B981" style={{ margin: '0 auto' }} />
          <div className="text-title" style={{ marginTop: 12 }}>เรียนจบบทแล้ว!</div>
          <div className="text-caption" style={{ marginTop: 4 }}>{lesson.title}</div>
          {quizCount > 0 && (
            <div className="text-body" style={{ marginTop: 12 }}>
              ตอบคำถามถูก {correctCount} / {quizCount}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <Link to="/learn" className="btn btn-secondary" style={{ flex: 1 }}>
            <ArrowLeft size={16} /> รายการบท
          </Link>
          {nextLesson ? (
            <Link to={`/learn/${nextLesson.id}`} className="btn btn-primary" style={{ flex: 1 }}>
              บทถัดไป <ChevronRight size={16} />
            </Link>
          ) : (
            <Link to="/post-test" className="btn btn-primary" style={{ flex: 1 }}>
              ทำ Post-test <ChevronRight size={16} />
            </Link>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <button type="button" onClick={() => navigate('/learn')} className="btn btn-ghost" style={{ paddingLeft: 0 }}>
        <ArrowLeft size={16} /> รายการบท
      </button>
      <div style={{ marginTop: 4 }}>
        <div className="text-caption">บทที่ {lesson.order}</div>
        <div className="text-title">{lesson.title}</div>
      </div>
      <div style={{ marginTop: 12, marginBottom: 12 }}>
        <ProgressBar value={stepIdx + 1} max={slides.length} />
        <div className="text-caption" style={{ marginTop: 4 }}>
          {slide?.kind === 'cover' ? 'หน้าปก' : `ขั้นที่ ${stepIdx + 1} / ${slides.length}`}
        </div>
      </div>

      {slide?.kind === 'cover' ? (
        // สไลด์หน้าปก — แสดงเฉพาะรูป/วิดีโอ ก่อนเข้าเนื้อหา
        slide.media.map((row) => (
          <div key={row.id} style={{ marginBottom: 12 }}>
            <LessonStep step={mediaRowToStep(row)} />
          </div>
        ))
      ) : (
        <>
          <LessonStep step={slide.step} onQuizAnswered={onAnswered} />
          {/* รูป/วิดีโอที่ผูกกับขั้นนี้ — แสดงใต้เนื้อหาในสไลด์เดียวกัน */}
          {slide.media?.map((row) => (
            <div key={row.id} style={{ marginTop: 12 }}>
              <LessonStep step={mediaRowToStep(row)} />
            </div>
          ))}
        </>
      )}

      <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={advance}>
        {isLast ? 'จบบทเรียน' : 'ต่อไป'} <ChevronRight size={16} />
      </button>
    </div>
  )
}
