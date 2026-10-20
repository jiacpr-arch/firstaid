import { Link } from 'react-router-dom'
import { Download } from 'lucide-react'
import { lessons } from '../../courses/firstaid/lessons'
import { scenarios } from '../../courses/firstaid/scenarios'

const examCell = (e) => (e ? `${e.score}% ${e.passed ? '✅' : '✗'}` : '—')
const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

function exportCsv(learners, filename) {
  const header = ['ชื่อ', 'เบอร์โทร', `บทเรียน (จาก ${lessons.length})`, 'ควิซผ่าน', 'Pre-test', 'Post-test', `สถานการณ์ผ่าน (จาก ${scenarios.length})`, 'เกมดีที่สุด']
  const rows = learners.map((l) => [
    q(l.name), q(l.phone), l.lessonsRead, l.quizzesPassed,
    q(l.preTest ? `${l.preTest.score}%` : ''), q(l.postTest ? `${l.postTest.score}%` : ''),
    l.scenariosPassed, q(l.gameBest ? `${l.gameBest.score}${l.gameBest.grade ? ` (${l.gameBest.grade})` : ''}` : ''),
  ].join(','))
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

// แท็บ "ทฤษฎี": ความคืบหน้าเรียนออนไลน์รายคน (บทเรียน ควิซ Pre/Post สถานการณ์ เกม)
export default function ClassTheory({ learners, classCode }) {
  if (learners.length === 0) {
    return <div className="card" style={{ marginTop: 12 }}><div className="text-caption">ยังไม่มีนักเรียนเข้าร่วมคลาส</div></div>
  }
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 12 }}>
        <div className="text-body-strong" style={{ flex: 1 }}>ความคืบหน้าเรียนออนไลน์ ({learners.length} คน)</div>
        <button type="button" className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => exportCsv(learners, `theory-${classCode || 'export'}.csv`)}>
          <Download size={14} /> CSV
        </button>
      </div>
      <div className="card" style={{ padding: 0, overflowX: 'auto', marginTop: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 560 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>
              <th style={{ padding: '10px 12px' }}>ชื่อ</th>
              <th style={{ padding: '10px 8px' }}>บทเรียน</th>
              <th style={{ padding: '10px 8px' }}>ควิซ</th>
              <th style={{ padding: '10px 8px' }}>Pre</th>
              <th style={{ padding: '10px 8px' }}>Post</th>
              <th style={{ padding: '10px 8px' }}>จำลอง</th>
              <th style={{ padding: '10px 8px' }}>เกม</th>
            </tr>
          </thead>
          <tbody>
            {learners.map((l) => (
              <tr key={l.learnerId} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '10px 12px' }}>
                  <Link to={`/teach/learners/${l.learnerId}`} className="text-body-strong">{l.name || '(ไม่ระบุชื่อ)'}</Link>
                </td>
                <td style={{ padding: '10px 8px' }}>{l.lessonsRead}/{lessons.length}</td>
                <td style={{ padding: '10px 8px' }}>{l.quizzesPassed}</td>
                <td style={{ padding: '10px 8px' }}>{examCell(l.preTest)}</td>
                <td style={{ padding: '10px 8px' }}>{examCell(l.postTest)}</td>
                <td style={{ padding: '10px 8px' }}>{l.scenariosPassed}/{scenarios.length}</td>
                <td style={{ padding: '10px 8px' }}>{l.gameBest ? `${l.gameBest.score}${l.gameBest.grade ? ` (${l.gameBest.grade})` : ''}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
