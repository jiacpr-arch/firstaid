import { useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'

export default function QuizQuestion({ question, choices, correctId, explanation, onAnswered }) {
  const [selectedId, setSelectedId] = useState(null)
  const [revealed, setRevealed] = useState(false)

  const submit = () => {
    if (!selectedId) return
    setRevealed(true)
    onAnswered?.(selectedId, selectedId === correctId)
  }

  return (
    <div className="card">
      <div className="text-headline" style={{ marginBottom: 12 }}>{question}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {choices.map((c) => {
          const isSelected = selectedId === c.id
          const isCorrect = revealed && c.id === correctId
          const isWrong = revealed && isSelected && c.id !== correctId
          let bg = 'var(--color-bg-secondary)'
          let border = 'var(--color-border)'
          if (isCorrect) { bg = '#D1FAE5'; border = '#10B981' }
          else if (isWrong) { bg = '#FEE2E2'; border = '#EF4444' }
          else if (isSelected) { bg = 'var(--color-brand-soft)'; border = 'var(--color-brand)' }
          return (
            <button
              key={c.id}
              type="button"
              disabled={revealed}
              onClick={() => setSelectedId(c.id)}
              style={{
                textAlign: 'left',
                padding: '12px 14px',
                borderRadius: 'var(--radius)',
                border: `1.5px solid ${border}`,
                background: bg,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span style={{ flex: 1 }}>{c.text}</span>
              {isCorrect && <CheckCircle2 size={18} color="#10B981" />}
              {isWrong && <XCircle size={18} color="#EF4444" />}
            </button>
          )
        })}
      </div>
      {!revealed && (
        <button
          type="button"
          className="btn btn-primary btn-block"
          style={{ marginTop: 14 }}
          disabled={!selectedId}
          onClick={submit}
        >
          ส่งคำตอบ
        </button>
      )}
      {revealed && explanation && (
        <div className="callout callout-info" style={{ marginTop: 14 }}>
          <div className="text-body-strong" style={{ marginBottom: 4 }}>คำอธิบาย</div>
          <div className="text-body">{explanation}</div>
        </div>
      )}
    </div>
  )
}
