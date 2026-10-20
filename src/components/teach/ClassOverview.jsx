import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download } from 'lucide-react'
import { lessons } from '../../courses/firstaid/lessons'
import { READINESS, classifyReadiness, summarizeReadiness } from '../../../api/_lib/readiness.js'

const examCell = (e) => (e ? `${e.score}% ${e.passed ? '✅' : '✗'}` : '—')
const badgeClass = (tone) => (tone === 'success' ? 'badge badge-success' : tone === 'warning' ? 'badge badge-warning' : 'badge')
const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

function exportCsv(learners, opts, filename) {
  const header = ['ชื่อ', 'เบอร์โทร', 'ความพร้อม', 'ยังขาด', `บทเรียน (จาก ${lessons.length})`, 'ควิซผ่าน', 'Pre-test', 'Post-test']
  const rows = learners.map((l) => {
    const r = classifyReadiness(l, opts)
    return [
      q(l.name), q(l.phone), q(READINESS[r.status].label), q(r.missing.join(' / ')),
      l.lessonsRead, l.quizzesPassed, q(l.preTest ? `${l.preTest.score}%` : ''), q(l.postTest ? `${l.postTest.score}%` : ''),
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

// แท็บ "ภาพรวม": นักเรียนทุกคน + ความพร้อม (พร้อม = Post-test ผ่าน) + สิ่งที่ยังขาด แตะชื่อเพื่อดูรายคน
export default function ClassOverview({ learners, classCode }) {
  const [filter, setFilter] = useState('all')
  const opts = useMemo(() => ({ totalLessons: lessons.length }), [])
  const summary = useMemo(() => summarizeReadiness(learners, opts), [learners, opts])
  const shown = useMemo(
    () => (filter === 'all' ? learners : learners.filter((l) => classifyReadiness(l, opts).status === filter)),
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
        <div className="text-caption" style={{ marginTop: 2 }}>พร้อม = สอบ Post-test ผ่าน (เงื่อนไขออกใบเซอร์ทฤษฎี ซึ่งต้องมีก่อนใบภาคปฏิบัติ)</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {[['all', 'ทั้งหมด', summary.total],
            ...['ready', 'almost', 'in_progress', 'not_started'].map((k) => [k, READINESS[k].label, summary[k]])]
            .map(([k, label, n]) => (
              <button key={k} type="button" className={filter === k ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ fontSize: 13, padding: '4px 10px' }} onClick={() => setFilter(k)}>
                {label} {n}
              </button>
            ))}
          <button type="button" className="btn btn-ghost" style={{ fontSize: 13, marginLeft: 'auto' }}
            onClick={() => exportCsv(learners, opts, `class-${classCode || 'export'}.csv`)}>
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
                  <div className="text-caption">{l.phone || '—'}</div>
                </div>
                <span className={badgeClass(m.tone)}>{m.label}</span>
              </div>
              <div className="text-caption" style={{ marginTop: 6 }}>
                บทเรียน {l.lessonsRead}/{lessons.length} · ควิซ {l.quizzesPassed} · Pre {examCell(l.preTest)} · Post {examCell(l.postTest)}
              </div>
              {r.missing.length > 0 && <div className="text-caption" style={{ marginTop: 2 }}>ขาด: {r.missing.join(' · ')}</div>}
            </Link>
          )
        })}
      </div>
    </>
  )
}
