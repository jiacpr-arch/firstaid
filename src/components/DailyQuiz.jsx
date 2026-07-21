import { useMemo, useState } from 'react'
import { Sparkles, Check, X } from 'lucide-react'
import { lessons } from '../courses/firstaid/lessons'

// ควิซประจำวัน — วันละ 1 ข้อจากคลังควิซในบทเรียน (ข้อเดิมทั้งวัน หมุนทุกวัน)
// ตอบแล้วเก็บใน localStorage กันตอบซ้ำ พรุ่งนี้ได้ข้อใหม่ — คู่กับ streak เพื่อดึงคนกลับมาทุกวัน

// คลังรวมทุก quiz step จากทั้ง 24 บท (id คงที่ต่อข้อ ใช้ debug/analytics ได้)
const pool = lessons.flatMap((lesson) =>
  lesson.steps
    .filter((s) => s.type === 'quiz' && s.question && s.choices?.length && s.correctId)
    .map((s, i) => ({ ...s, id: `${lesson.id}:${i}`, lessonId: lesson.id, lessonTitle: lesson.title })),
)

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// index คงที่ต่อวัน: hash สตริงวันที่ → ข้อเดียวกันทั้งวัน เปลี่ยนทุกวัน
function pickIndexForDate(dateStr, length) {
  let hash = 0
  for (let i = 0; i < dateStr.length; i++) hash = ((hash << 5) - hash + dateStr.charCodeAt(i)) | 0
  return Math.abs(hash) % length
}

const STORAGE_PREFIX = 'firstaid.dailyQuiz:'

function readAnswered(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export default function DailyQuiz() {
  const dateStr = todayKey()
  const storageKey = STORAGE_PREFIX + dateStr

  const question = useMemo(() => {
    if (!pool.length) return null
    return pool[pickIndexForDate(dateStr, pool.length)]
  }, [dateStr])

  const [answered, setAnswered] = useState(() => readAnswered(storageKey))

  if (!question) return null

  const handleAnswer = (choiceId) => {
    if (answered) return
    const result = { choiceId, correct: choiceId === question.correctId }
    setAnswered(result)
    try {
      localStorage.setItem(storageKey, JSON.stringify(result))
    } catch {
      /* localStorage ใช้ไม่ได้ก็ยังตอบได้ แค่ไม่จำข้ามรีเฟรช */
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16, border: '1.5px solid #DDD6FE' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, background: '#7C3AED20', color: '#7C3AED',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Sparkles size={14} />
        </div>
        <div className="text-body-strong">ควิซประจำวัน</div>
        <div className="text-caption" style={{ marginLeft: 'auto' }}>จากบท: {question.lessonTitle}</div>
      </div>

      <div className="text-body" style={{ marginBottom: 10 }}>{question.question}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {question.choices.map((c) => {
          const isPicked = answered?.choiceId === c.id
          const isCorrect = c.id === question.correctId
          let style = { justifyContent: 'flex-start', textAlign: 'left' }
          if (answered) {
            if (isCorrect) style = { ...style, background: '#DCFCE7', border: '1.5px solid #86EFAC', color: '#166534' }
            else if (isPicked) style = { ...style, background: '#FEE2E2', border: '1.5px solid #FCA5A5', color: '#991B1B' }
            else style = { ...style, opacity: 0.5 }
          }
          return (
            <button
              key={c.id}
              type="button"
              className="btn btn-secondary btn-block"
              style={style}
              disabled={!!answered}
              onClick={() => handleAnswer(c.id)}
            >
              {answered && isCorrect && <Check size={14} />}
              {answered && isPicked && !isCorrect && <X size={14} />}
              {c.text}
            </button>
          )
        })}
      </div>

      {answered && (
        <div
          className="text-caption"
          style={{
            marginTop: 10, padding: 10, borderRadius: 10,
            background: answered.correct ? '#F0FDF4' : '#FEF2F2',
            color: answered.correct ? '#166534' : '#991B1B',
          }}
        >
          <div className="text-body-strong" style={{ marginBottom: 2 }}>
            {answered.correct ? '🎉 ถูกต้อง!' : 'ยังไม่ถูก — ดูเฉลยด้านล่าง'}
          </div>
          {question.explanation}
          <div style={{ marginTop: 6, opacity: 0.7 }}>ข้อใหม่ปลดล็อกพรุ่งนี้ — กลับมาต่อสตรีคนะ 🔥</div>
        </div>
      )}
    </div>
  )
}
