import { useEffect, useState } from 'react'
import { Award, RefreshCw } from 'lucide-react'
import { fetchHubState, syncPracticalToHub } from '../utils/hubCertificate'
import HubCertificateCard from './HubCertificateCard'

// Practical certificate card on /certificate. Like the theory card, the learner is shown the JIA Hub's
// certificate (class.jiacpr.com), never this app's own: the Hub issues it once this app reports the
// practical pass (api/_lib/hubPractical.js), the post-test has passed there, and the student card has
// a name. A learner who passed before logging in gets it sent here once signed in.
export default function PracticalCertCard({ ownCert, reason }) {
  const [hub, setHub] = useState(undefined) // undefined = loading, null = unreachable
  const [pending, setPending] = useState('')
  const [busy, setBusy] = useState(false)

  const send = async () => {
    setBusy(true)
    try {
      const r = await syncPracticalToHub()
      setPending(r.certificate ? '' : r.pending || '')
      if (r.certificate) setHub(await fetchHubState())
    } catch (err) {
      setPending(err.message)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    fetchHubState().then(async (state) => {
      if (cancelled) return
      setHub(state)
      // Passed here but no Hub certificate yet: send the pass now (a no-op at the Hub if it has it).
      if (ownCert && state?.signedIn && !state.practicalCert) {
        try {
          const r = await syncPracticalToHub()
          if (cancelled) return
          setPending(r.certificate ? '' : r.pending || '')
          if (r.certificate) setHub(await fetchHubState())
        } catch (err) {
          if (!cancelled) setPending(err.message)
        }
      }
    })
    return () => { cancelled = true }
  }, [ownCert])

  const hubCert = hub?.practicalCert || null
  const passed = !!(ownCert || hubCert)

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Award size={22} strokeWidth={1.6} color="#546A50" />
        <div style={{ flex: 1 }}>
          <div className="text-body-strong">ใบประกาศภาคปฏิบัติ</div>
          <div className="text-caption">ออกให้หลังผ่านการอบรมภาคปฏิบัติกับครูผู้สอน</div>
        </div>
        {hubCert ? <span className="badge badge-success">ได้รับแล้ว</span>
          : passed ? <span className="badge badge-muted">กำลังออกใบ</span>
            : <span className="badge badge-muted">รอผลภาคปฏิบัติ</span>}
      </div>

      {hubCert && <HubCertificateCard cert={hubCert} />}

      {!hubCert && !passed && (
        <div className="text-caption" style={{ marginTop: 8 }}>{reason || 'มาเรียนภาคปฏิบัติและสอบผ่านกับครูผู้สอน'}</div>
      )}

      {!hubCert && passed && hub !== undefined && (
        <div style={{ marginTop: 10 }}>
          {!hub?.signedIn ? (
            <div className="callout">ผ่านภาคปฏิบัติแล้ว — เข้าสู่ระบบ (ปุ่มด้านบนของหน้านี้) เพื่อรับใบประกาศจากระบบกลาง JIA</div>
          ) : (
            <>
              <div className="callout">
                ผ่านภาคปฏิบัติแล้ว ระบบกลาง JIA กำลังออกใบให้
                {pending && <div className="text-caption" style={{ marginTop: 4 }}>ยังออกไม่ได้เพราะ: {pending}</div>}
              </div>
              <button type="button" className="btn btn-secondary btn-block" style={{ marginTop: 8 }} disabled={busy} onClick={send}>
                <RefreshCw size={16} /> {busy ? 'กำลังตรวจ…' : 'ตรวจอีกครั้ง'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
