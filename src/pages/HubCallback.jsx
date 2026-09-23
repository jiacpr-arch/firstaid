import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { UserRound, AlertTriangle, Copy, Check } from 'lucide-react'
import { supabase } from '../config/supabaseClient'
import { readHubAuthState, clearHubAuthState, startHubLogin } from '../utils/hubAuth'
import { detectInAppBrowser } from '../utils/inAppBrowser'
import { linkLearnerToAuth } from '../utils/linkLearner'
import { useLearnerStore } from '../stores/learnerStore'
import { phCapture } from '../lib/posthog'
import Seo from '../components/Seo'

function fbqTrack(...args) {
  try { window.fbq?.(...args) } catch { /* tracking ห้ามพังแอป */ }
}

// แปลง error code จาก /api/auth/hub เป็นข้อความไทยที่บอกสาเหตุชัด ช่วยให้ผู้ใช้รู้ว่าควรทำอะไรต่อ
const ERROR_MESSAGES = {
  consume_failed: 'เข้าสู่ระบบด้วยบัญชี JIA ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
  no_email: 'บัญชี JIA นี้ยังไม่มีอีเมล กรุณาติดต่อเจ้าหน้าที่ JIA',
  ambiguous: 'บัญชีนี้ผูกกับผู้เรียนคนอื่นอยู่แล้ว กรุณาติดต่อเจ้าหน้าที่ JIA',
  session_mint_failed: 'สร้างเซสชันไม่สำเร็จ กรุณาลองใหม่ภายหลัง',
}
const messageForCode = (code) => ERROR_MESSAGES[code] || 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'

// Handles the redirect back from the Hub's /sso: verify state, redeem the code via
// /api/auth/hub, establish the Supabase session with the returned magiclink token_hash, link the
// learner profile (adopting the canonical learner_id if this Hub account already had one), then
// continue into the course. Mirrors LineCallback.jsx — this is the secondary (non-LINE) path.
export default function HubCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const learner = useLearnerStore((s) => s.learner)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const inAppSource = detectInAppBrowser()

  const copyLoginLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* คลิปบอร์ดไม่รองรับก็ไม่เป็นไร — ผู้ใช้กดเมนู ⋯ เปิดในเบราว์เซอร์เองได้ */
    }
  }

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const code = params.get('code')
      const returnedState = params.get('state')
      const saved = readHubAuthState()

      if (!code || !saved || returnedState !== saved.state) {
        setError('เซสชันหมดอายุหรือเบราว์เซอร์ไม่รองรับ ลองเข้าสู่ระบบใหม่ หรือเปิดหน้านี้ใน Chrome/Safari')
        return
      }

      try {
        const resp = await fetch('/api/auth/hub', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            redirectUri: saved.redirectUri,
            codeVerifier: saved.codeVerifier,
            learnerId: saved.learnerId || learner?.id,
          }),
        })
        const data = await resp.json().catch(() => ({}))
        if (!resp.ok || !data.tokenHash) {
          if (!cancelled) setError(messageForCode(data.code))
          return
        }

        const { data: verified, error: verifyErr } = await supabase.auth.verifyOtp({
          type: 'magiclink',
          token_hash: data.tokenHash,
        })
        if (verifyErr || !verified?.session) throw new Error(verifyErr?.message || 'verify_failed')

        await linkLearnerToAuth({
          session: verified.session,
          displayName: data.displayName,
          lineEmail: data.email,
          canonicalLearnerId: data.learnerId,
        })

        fbqTrack('track', 'CompleteRegistration', { content_name: 'hub_login', status: true })
        phCapture('student_registered', { method: 'hub' })
        clearHubAuthState()
        if (!cancelled) navigate('/learn', { replace: true })
      } catch (err) {
        console.error('Hub callback failed', err)
        if (!cancelled) setError('เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง (อาจเป็นปัญหาเครือข่ายชั่วคราว)')
      }
    }
    run()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (error) {
    return (
      <div className="page-container" style={{ display: 'flex', minHeight: '80vh', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card" style={{ maxWidth: 360, textAlign: 'center' }}>
          <AlertTriangle size={40} color="#DC2626" style={{ margin: '0 auto' }} />
          <div className="text-title" style={{ marginTop: 12 }}>เข้าสู่ระบบไม่สำเร็จ</div>
          <div className="text-body text-text-muted" style={{ marginTop: 6 }}>{error}</div>
          {inAppSource && (
            <div
              style={{
                marginTop: 12, padding: '10px 12px', borderRadius: 10, textAlign: 'left',
                background: '#FEF3C7', border: '1px solid #FDE68A', color: '#92400E', fontSize: 13, lineHeight: 1.45,
              }}
            >
              คุณกำลังเปิดผ่านแอป {inAppSource === 'facebook' ? 'Facebook' : inAppSource === 'instagram' ? 'Instagram' : 'LINE'} —
              การเข้าสู่ระบบมักไม่สำเร็จในเบราว์เซอร์ในแอป กรุณากดเมนู ⋯ แล้วเลือก
              “เปิดในเบราว์เซอร์” (Chrome/Safari) หรือคัดลอกลิงก์ไปเปิดเอง แล้วเข้าสู่ระบบอีกครั้ง
              <button
                type="button"
                onClick={copyLoginLink}
                style={{
                  marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 10px', borderRadius: 8, border: '1px solid #D97706',
                  background: '#fff', color: '#92400E', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                }}
              >
                {copied ? <><Check size={14} /> คัดลอกลิงก์แล้ว</> : <><Copy size={14} /> คัดลอกลิงก์</>}
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => startHubLogin(learner?.id)}
            className="btn btn-block"
            style={{ marginTop: 16, padding: '13px', borderRadius: 12, background: '#111827', color: '#fff', fontWeight: 800, border: 'none' }}
          >
            <UserRound size={18} /> ลองเข้าสู่ระบบด้วยบัญชี JIA อีกครั้ง
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container" style={{ display: 'flex', minHeight: '80vh', alignItems: 'center', justifyContent: 'center' }}>
      <Seo title="กำลังเข้าสู่ระบบ | Jia Training Center" noindex path="/auth/hub/callback" />
      <div className="text-caption">กำลังเข้าสู่ระบบ…</div>
    </div>
  )
}
