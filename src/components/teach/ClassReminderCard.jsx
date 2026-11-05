import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { adminFetch } from '../../utils/adminFetch'

// ส่ง LINE เตือนนักเรียนที่ยังไม่พร้อม (api/classes/remind.js) — กดแล้วดูตัวอย่าง/จำนวนก่อน แล้วค่อยยืนยันส่งจริง
// ระบบส่งเองอัตโนมัติด้วยก่อนวันเรียน 3 วัน และ 1 วัน (ถ้าคลาสมีวันเรียน)
async function callRemind(cohortId, dryRun) {
  const resp = await adminFetch('/api/classes/remind', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cohortId, dryRun }),
  })
  const body = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(body.error || `HTTP ${resp.status}`)
  return body
}

export default function ClassReminderCard({ cohortId, notReady }) {
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  if (!cohortId || notReady === 0) return null

  const run = async (dryRun) => {
    setBusy(true); setError(null)
    try {
      const r = await callRemind(cohortId, dryRun)
      if (dryRun) { setPreview(r); setResult(null) } else { setResult(r); setPreview(null) }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="text-body-strong">เตือนคนที่ยังเรียนไม่ครบทาง LINE</div>
          <div className="text-caption">ยังไม่พร้อม {notReady} คน · ระบบเตือนเองอัตโนมัติก่อนวันเรียน 3 วัน และ 1 วัน</div>
        </div>
        {!preview && (
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => run(true)}>
            <MessageCircle size={16} /> {busy ? 'กำลังเช็ค…' : 'ส่ง LINE เตือน'}
          </button>
        )}
      </div>

      {error && <div className="text-caption" style={{ marginTop: 8, color: '#B91C1C' }}>ไม่สำเร็จ: {error}</div>}

      {preview && (
        <div style={{ marginTop: 10 }}>
          <div className="text-body-strong">
            {preview.candidates > 0 ? `จะส่งถึง ${preview.candidates} คน` : 'ไม่มีใครที่ส่ง LINE ได้ตอนนี้'}
          </div>
          <ul className="text-caption" style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {preview.recentlySent > 0 && <li>{preview.recentlySent} คน เพิ่งได้รับเตือนไปไม่ถึง 12 ชม. — ข้ามไว้</li>}
            {preview.optedOut > 0 && <li>{preview.optedOut} คน พิมพ์ "หยุด" ไว้ — ไม่ส่ง</li>}
            {preview.noLine.length > 0 && (
              <li>
                {preview.noLine.length} คน ยังไม่เคยล็อกอิน LINE — ต้องโทรเอง:{' '}
                {preview.noLine.map((p) => `${p.name || '(ไม่ระบุชื่อ)'}${p.phone ? ` ${p.phone}` : ''}`).join(', ')}
              </li>
            )}
          </ul>
          {preview.sample && (
            <details style={{ marginTop: 8 }}>
              <summary className="text-caption" style={{ cursor: 'pointer' }}>ดูตัวอย่างข้อความ</summary>
              <pre className="text-caption" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', background: 'var(--color-surface-muted, #F5F5F4)', padding: 10, borderRadius: 8, marginTop: 6 }}>
                {preview.sample}
              </pre>
            </details>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {preview.candidates > 0 && (
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => run(false)}>
                {busy ? 'กำลังส่ง…' : `ยืนยันส่ง ${preview.candidates} คน`}
              </button>
            )}
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setPreview(null)}>ยกเลิก</button>
          </div>
        </div>
      )}

      {result && (
        <div className="text-caption" style={{ marginTop: 8, color: result.failed ? '#B91C1C' : '#347053' }}>
          ส่งแล้ว {result.sent} คน{result.failed ? ` · ส่งไม่สำเร็จ ${result.failed} คน (กดส่งใหม่ได้)` : ''}
        </div>
      )}
    </div>
  )
}
