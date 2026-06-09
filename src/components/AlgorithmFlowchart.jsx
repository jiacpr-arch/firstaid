import { useState, useMemo } from 'react'
import { ChevronRight, Phone, AlertTriangle, CheckCircle2, ArrowRightCircle } from 'lucide-react'

function StepIcon({ kind, tone }) {
  if (kind === 'call') return <Phone size={18} />
  if (tone === 'danger') return <AlertTriangle size={18} />
  if (kind === 'goto') return <ArrowRightCircle size={18} />
  return <CheckCircle2 size={18} />
}

function toneToColor(tone) {
  if (tone === 'danger') return { bg: '#FEF2F2', border: '#FCA5A5', fg: '#991B1B' }
  if (tone === 'warning') return { bg: '#FFFBEB', border: '#FCD34D', fg: '#92400E' }
  if (tone === 'info') return { bg: '#EFF6FF', border: '#93C5FD', fg: '#1E40AF' }
  return { bg: '#F0FDF4', border: '#86EFAC', fg: '#166534' }
}

export default function AlgorithmFlowchart({ algorithm }) {
  const stepsById = useMemo(
    () => Object.fromEntries(algorithm.steps.map((s) => [s.id, s])),
    [algorithm],
  )
  const [path, setPath] = useState([algorithm.steps[0].id])
  const currentStep = stepsById[path[path.length - 1]]

  const next = (id) => setPath((p) => [...p, id])
  const reset = () => setPath([algorithm.steps[0].id])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {path.map((id, idx) => {
        const step = stepsById[id]
        if (!step) return null
        const c = toneToColor(step.tone)
        const isLast = idx === path.length - 1
        return (
          <div
            key={`${id}-${idx}`}
            style={{
              padding: 14,
              borderRadius: 'var(--radius-lg)',
              border: `1.5px solid ${c.border}`,
              background: c.bg,
              color: c.fg,
              opacity: isLast ? 1 : 0.7,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <StepIcon kind={step.kind} tone={step.tone} />
              <div style={{ flex: 1 }}>
                <div className="text-body-strong">{step.text}</div>
                {step.detail && <div className="text-caption" style={{ marginTop: 4 }}>{step.detail}</div>}
              </div>
            </div>

            {isLast && step.kind === 'check' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => next(step.yesNextId)}
                >
                  ใช่ <ChevronRight size={16} />
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => next(step.noNextId)}
                >
                  ไม่ <ChevronRight size={16} />
                </button>
              </div>
            )}
            {isLast && (step.kind === 'action' || step.kind === 'call') && step.nextId && (
              <button
                type="button"
                className="btn btn-primary btn-block"
                style={{ marginTop: 12 }}
                onClick={() => next(step.nextId)}
              >
                ทำเสร็จแล้ว <ChevronRight size={16} />
              </button>
            )}
            {isLast && step.terminal && (
              <button
                type="button"
                className="btn btn-secondary btn-block"
                style={{ marginTop: 12 }}
                onClick={reset}
              >
                เริ่มใหม่
              </button>
            )}
          </div>
        )
      })}
      {currentStep?.kind === 'goto' && currentStep.terminal && (
        <a
          href={`/algorithms/${currentStep.targetId}`}
          className="btn btn-primary btn-block"
        >
          ดู flowchart: {currentStep.targetId}
        </a>
      )}
    </div>
  )
}
