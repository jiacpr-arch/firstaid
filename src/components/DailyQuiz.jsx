import { useMemo, useState } from 'react'
import { Check, X } from 'lucide-react'
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
    <section className="card" style={{ marginBottom: 16, padding: 18, background: '#EFF3EA', border: '1px solid #E4E9DD' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span className="text-eyebrow">Daily quiz · 1 ข้อ</span>
        <span className="text-caption" style={{ marginLeft: 'auto', textAlign: 'right' }}>จากบท: {question.lessonTitle}</span>
      </div>

      <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.55, marginBottom: 12 }}>{question.question}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {question.choices.map((c) => {
          const isPicked = answered?.choiceId === c.id
          const isCorrect = c.id === question.correctId
          let style = { justifyContent: 'flex-start', textAlign: 'left', fontWeight: 400, minHeight: 48 }
          if (answered) {
            if (isCorrect) style = { ...style, background: '#E4F2E8', border: '1.5px solid #266B44', color: '#266B44', fontWeight: 700 }
            else if (isPicked) style = { ...style, background: '#FBEBE8', border: '1.5px solid #A0392F', color: '#A0392F', fontWeight: 700 }
            else style = { ...style, opacity: 0.55 }
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
              {answered && isCorrect && <Check size={16} strokeWidth={2.4} />}
              {answered && isPicked && !isCorrect && <X size={16} strokeWidth={2.4} />}
              {c.text}
            </button>
          )
        })}
      </div>

      {answered && (
        <div
          style={{
            marginTop: 12, padding: 14, borderRadius: 9, background: '#FFFFFF',
            fontSize: 14, lineHeight: 1.7,
          }}
        >
          <div className="text-body-strong" style={{ marginBottom: 2, color: answered.correct ? '#266B44' : '#A0392F' }}>
            {answered.correct ? 'ถูกต้อง' : 'ยังไม่ถูก — ดูเฉลยด้านล่าง'}
          </div>
          {question.explanation}
          <div className="text-caption" style={{ marginTop: 6 }}>ข้อใหม่ปลดล็อกพรุ่งนี้ — กลับมาเรียนต่อให้ครบทุกวัน</div>
        </div>
      )}
    </section>
  )
}
