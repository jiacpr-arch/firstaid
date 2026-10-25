import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import QuizQuestion from './QuizQuestion'

function shuffled(list) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// mini quiz หลังดูคลิป — ถามทีละข้อในการ์ดเดียว มีปุ่มเดียวต่อจังหวะ:
// ส่งคำตอบ → ข้อต่อไป → … → สรุปคะแนน + ปุ่มไปต่อ/ดูคลิปอีกครั้ง (เรียก onContinue)
// เรียก onComplete({ correct, total }) เมื่อตอบครบ
// ให้ parent ใส่ key ใหม่ทุกรอบที่ดูคลิปซ้ำ เพื่อสลับตัวเลือกและล้างคำตอบ
export default function VideoQuiz({ questions, passRatio, onComplete, onContinue, continueLabel }) {
  const [items] = useState(() => questions.map((q) => ({ ...q, choices: shuffled(q.choices) })))
  const [idx, setIdx] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [result, setResult] = useState(null)

  const q = items[idx]
  const isLast = idx === items.length - 1

  const onAnswered = (_id, ok) => {
    const total = correct + (ok ? 1 : 0)
    if (ok) setCorrect(total)
    if (isLast) {
      const r = { correct: total, total: items.length }
      setResult(r)
      onComplete(r)
    }
  }

  const passed = result && result.correct / result.total >= passRatio

  const footer = !isLast ? (
    <button
      type="button"
      className="btn btn-primary btn-block"
      style={{ marginTop: 14 }}
      onClick={() => setIdx((i) => i + 1)}
    >
      ข้อต่อไป <ChevronRight size={16} />
    </button>
  ) : result ? (
    <>
      <div className={`callout ${passed ? 'callout-info' : 'callout-danger'}`} style={{ marginTop: 14 }}>
        <div className="text-body-strong">ได้ {result.correct} / {result.total} ข้อ</div>
        <div className="text-body">
          {passed ? 'ผ่านแล้ว ไปเรียนต่อได้เลย' : 'ยังไม่ถึง 70% ลองดูคลิปอีกครั้งแล้วตอบใหม่นะ'}
        </div>
      </div>
      <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={onContinue}>
        {passed ? continueLabel : 'ดูคลิปอีกครั้ง'} <ChevronRight size={16} />
      </button>
    </>
  ) : null

  return (
    <div>
      <div className="text-caption" style={{ marginBottom: 8 }}>
        คำถามจากคลิป ข้อ {idx + 1} / {items.length}
      </div>
      <QuizQuestion key={idx} {...q} onAnswered={onAnswered} footer={footer} />
    </div>
  )
}
