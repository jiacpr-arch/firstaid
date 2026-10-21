import { useMemo, useState } from 'react'
import { AlertTriangle, Check, X } from 'lucide-react'
import {
  CHECKLIST_LIST, CHECKLISTS_REVIEWED, DEFAULT_PASS_RULE, FIRST_AID_CHECKLISTS,
} from '../../data/checklists/firstAidChecklists'
import { suggestedChecklistId } from '../../data/checkinStations'
import { tallyChecklist, suggestPass } from '../../../api/_lib/stationLogic.js'

// ใบประเมินฐานสอบ: ติ๊กรายข้อ ระบบแนะนำผ่าน/ไม่ผ่าน แต่ครูกดตัดสินเอง
export default function ChecklistGrader({ station, student, saving, onSave, onClose }) {
  const [checklistId, setChecklistId] = useState(
    suggestedChecklistId(station.name) || CHECKLIST_LIST[0].id,
  )
  const [checked, setChecked] = useState({})
  const [note, setNote] = useState('')

  const checklist = FIRST_AID_CHECKLISTS[checklistId]
  const tally = useMemo(() => tallyChecklist(checklist.items, checked), [checklist, checked])
  const suggested = suggestPass(tally, DEFAULT_PASS_RULE)

  const toggle = (no) => setChecked((c) => ({ ...c, [no]: !c[no] }))
  const changeChecklist = (id) => { setChecklistId(id); setChecked({}) }

  const save = (passed) => onSave({
    passed,
    score: tally.checkedCount,
    checklistId,
    checklistItems: Object.fromEntries(checklist.items.map((it) => [it.no, !!checked[it.no]])),
    note: note.trim(),
  })

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div className="text-caption">{station.name}</div>
          <div className="text-title">ประเมิน: {student.name}</div>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="ปิด"><X size={16} /></button>
      </div>

      {!CHECKLISTS_REVIEWED && (
        <div className="callout callout-warning" style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <AlertTriangle size={18} />
          <div>ใบประเมินนี้เป็น <b>ร่าง รอครูตรวจ</b> — ยังไม่ควรใช้ตัดสินผลสอบจริง</div>
        </div>
      )}

      <label className="label" style={{ marginTop: 10 }}>ใบประเมิน</label>
      <select className="input" value={checklistId} onChange={(e) => changeChecklist(e.target.value)}>
        {CHECKLIST_LIST.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
      </select>
      <div className="text-caption" style={{ marginTop: 6 }}>{checklist.scenario}</div>

      <div style={{ marginTop: 8 }}>
        {checklist.items.map((it) => (
          <label key={it.no} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 0', borderTop: '1px solid var(--color-border, #e5e7eb)' }}>
            <input type="checkbox" checked={!!checked[it.no]} onChange={() => toggle(it.no)} style={{ marginTop: 3, width: 20, height: 20 }} />
            <span className="text-body">
              {it.no}. {it.text}{it.critical && <b style={{ color: '#b45309' }}> ★</b>}
            </span>
          </label>
        ))}
      </div>

      <div className="text-caption" style={{ marginTop: 8 }}>
        ทำได้ {tally.checkedCount}/{tally.total} · ข้อวิกฤต(★) {tally.criticalDone ? 'ครบ' : 'ยังไม่ครบ'} ·
        {' '}ระบบแนะนำ: <b>{suggested ? 'ผ่าน' : 'ไม่ผ่าน'}</b> (ข้อวิกฤตครบ และ ≥ {DEFAULT_PASS_RULE.minPercent}%)
      </div>

      <input className="input" style={{ marginTop: 8 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="หมายเหตุ (ไม่บังคับ)" />

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {/* เซิร์ฟเวอร์ปฏิเสธ "ผ่าน" ที่ข้อ ★ ไม่ครบอยู่แล้ว (stationLogic.validateExamResult) — ปิดปุ่มให้เห็นก่อน */}
        <button type="button" className="btn btn-primary" style={{ flex: 1 }} disabled={saving || !tally.criticalDone} onClick={() => save(true)}>
          <Check size={16} /> ผ่าน
        </button>
        <button type="button" className="btn btn-danger" style={{ flex: 1 }} disabled={saving} onClick={() => save(false)}>
          <X size={16} /> ไม่ผ่าน
        </button>
      </div>
    </div>
  )
}
