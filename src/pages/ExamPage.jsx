import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, ChevronRight, CheckCircle2, XCircle } from 'lucide-react'
import { preTest, postTest } from '../courses/firstaid/exams'
import { useEnsureLearner } from '../hooks/useLearner'
import { useLearnerStore } from '../stores/learnerStore'
import { saveExamAttempt } from '../db/database'
import ProgressBar from '../components/ProgressBar'

export default function ExamPage({ kind }) {
  useEnsureLearner()
  const exam = kind === 'pre' ? preTest : postTest
  const navigate = useNavigate()
  const learner = useLearnerStore((s) => s.learner)

  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState({})
  const [done, setDone] = useState(null)

  const q = exam.questions[idx]
  const isLast = idx === exam.questions.length - 1

  const choose = (cid) => setAnswers((a) => ({ ...a, [q.id]: cid }))

  const next = async () => {
    if (!answers[q.id]) return
    if (!isLast) {
      setIdx((i) => i + 1)
      return
    }
    const correctCount = exam.questions.filter((qq) => answers[qq.id] === qq.correctId).length
    const score = Math.round((correctCount / exam.questions.length) * 100)
    const passing = exam.passingScore ?? 0
    const passed = score >= passing
    const result = {
      learnerId: learner.id,
      kind,
      score,
      correctCount,
      totalQuestions: exam.questions.length,
      answers,
      passed,
    }
    await saveExamAttempt(result)
    setDone(result)
  }

  if (done) {
    const passedTheory = kind === 'post' && done.passed
    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: 'center', padding: 28 }}>
          {done.passed ? (
            <CheckCircle2 size={48} color="#10B981" style={{ margin: '0 auto' }} />
          ) : (
            <XCircle size={48} color="#DC2626" style={{ margin: '0 auto' }} />
          )}
          <div className="text-title" style={{ marginTop: 12 }}>
            คะแนน {done.score}%
          </div>
          <div className="text-caption">{done.correctCount} / {done.totalQuestions} ข้อ</div>
          {kind === 'post' && (
            <div className="text-body" style={{ marginTop: 10 }}>
              {done.passed
                ? 'ยินดีด้วย — ผ่านแบบทดสอบหลังเรียนแล้ว ระบบจะออกใบประกาศภาคทฤษฎีให้คุณ'
                : `ยังไม่ผ่าน (ต้องได้ ≥ ${exam.passingScore}%) ลองทบทวนบทเรียนแล้วทำใหม่ได้`}
            </div>
          )}
        </div>

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {exam.questions.map((qq, i) => {
            const selected = answers[qq.id]
            const correct = selected === qq.correctId
            return (
              <div key={qq.id} className="card">
                <div className="text-body-strong" style={{ marginBottom: 6 }}>
                  {i + 1}. {qq.question}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {correct ? <CheckCircle2 size={16} color="#10B981" /> : <XCircle size={16} color="#DC2626" />}
                  <span className="text-body">
                    ตอบ: {qq.choices.find((c) => c.id === selected)?.text || '—'}
                  </span>
                </div>
                {!correct && (
                  <div className="text-caption" style={{ marginTop: 4 }}>
                    คำตอบที่ถูก: {qq.choices.find((c) => c.id === qq.correctId)?.text}
                  </div>
                )}
                {qq.explanation && (
                  <div className="callout callout-info" style={{ marginTop: 8 }}>
                    {qq.explanation}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <Link to="/learn" className="btn btn-secondary" style={{ flex: 1 }}>
            กลับไปบทเรียน
          </Link>
          {passedTheory ? (
            <Link to="/certificate" className="btn btn-primary" style={{ flex: 1 }}>
              ดูใบประกาศ
            </Link>
          ) : (
            <button type="button" className="btn btn-primary" style={{ flex: 1 }}
              onClick={() => { setIdx(0); setAnswers({}); setDone(null) }}>
              ทำใหม่
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <button type="button" onClick={() => navigate('/learn')} className="btn btn-ghost" style={{ paddingLeft: 0 }}>
        <ArrowLeft size={16} /> ออก
      </button>
      <div className="text-caption">{exam.description}</div>
      <div className="text-title">{exam.title}</div>
      <div style={{ marginTop: 12 }}>
        <ProgressBar value={idx + 1} max={exam.questions.length} />
        <div className="text-caption" style={{ marginTop: 4 }}>
          ข้อ {idx + 1} / {exam.questions.length}
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="text-headline" style={{ marginBottom: 12 }}>{q.question}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {q.choices.map((c) => {
            const isSelected = answers[q.id] === c.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => choose(c.id)}
                style={{
                  textAlign: 'left',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius)',
                  border: `1.5px solid ${isSelected ? 'var(--color-brand)' : 'var(--color-border)'}`,
                  background: isSelected ? 'var(--color-brand-soft)' : 'var(--color-bg-secondary)',
                }}
              >
                {c.text}
              </button>
            )
          })}
        </div>
      </div>

      <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 14 }}
        disabled={!answers[q.id]} onClick={next}>
        {isLast ? 'ส่งคำตอบทั้งหมด' : 'ข้อต่อไป'} <ChevronRight size={16} />
      </button>
    </div>
  )
}
