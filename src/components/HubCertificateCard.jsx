import { useEffect, useState } from 'react'
import { supabase } from '../config/supabaseClient'

// The JIA Hub's central online certificate (class.jiacpr.com, learning_hub.person_certificates):
// issued once the post-test this app sends to the Hub (api/_lib/hubResults.js) is accepted there.
// firstaid shares the Hub's Supabase project, so this is a plain RPC with the learner's own
// session; with no session, or nothing at the Hub yet, it renders nothing.
//
// `requested`: this learner has just asked for their theory certificate here — every new one is
// issued by the Hub (owner decision 23 Oct 2026, TheoryCertCard) — so a claimable result is claimed
// right away, and a certificate that isn't there yet shows "being issued" with a retry and the Hub's
// own certificates page instead of nothing.
export const HUB_URL = 'https://class.jiacpr.com'
const HUB_COURSE_ID = 'firstaid'
// The Hub records the result and issues the certificate within a few seconds of the request.
const RETRY_DELAYS_MS = [0, 3000, 8000]

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

async function claimHubCertificate() {
  const { error } = await supabase.rpc('jia_person_certificates', { action: 'claim', payload: { courseId: HUB_COURSE_ID } })
  return error ? (error.message || 'ขอรับใบประกาศไม่สำเร็จ') : ''
}

export default function HubCertificateCard({ requested = false }) {
  const [state, setState] = useState(null)
  const [checked, setChecked] = useState(false)
  const [round, setRound] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    let timer
    const attempt = (i) => {
      timer = setTimeout(async () => {
        let next = await fetchHubCertificate()
        if (cancelled) return
        if (requested && next && !next.cert && next.claimable) {
          const claimError = await claimHubCertificate().catch(() => 'ขอรับใบประกาศไม่สำเร็จ ลองใหม่อีกครั้ง')
          if (cancelled) return
          if (claimError) setError(claimError)
          next = await fetchHubCertificate()
          if (cancelled) return
        }
        if (next?.cert || !requested || i === RETRY_DELAYS_MS.length - 1) {
          setState(next)
          setChecked(true)
        } else {
          attempt(i + 1)
        }
      }, RETRY_DELAYS_MS[i])
    }
    attempt(0)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [requested, round])

  async function claim() {
    setBusy(true)
    setError('')
    try {
      setError(await claimHubCertificate())
      setState(await fetchHubCertificate())
    } catch {
      setError('ขอรับใบประกาศไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setBusy(false)
    }
  }

  if (state?.cert) {
    const c = state.cert
    const expires = c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : ''
    return (
      <div className="card" data-testid="hub-certificate" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 700 }}>ใบประกาศออนไลน์กลาง JIA (แบบใหม่ มี QR Code)</div>
        <div className="text-caption" style={{ marginTop: 4 }}>
          เลขที่ <span style={{ fontFamily: 'monospace' }}>{c.number}</span>{expires ? ` · หมดอายุ ${expires}` : ''}
        </div>
        <div className="text-caption" style={{ marginTop: 4 }}>
          สแกน QR บนใบเพื่อตรวจสอบ — เจ้าของใบที่เข้าสู่ระบบจะเห็นคะแนนสอบของตัวเองด้วย
        </div>
        <a className="btn btn-primary btn-block" style={{ marginTop: 10, textDecoration: 'none' }}
          href={HUB_URL + '/portal/certificates'} target="_blank" rel="noreferrer">
          เปิด / พิมพ์ใบประกาศแบบใหม่ ↗
        </a>
        <div className="text-caption" style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', gap: 8, fontWeight: 700 }}>
          <a href={HUB_URL + c.verifyPath} target="_blank" rel="noreferrer">ตรวจสอบใบ ↗</a>
          <a href={HUB_URL + '/account'} target="_blank" rel="noreferrer">ใส่รูปบนใบประกาศ ↗</a>
        </div>
      </div>
    )
  }

  if (requested) {
    return (
      <div className="card" data-testid="hub-certificate-pending" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 700 }}>
          {checked ? 'ใบประกาศกำลังออกที่ระบบกลาง JIA' : 'กำลังออกใบประกาศที่ระบบกลาง JIA…'}
        </div>
        {checked && (
          <>
            <div className="text-caption" style={{ marginTop: 4 }}>
              เปิดหน้าใบประกาศของคุณที่ class.jiacpr.com — ถ้าระบบให้กรอกชื่อ–นามสกุลบนบัตรนักเรียน JIA
              ให้กรอกแล้วกด “ขอรับใบประกาศ” · ยังไม่ขึ้น ติดต่อ LINE OA @jiacpr
            </div>
            {error && <div className="text-caption" style={{ marginTop: 6, color: 'var(--danger, #b3261e)' }}>{error}</div>}
            <a className="btn btn-primary btn-block" style={{ marginTop: 10, textDecoration: 'none' }}
              href={HUB_URL + '/portal/certificates'} target="_blank" rel="noreferrer">
              เปิดใบประกาศของฉันที่ class.jiacpr.com ↗
            </a>
            <button type="button" className="btn btn-secondary btn-block" style={{ marginTop: 8 }}
              onClick={() => { setChecked(false); setError(''); setRound((r) => r + 1) }}>
              ตรวจอีกครั้ง
            </button>
          </>
        )}
      </div>
    )
  }

  if (!state?.claimable) return null
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
