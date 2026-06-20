import { useParams, useNavigate, Link } from 'react-router-dom'
import { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, ChevronRight, CheckCircle2, Lock } from 'lucide-react'
import { lessonsById, lessons } from '../courses/firstaid/lessons'
import LessonStep from '../components/LessonStep'
import { useEnsureLearner } from '../hooks/useLearner'
import { useLearnerStore } from '../stores/learnerStore'
import { useProgressStore } from '../stores/progressStore'
import { useEnsureProgress } from '../hooks/useProgress'
import { markLessonRead, saveQuizAttempt, upsertLearner } from '../db/database'
import { fetchLessonMedia, mediaRowToStep } from '../utils/lessonMediaSteps'
import ProgressBar from '../components/ProgressBar'
import LinePopup from '../components/LinePopup'
import LineLoginGate from '../components/LineLoginGate'
import { useAuthSession } from '../hooks/useAuthSession'
import { isSupabaseConfigured } from '../config/supabaseClient'
import { isLineLoginConfigured } from '../utils/lineAuth'
import { getNewBadge } from '../utils/badges'
import CertUpsellCard from '../components/CertUpsellCard'
import { track } from '../utils/analytics'

// ใช้ด่านล็อกอินจริงเมื่อพร้อมทั้ง Supabase Auth และ LINE Login channel เท่านั้น
const LINE_LOGIN_READY = isSupabaseConfigured && isLineLoginConfigured

export default function LessonReader() {
  useEnsureLearner()
  const { lessonId } = useParams()
  const navigate = useNavigate()
  const learner = useLearnerStore((s) => s.learner)
  const updateLearner = useLearnerStore((s) => s.updateLearner)
  const { session } = useAuthSession()
  const markReadStore = useProgressStore((s) => s.markRead)
  const readLessonIds = useProgressStore((s) => s.readLessonIds)
  const preTestDone = useProgressStore((s) => s.preTestDone)
  const postTestDone = useProgressStore((s) => s.postTestDone)
  const progressLoaded = useProgressStore((s) => s.loaded)
  useEnsureProgress(learner?.id)

  const lesson = lessonsById[lessonId]
  const [prevLessonId, setPrevLessonId] = useState(lessonId)
  const [stepIdx, setStepIdx] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [quizCount, setQuizCount] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [earnedBadge, setEarnedBadge] = useState(null)
  const [extraMedia, setExtraMedia] = useState([])

  // Reset state when lessonId changes — set-during-render pattern
  if (prevLessonId !== lessonId) {
    setPrevLessonId(lessonId)
    setStepIdx(0)
    setCorrectCount(0)
    setQuizCount(0)
    setCompleted(false)
    setEarnedBadge(null)
  }

  useEffect(() => {
    if (lesson) track('lesson_start', { lessonId: lesson.id, lessonOrder: lesson.order, lessonTitle: lesson.title })
  }, [lessonId]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // กันเข้าบทเรียนตรง ๆ ผ่าน URL ก่อนทำ Pre-test — รอโหลดสถานะก่อนค่อยตัดสิน
  // ยกเว้นบทแรก (order 1) ที่บังคับให้เรียนก่อนเสมอเป็นตัวดึงดูด — ข้าม Pre-test ได้
  if (progressLoaded && !preTestDone && lesson.order !== 1) {
    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: 'center', padding: 28 }}>
          <Lock size={44} color="var(--color-text-secondary)" style={{ margin: '0 auto' }} />
          <div className="text-title" style={{ marginTop: 12 }}>ยังเข้าบทเรียนไม่ได้</div>
          <div className="text-body" style={{ marginTop: 8 }}>
            กรุณาทำแบบทดสอบก่อนเรียน (Pre-test) ก่อน จึงจะเริ่มเรียนได้
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <Link to="/learn" className="btn btn-secondary" style={{ flex: 1 }}>
            <ArrowLeft size={16} /> รายการบท
          </Link>
          <Link to="/pre-test" className="btn btn-primary" style={{ flex: 1 }}>
            ไปทำ Pre-test <ChevronRight size={16} />
          </Link>
        </div>
      </div>
    )
  }

  const slide = slides[stepIdx]
  const isLast = stepIdx === slides.length - 1
  const idx = lesson.order - 1
  const nextLesson = lessons[idx + 1]

  const finishLesson = async () => {
    if (!learner?.id) return
    const newBadge = getNewBadge({ readLessonIds, postTestDone, lessonId: lesson.id })
    await markLessonRead(learner.id, lesson.id)
    markReadStore(lesson.id)
    localStorage.setItem('lastStudyDate', new Date().toISOString().slice(0, 10))
    if (newBadge) track('badge_earned', { badgeId: newBadge.id, lessonId: lesson.id })
    const quizScore = quizCount > 0 ? Math.round((correctCount / quizCount) * 100) : null
    if (quizCount > 0) {
      await saveQuizAttempt({
        learnerId: learner.id,
        lessonId: lesson.id,
        score: quizScore,
        correctCount,
        totalQuestions: quizCount,
        passed: quizScore >= 70,
      })
    }
    setEarnedBadge(newBadge)
    track('lesson_complete', {
      lessonId: lesson.id,
      lessonOrder: lesson.order,
      lessonTitle: lesson.title,
      ...(quizScore !== null ? { quizScore, quizCorrect: correctCount, quizTotal: quizCount } : {}),
    })
    setCompleted(true)
  }

  const onAnswered = (_id, correct) => {
    setQuizCount((c) => c + 1)
    if (correct) setCorrectCount((c) => c + 1)
  }

  // จบบทแรกแล้วต้องล็อกอินด้วย LINE ก่อน จึงจะเรียนต่อ/ใช้งานส่วนอื่นได้
  // โหมดปกติ: เช็คจาก Supabase session. โหมด degraded (LINE login ยังไม่พร้อม): honor-system เดิม
  const needLoginGate =
    completed && lesson.order === 1 && (LINE_LOGIN_READY ? !session : !learner?.lineAdded)
  const confirmLine = async () => {
    updateLearner({ lineAdded: true })
    if (learner?.id) {
      try {
        await upsertLearner({ ...learner, lineAdded: true })
      } catch {
        /* sync ล้มเหลวไม่เป็นไร — สถานะ local พอให้เรียนต่อได้ */
      }
    }
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
        {earnedBadge && (
          <div className="card" style={{ marginTop: 12, textAlign: 'center', padding: 20, background: '#FFFBEB', border: '1.5px solid #FDE68A' }}>
            <div style={{ fontSize: 40 }}>{earnedBadge.emoji}</div>
            <div className="text-body-strong" style={{ marginTop: 8 }}>ปลดล็อกแล้ว: {earnedBadge.label}</div>
            <div className="text-caption" style={{ marginTop: 4 }}>{earnedBadge.desc}</div>
          </div>
        )}
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
        {/* เรียนครบทุกบทแล้ว — ชวนมาอบรมปฏิบัติจริง */}
        {!nextLesson && <CertUpsellCard source="lesson_complete_all" />}
        {needLoginGate && (
          LINE_LOGIN_READY
            ? <LineLoginGate />
            : <LinePopup onConfirm={confirmLine} />
        )}
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
