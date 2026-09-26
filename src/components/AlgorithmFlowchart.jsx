import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Phone, AlertTriangle, CheckCircle2, ArrowRightCircle } from 'lucide-react'
import { groupMediaByStep } from '../utils/lessonMediaSteps'
import { MediaRow } from './Media'

function StepIcon({ kind, tone }) {
  if (kind === 'call') return <Phone size={18} />
  if (tone === 'danger') return <AlertTriangle size={18} />
  if (kind === 'goto') return <ArrowRightCircle size={18} />
  return <CheckCircle2 size={18} />
}

function toneToColor(tone) {
  if (tone === 'danger') return { bg: '#FBEBE8', border: '#EFC9C3', fg: '#7E2C24' }
  if (tone === 'warning') return { bg: '#F7EFDD', border: '#D9C28E', fg: '#7A5A1F' }
  if (tone === 'info') return { bg: '#E4EDF0', border: '#A9C2CD', fg: '#2F5870' }
  return { bg: '#EDF4EF', border: '#9CC3AB', fg: '#266B44' }
}

export default function AlgorithmFlowchart({ algorithm, media = [] }) {
  const stepsById = useMemo(
    () => Object.fromEntries(algorithm.steps.map((s) => [s.id, s])),
    [algorithm],
  )
  const mediaByStep = useMemo(() => groupMediaByStep(media), [media])
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

            {mediaByStep.get(id)?.map((row) => <MediaRow key={row.id} row={row} />)}

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
        <Link
          to={`/algorithms/${currentStep.targetId}`}
          className="btn btn-primary btn-block"
        >
          ดู flowchart: {currentStep.targetId}
        </Link>
      )}
    </div>
  )
}
