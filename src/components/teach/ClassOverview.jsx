import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download } from 'lucide-react'
import { lessons } from '../../courses/firstaid/lessons'
import { READINESS, classifyReadiness, summarizeReadiness } from '../../../api/_lib/readiness.js'

const examCell = (e) => (e ? `${e.score}% ${e.passed ? '✅' : '✗'}` : '—')
const badgeClass = (tone) => (tone === 'success' ? 'badge badge-success' : tone === 'warning' ? 'badge badge-warning' : 'badge')
const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

// CPR & AED ออนไลน์ (cpr.morroo.com) ของคลาสรวม — api/_lib/cprProgress.js จับคู่ด้วยเบอร์โทร
// ไม่เจอข้อมูล = ยังไม่เริ่ม หรือกรอกเบอร์ไม่ตรงกับที่เข้าคลาส
const CPR_MODULES = 7
function cprStatus(cpr) {
  if (cpr?.completed) return { done: true, label: 'จบแล้ว ✅', short: 'จบแล้ว' }
  if (cpr?.modulesDone > 0) return { done: false, label: `เรียนแล้ว ${cpr.modulesDone}/${CPR_MODULES} บท`, short: `${cpr.modulesDone}/${CPR_MODULES} บท` }
  if (cpr?.redeemed) return { done: false, label: 'ใช้โค้ดแล้ว ยังไม่เริ่มเรียน', short: 'ใช้โค้ดแล้ว' }
  return { done: false, label: 'ยังไม่เริ่ม (หรือกรอกเบอร์ไม่ตรง)', short: 'ยังไม่เริ่ม' }
}

function exportCsv(learners, opts, filename, includesCpr) {
  const header = ['ชื่อ', 'ชื่อ LINE', 'เบอร์โทร', 'ความพร้อม', 'ยังขาด', `บทเรียน (จาก ${lessons.length})`, 'ควิซผ่าน', 'Pre-test', 'Post-test', ...(includesCpr ? ['CPR & AED ออนไลน์'] : [])]
  const rows = learners.map((l) => {
    const r = classifyReadiness(l, opts)
    return [
      q(l.name), q(l.lineName || ''), q(l.phone), q(READINESS[r.status].label), q(r.missing.join(' / ')),
      l.lessonsRead, l.quizzesPassed, q(l.preTest ? `${l.preTest.score}%` : ''), q(l.postTest ? `${l.postTest.score}%` : ''),
      ...(includesCpr ? [q(cprStatus(l.cpr).short)] : []),
    ].join(',')
  })
  const blob = new Blob(['﻿' + [header.map(q).join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// แท็บ "ภาพรวม": นักเรียนทุกคน + ความพร้อม (พร้อม = Post-test ผ่าน + คลาสรวม CPR: CPR จบ) + สิ่งที่ยังขาด แตะชื่อเพื่อดูรายคน
export default function ClassOverview({ learners, classCode, includesCpr = false }) {
  const [filter, setFilter] = useState('all')
  const opts = useMemo(() => ({ totalLessons: lessons.length, requireCpr: includesCpr }), [includesCpr])
  const summary = useMemo(() => summarizeReadiness(learners, opts), [learners, opts])
  const cprDone = useMemo(() => learners.filter((l) => cprStatus(l.cpr).done).length, [learners])
  const shown = useMemo(
    () => (filter === 'all' ? learners
      : filter === 'cpr_todo' ? learners.filter((l) => !cprStatus(l.cpr).done)
        : learners.filter((l) => classifyReadiness(l, opts).status === filter)),
    [learners, filter, opts],
  )

  if (learners.length === 0) {
    return (
      <div className="card" style={{ marginTop: 12 }}>
        <div className="text-body-strong">ยังไม่มีนักเรียนเข้าร่วม</div>
        <div className="text-caption">ให้นักเรียนสแกน QR หรือใส่รหัสคลาสในแท็บ “คลาส/QR” จากมือถือของตัวเอง</div>
      </div>
    )
  }

  return (
    <>
      <div className="card" style={{ marginTop: 12 }}>
        <div className="text-body-strong">พร้อมเข้าอบรมแล้ว {summary.ready}/{summary.total} คน</div>
        <div className="text-caption" style={{ marginTop: 2 }}>พร้อม = สอบ Post-test ผ่าน{includesCpr ? ' + เรียน CPR & AED ออนไลน์จบ' : ''} (เงื่อนไขออกใบเซอร์ทฤษฎี ซึ่งต้องมีก่อนใบภาคปฏิบัติ)</div>
        {includesCpr && (
          <div className="text-body-strong" style={{ marginTop: 8, color: '#B91C1C' }}>
            เรียน CPR & AED ออนไลน์จบแล้ว {cprDone}/{learners.length} คน
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {[['all', 'ทั้งหมด', summary.total],
            ...['ready', ...(includesCpr ? ['cpr_pending'] : []), 'almost', 'in_progress', 'not_started'].map((k) => [k, READINESS[k].label, summary[k]]),
            ...(includesCpr ? [['cpr_todo', 'ยังไม่จบ CPR', learners.length - cprDone]] : [])]
            .map(([k, label, n]) => (
              <button key={k} type="button" className={filter === k ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ fontSize: 13, padding: '4px 10px' }} onClick={() => setFilter(k)}>
                {label} {n}
              </button>
            ))}
          <button type="button" className="btn btn-ghost" style={{ fontSize: 13, marginLeft: 'auto' }}
            onClick={() => exportCsv(learners, opts, `class-${classCode || 'export'}.csv`, includesCpr)}>
            <Download size={14} /> CSV
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
        {shown.map((l) => {
          const r = classifyReadiness(l, opts)
          const m = READINESS[r.status]
          return (
            <Link key={l.learnerId} to={`/admin/teach/learners/${l.learnerId}`} className="card" style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div className="text-body-strong">{l.name || '(ไม่ระบุชื่อ)'}</div>
                  <div className="text-caption">{l.phone || '—'}{l.lineName ? ` · LINE: ${l.lineName}` : ''}</div>
                </div>
                <span className={badgeClass(m.tone)}>{m.label}</span>
              </div>
              <div className="text-caption" style={{ marginTop: 6 }}>
                บทเรียน {l.lessonsRead}/{lessons.length} · ควิซ {l.quizzesPassed} · Pre {examCell(l.preTest)} · Post {examCell(l.postTest)}
              </div>
              {includesCpr && (() => {
                const c = cprStatus(l.cpr)
                return <div className="text-caption" style={{ marginTop: 2, color: c.done ? '#347053' : '#B91C1C' }}>CPR & AED ออนไลน์: {c.label}</div>
              })()}
              {r.missing.length > 0 && <div className="text-caption" style={{ marginTop: 2 }}>ขาด: {r.missing.join(' · ')}</div>}
            </Link>
          )
        })}
      </div>
    </>
  )
}
