import { useParams, useNavigate, Link } from 'react-router-dom'
import { useState } from 'react'
import { ArrowLeft, ChevronRight, CheckCircle2 } from 'lucide-react'
import { lessonsById, lessons } from '../courses/firstaid/lessons'
import LessonStep from '../components/LessonStep'
import { useEnsureLearner } from '../hooks/useLearner'
import { useLearnerStore } from '../stores/learnerStore'
import { useProgressStore } from '../stores/progressStore'
import { markLessonRead, saveQuizAttempt } from '../db/database'
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

  // Reset state when lessonId changes — set-during-render pattern
  if (prevLessonId !== lessonId) {
    setPrevLessonId(lessonId)
    setStepIdx(0)
    setCorrectCount(0)
    setQuizCount(0)
    setCompleted(false)
  }

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

  const step = lesson.steps[stepIdx]
  const isLast = stepIdx === lesson.steps.length - 1
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
        <ProgressBar value={stepIdx + 1} max={lesson.steps.length} />
        <div className="text-caption" style={{ marginTop: 4 }}>
          ขั้นที่ {stepIdx + 1} / {lesson.steps.length}
        </div>
      </div>

      <LessonStep step={step} onQuizAnswered={onAnswered} />

      <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={advance}>
        {isLast ? 'จบบทเรียน' : 'ต่อไป'} <ChevronRight size={16} />
      </button>
    </div>
  )
}
