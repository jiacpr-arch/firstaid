import { useEffect, useState } from 'react'
import { supabase } from '../config/supabaseClient'

// The JIA Hub's central online certificate (class.jiacpr.com, learning_hub.person_certificates):
// issued once the post-test this app sends to the Hub (api/_lib/hubResults.js) is accepted there.
// It is shown alongside this app's own theory certificate, which stays exactly as it was (owner
// decision). firstaid shares the Hub's Supabase project, so this is a plain RPC with the learner's
// own session; with no session, or nothing at the Hub yet, it renders nothing.
const HUB_URL = 'https://class.jiacpr.com'
const HUB_COURSE_ID = 'firstaid'

// null when there's nothing to show (no Supabase, no session, the Hub not ready): never throws.
async function fetchHubCertificate() {
  try {
    if (!supabase) return null
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return null
    const { data, error } = await supabase.rpc('jia_person_certificates', { action: 'mine', payload: {} })
    if (error || !data) return null
    return {
      cert: (data.certificates || []).find((c) => c.courseId === HUB_COURSE_ID && c.status === 'issued') || null,
      claimable: (data.claimable || []).some((c) => c.courseId === HUB_COURSE_ID),
    }
  } catch {
    return null
  }
}

export default function HubCertificateCard() {
  const [state, setState] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchHubCertificate().then((next) => { if (!cancelled) setState(next) })
    return () => { cancelled = true }
  }, [])

  async function claim() {
    setBusy(true)
    setError('')
    try {
      const { error: rpcError } = await supabase.rpc('jia_person_certificates', { action: 'claim', payload: { courseId: HUB_COURSE_ID } })
      if (rpcError) setError(rpcError.message || 'ขอรับใบประกาศไม่สำเร็จ')
      setState(await fetchHubCertificate())
    } catch {
      setError('ขอรับใบประกาศไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setBusy(false)
    }
  }

  if (!state || (!state.cert && !state.claimable)) return null

  if (state.cert) {
    const c = state.cert
    const expires = c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : ''
    return (
      <a className="card" data-testid="hub-certificate" href={HUB_URL + c.verifyPath} target="_blank" rel="noreferrer"
        style={{ display: 'block', marginTop: 12, textDecoration: 'none', color: 'inherit' }}>
        <div style={{ fontWeight: 700 }}>ใบประกาศออนไลน์กลาง JIA</div>
        <div className="text-caption" style={{ marginTop: 4 }}>
          เลขที่ <span style={{ fontFamily: 'monospace' }}>{c.number}</span>{expires ? ` · หมดอายุ ${expires}` : ''}
        </div>
        <div className="text-caption" style={{ marginTop: 4, fontWeight: 700 }}>ตรวจสอบ / เปิดใบที่ class.jiacpr.com ↗</div>
      </a>
    )
  }

  return (
    <div className="card" data-testid="hub-certificate-claim" style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 700 }}>รับใบประกาศออนไลน์กลางของ JIA</div>
      <div className="text-caption" style={{ marginTop: 4 }}>
        ผลสอบหลังเรียนผ่านและระบบกลางรับรองแล้ว — ใบนี้ตรวจสอบได้ด้วย QR ชื่อบนใบมาจากบัตรนักเรียน JIA ของคุณ
      </div>
      <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 10 }} disabled={busy} onClick={claim}>
        {busy ? 'กำลังขอรับ…' : 'ขอรับใบประกาศกลาง'}
      </button>
      {error && <div className="text-caption" style={{ marginTop: 6, color: 'var(--danger, #b3261e)' }}>{error}</div>}
    </div>
  )
}
