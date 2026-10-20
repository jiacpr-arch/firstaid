import { useState } from 'react'
import QuizQuestion from './QuizQuestion'

function shuffled(list) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// mini quiz หลังดูคลิป — ถามทีละข้อ เรียก onComplete({ correct, total }) เมื่อตอบครบ
// ให้ parent ใส่ key ใหม่ทุกรอบที่ดูคลิปซ้ำ เพื่อสลับตัวเลือกและล้างคำตอบ
export default function VideoQuiz({ questions, onComplete }) {
  const [items] = useState(() => questions.map((q) => ({ ...q, choices: shuffled(q.choices) })))
  const [idx, setIdx] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [answered, setAnswered] = useState(false)

  const q = items[idx]
  const isLast = idx === items.length - 1

  const onAnswered = (_id, ok) => {
    const total = correct + (ok ? 1 : 0)
    if (ok) setCorrect(total)
    setAnswered(true)
    if (isLast) onComplete({ correct: total, total: items.length })
  }

  return (
    <div>
      <div className="text-caption" style={{ marginBottom: 8 }}>
        คำถามจากคลิป ข้อ {idx + 1} / {items.length}
      </div>
      <QuizQuestion key={idx} {...q} onAnswered={onAnswered} />
      {answered && !isLast && (
        <button
          type="button"
          className="btn btn-secondary btn-block"
          style={{ marginTop: 12 }}
          onClick={() => { setIdx((i) => i + 1); setAnswered(false) }}
        >
          ข้อต่อไป
        </button>
      )}
    </div>
  )
}
