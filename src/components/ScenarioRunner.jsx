import { useState, useMemo } from 'react'
import { CheckCircle2, XCircle, ChevronRight } from 'lucide-react'

export default function ScenarioRunner({ scenario, onFinish }) {
  const stepsById = useMemo(
    () => Object.fromEntries(scenario.steps.map((s) => [s.id, s])),
    [scenario],
  )
  const [currentId, setCurrentId] = useState(scenario.steps[0].id)
  const [history, setHistory] = useState([]) // { stepId, choiceId, correct }
  const [selectedChoice, setSelectedChoice] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [done, setDone] = useState(false)

  const step = stepsById[currentId]

  const submit = () => {
    if (!selectedChoice) return
    setRevealed(true)
    setHistory((h) => [...h, { stepId: currentId, choiceId: selectedChoice.id, correct: selectedChoice.correct }])
  }

  const advance = () => {
    if (selectedChoice.nextStepId === 'end' || !selectedChoice.nextStepId) {
      const finalHistory = history.length === 0
        ? [{ stepId: currentId, choiceId: selectedChoice.id, correct: selectedChoice.correct }]
        : history
      const score = finalHistory.filter(h => h.correct).length
      setDone(true)
      onFinish?.({ history: finalHistory, score, total: scenario.steps.length })
      return
    }
    setCurrentId(selectedChoice.nextStepId)
    setSelectedChoice(null)
    setRevealed(false)
  }

  if (done) return null

  return (
    <div className="card">
      <div className="text-caption" style={{ marginBottom: 6 }}>
        ข้อ {history.length + 1} / {scenario.steps.length}
      </div>
      <div className="text-headline" style={{ marginBottom: 14, whiteSpace: 'pre-wrap' }}>{step.prompt}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {step.choices.map((c) => {
          const isSelected = selectedChoice?.id === c.id
          const isCorrect = revealed && c.correct
          const isWrong = revealed && isSelected && !c.correct
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
              onClick={() => setSelectedChoice(c)}
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
          disabled={!selectedChoice}
          onClick={submit}
        >
          ส่งคำตอบ
        </button>
      )}
      {revealed && selectedChoice?.feedback && (
        <div
          className={selectedChoice.correct ? 'callout callout-info' : 'callout callout-danger'}
          style={{ marginTop: 14 }}
        >
          <div className="text-body-strong" style={{ marginBottom: 4 }}>
            {selectedChoice.correct ? 'ตอบถูก' : 'ลองดูคำอธิบาย'}
          </div>
          <div className="text-body">{selectedChoice.feedback}</div>
        </div>
      )}
      {revealed && (
        <button
          type="button"
          className="btn btn-primary btn-block"
          style={{ marginTop: 12 }}
          onClick={advance}
        >
          ต่อไป <ChevronRight size={16} />
        </button>
      )}
    </div>
  )
}
