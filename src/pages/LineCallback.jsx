import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MessageCircle, AlertTriangle } from 'lucide-react'
import { supabase } from '../config/supabaseClient'
import { readLineAuthState, clearLineAuthState, startLineLogin } from '../utils/lineAuth'
import { linkLearnerToAuth } from '../utils/linkLearner'
import { useLearnerStore } from '../stores/learnerStore'

function fbqTrack(...args) {
  try { window.fbq?.(...args) } catch { /* tracking ห้ามพังแอป */ }
}

// Handles the LINE redirect back: verify state, redeem the code via /api/auth/line,
// establish the Supabase session with the returned magiclink token_hash, link the
// learner profile, then continue into the course.
export default function LineCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const learner = useLearnerStore((s) => s.learner)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const code = params.get('code')
      const returnedState = params.get('state')
      const lineError = params.get('error')
      const saved = readLineAuthState()

      if (lineError) { setError('การเข้าสู่ระบบถูกยกเลิก'); return }
      if (!code || !saved || returnedState !== saved.state) {
        setError('การยืนยันตัวตนไม่ถูกต้อง กรุณาลองใหม่')
        return
      }

      try {
        const resp = await fetch('/api/auth/line', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            redirectUri: saved.redirectUri,
            nonce: saved.nonce,
            learnerId: saved.learnerId || learner?.id,
          }),
        })
        const data = await resp.json().catch(() => ({}))
        if (!resp.ok || !data.tokenHash) {
          throw new Error(data.error || 'login_failed')
        }

        const { data: verified, error: verifyErr } = await supabase.auth.verifyOtp({
          type: 'magiclink',
          token_hash: data.tokenHash,
        })
        if (verifyErr || !verified?.session) throw new Error(verifyErr?.message || 'verify_failed')

        await linkLearnerToAuth({
          session: verified.session,
          lineUserId: data.lineUserId,
          displayName: data.displayName,
          pictureUrl: data.pictureUrl,
          lineEmail: data.lineEmail,
          canonicalLearnerId: data.learnerId,
        })

        fbqTrack('track', 'CompleteRegistration', { content_name: 'line_login', status: true })
        clearLineAuthState()
        if (!cancelled) navigate('/learn', { replace: true })
      } catch (err) {
        console.error('LINE callback failed', err)
        if (!cancelled) setError('เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
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
          <button
            type="button"
            onClick={() => startLineLogin(learner?.id)}
            className="btn btn-block"
            style={{ marginTop: 16, padding: '13px', borderRadius: 12, background: '#06C755', color: '#fff', fontWeight: 800, border: 'none' }}
          >
            <MessageCircle size={18} /> ลองเข้าสู่ระบบด้วย LINE อีกครั้ง
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container" style={{ display: 'flex', minHeight: '80vh', alignItems: 'center', justifyContent: 'center' }}>
      <div className="text-caption">กำลังเข้าสู่ระบบ…</div>
    </div>
  )
}
