import { useState } from 'react'

// รายงานสรุปรอบอบรม: ดูตัวอย่างข้อความ แล้วส่งเข้า LINE ของแอดมิน (ตัวเลขรวม ไม่มีชื่อนักเรียน)
// fetcher(url, opts) = adminFetch (หน้าแอดมิน) หรือ classFetch ผูกรหัสผู้สอน (หน้า /teach)
export default function SessionReportCard({ sessionId, fetcher }) {
  const [report, setReport] = useState({ text: '', status: '', busy: false })

  const call = async (send) => {
    setReport((r) => ({ ...r, busy: true, status: '' }))
    try {
      const resp = await fetcher('/api/attendance/session-report', {
        method: 'POST', body: JSON.stringify({ sessionId, send }),
      })
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok) { setReport((r) => ({ ...r, busy: false, status: body.error || 'สร้างรายงานไม่สำเร็จ' })); return }
      setReport({
        text: body.text,
        busy: false,
        status: !send ? '' : body.sent ? 'ส่งเข้า LINE แล้ว' : (body.reason || 'ส่งเข้า LINE ไม่สำเร็จ'),
      })
    } catch {
      setReport((r) => ({ ...r, busy: false, status: 'เครือข่ายขัดข้อง ลองใหม่' }))
    }
  }

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="text-body-strong">รายงานสรุปรอบอบรม</div>
      <div className="text-caption" style={{ marginTop: 2 }}>
        ผ่านไปกี่คน เหลือกี่รายการ — ดูตัวอย่างก่อน แล้วส่งเข้า LINE ของแอดมิน (ตัวเลขรวม ไม่มีชื่อนักเรียน)
      </div>
      {report.text && (
        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, margin: '8px 0 0', padding: 10, borderRadius: 8, background: 'var(--color-surface-muted, #f3f4f6)' }}>
          {report.text}
        </pre>
      )}
      {report.status && (
        <div className={report.status === 'ส่งเข้า LINE แล้ว' ? 'callout callout-info' : 'callout callout-danger'} style={{ marginTop: 8 }}>
          {report.status}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" className="btn btn-secondary" style={{ flex: 1 }} disabled={report.busy} onClick={() => call(false)}>
          ดูตัวอย่าง
        </button>
        <button type="button" className="btn btn-primary" style={{ flex: 1 }} disabled={report.busy} onClick={() => call(true)}>
          ส่งเข้า LINE
        </button>
      </div>
    </div>
  )
}
