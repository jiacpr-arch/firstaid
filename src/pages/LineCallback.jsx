import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MessageCircle, AlertTriangle, Copy, Check } from 'lucide-react'
import { supabase } from '../config/supabaseClient'
import { readLineAuthState, clearLineAuthState, startLineLogin } from '../utils/lineAuth'
import { detectInAppBrowser } from '../utils/inAppBrowser'
import { linkLearnerToAuth } from '../utils/linkLearner'
import { useLearnerStore } from '../stores/learnerStore'
import { phCapture } from '../lib/posthog'
import Seo from '../components/Seo'

function fbqTrack(...args) {
  try { window.fbq?.(...args) } catch { /* tracking ห้ามพังแอป */ }
}

// แปลง error code จาก /api/auth/line เป็นข้อความไทยที่บอกสาเหตุชัด ช่วยให้ผู้ใช้รู้ว่าควรทำอะไรต่อ
const ERROR_MESSAGES = {
  token_exchange_failed: 'เชื่อมต่อกับ LINE ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
  verify_failed: 'ยืนยันตัวตนกับ LINE ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
  nonce_mismatch: 'เซสชันไม่ตรงกัน กรุณาเริ่มเข้าสู่ระบบใหม่',
  account_create_failed: 'สร้างบัญชีไม่สำเร็จ กรุณาลองใหม่ภายหลัง',
  session_mint_failed: 'สร้างเซสชันไม่สำเร็จ กรุณาลองใหม่ภายหลัง',
  not_configured: 'ระบบเข้าสู่ระบบด้วย LINE ยังไม่พร้อมใช้งาน',
}
const messageForCode = (code) => ERROR_MESSAGES[code] || 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'

// Handles the LINE redirect back: verify state, redeem the code via /api/auth/line,
// establish the Supabase session with the returned magiclink token_hash, link the
// learner profile, then continue into the course.
export default function LineCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const learner = useLearnerStore((s) => s.learner)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  // ถ้าล็อกอินพังเพราะอยู่ใน in-app browser (FB/IG/LINE) การกดลองใหม่ในหน้าเดิมมักพังซ้ำ
  // เพราะ context ใหม่ทำ state หายอีก — เปิดในเบราว์เซอร์จริงเท่านั้นถึงจะจบ flow ได้
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
      const lineError = params.get('error')
      const saved = readLineAuthState()

      if (lineError) { setError('คุณยกเลิกการเข้าสู่ระบบด้วย LINE — กดปุ่มด้านล่างเพื่อลองใหม่ได้'); return }
      if (!code || !saved || returnedState !== saved.state) {
        // state/nonce หาย — มักเกิดจากเซสชันหมดอายุ หรือเปิดผ่าน in-app browser ของ FB/IG
        // ที่สร้าง browsing context ใหม่ตอน redirect กลับ แนะให้ลองใหม่หรือเปิดในเบราว์เซอร์จริง
        setError('เซสชันหมดอายุหรือเบราว์เซอร์ไม่รองรับ ลองเข้าสู่ระบบใหม่ หรือเปิดหน้านี้ใน Chrome/Safari')
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
          lineUserId: data.lineUserId,
          displayName: data.displayName,
          pictureUrl: data.pictureUrl,
          lineEmail: data.lineEmail,
          canonicalLearnerId: data.learnerId,
        })

        fbqTrack('track', 'CompleteRegistration', { content_name: 'line_login', status: true })
        phCapture('student_registered', { method: 'line' })
        clearLineAuthState()
        if (!cancelled) navigate('/learn', { replace: true })
      } catch (err) {
        console.error('LINE callback failed', err)
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
          <AlertTriangle size={40} color="#A0392F" style={{ margin: '0 auto' }} />
          <div className="text-title" style={{ marginTop: 12 }}>เข้าสู่ระบบไม่สำเร็จ</div>
          <div className="text-body text-text-muted" style={{ marginTop: 6 }}>{error}</div>
          {inAppSource && (
            <div
              style={{
                marginTop: 12, padding: '10px 12px', borderRadius: 10, textAlign: 'left',
                background: '#F7EFDF', border: '1px solid #E9D9B7', color: '#7A5A1F', fontSize: 13, lineHeight: 1.45,
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
                  padding: '6px 10px', borderRadius: 8, border: '1px solid #946A25',
                  background: '#fff', color: '#7A5A1F', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                }}
              >
                {copied ? <><Check size={14} /> คัดลอกลิงก์แล้ว</> : <><Copy size={14} /> คัดลอกลิงก์</>}
              </button>
            </div>
          )}
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
      <Seo title="กำลังเข้าสู่ระบบ | Jia Training Center" noindex path="/auth/line/callback" />
      <div className="text-caption">กำลังเข้าสู่ระบบ…</div>
    </div>
  )
}
