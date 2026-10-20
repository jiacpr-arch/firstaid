import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { MessageCircle, KeyRound, CheckCircle2 } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useLearnerStore } from '../stores/learnerStore'
import { useEntitlementStore } from '../stores/entitlementStore'
import { useEnsureLearner } from '../hooks/useLearner'
import { startLineLogin, isLineLoginConfigured } from '../utils/lineAuth'
import { authHeader } from '../utils/authHeader'
import { track } from '../utils/analytics'
import { COURSE_BUNDLE_CHAPTER } from '../config/pricing'
import Seo from '../components/Seo'

// ปลดล็อกด้วยโค้ดจาก QR (/redeem/:code) — แอดมินส่ง QR ให้ลูกค้า สแกนแล้วมาหน้านี้
// โค้ดกรอกให้อัตโนมัติ ถ้ายังไม่ล็อกอิน LINE จะพาไปล็อกอินแล้วกลับมาหน้านี้
export default function RedeemVoucher() {
  useEnsureLearner()
  const { code: paramCode } = useParams()
  const session = useAuthStore((s) => s.session)
  const authLoading = useAuthStore((s) => s.loading)
  const learner = useLearnerStore((s) => s.learner)
  const refreshEntitlements = useEntitlementStore((s) => s.refresh)

  const [code, setCode] = useState((paramCode || '').toUpperCase())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [unlocked, setUnlocked] = useState(null) // chapter ที่ปลดล็อกได้

  const redeem = async (e) => {
    e.preventDefault()
    const trimmed = code.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setError('')
    try {
      const headers = await authHeader()
      const res = await fetch('/api/entitlements/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ code: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error === 'login_required' ? 'กรุณาเข้าสู่ระบบก่อน' : 'โค้ดไม่ถูกต้องหรือถูกใช้ไปแล้ว')
        return
      }
      track('voucher_redeemed', { code: trimmed, chapter: data.chapter, source: 'qr' })
      await refreshEntitlements(session)
      setUnlocked(data.chapter ?? true)
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setBusy(false)
    }
  }

  const seo = <Seo title="ปลดล็อกบทเรียน | Jia Training Center" path="/redeem" noindex />

  if (unlocked) {
    return (
      <div className="page-container">
        {seo}
        <div className="card" style={{ textAlign: 'center', padding: 28 }}>
          <CheckCircle2 size={44} color="#347053" style={{ margin: '0 auto' }} />
          <div className="text-title" style={{ marginTop: 12 }}>ปลดล็อกสำเร็จ!</div>
          <div className="text-body" style={{ marginTop: 8 }}>
            {unlocked === COURSE_BUNDLE_CHAPTER ? 'ปลดล็อกทั้งคอร์สแล้ว' : typeof unlocked === 'number' ? `ปลดล็อกหมวด ${unlocked} แล้ว` : 'พร้อมเรียนแล้ว'}
          </div>
          <Link to="/learn" className="btn btn-primary btn-block" style={{ marginTop: 16 }}>
            เริ่มเรียน
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      {seo}
      <div style={{ marginTop: 4 }}>
        <div className="text-caption">โค้ดปลดล็อก</div>
        <div className="text-title">ปลดล็อกบทเรียน</div>
      </div>

      {authLoading ? (
        <div className="text-caption" style={{ textAlign: 'center', padding: 16 }}>กำลังโหลด…</div>
      ) : !session ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="text-body-strong" style={{ fontFamily: 'monospace' }}>{code}</div>
          <div className="text-body-strong" style={{ marginTop: 8 }}>เข้าสู่ระบบด้วย LINE ก่อน</div>
          <div className="text-caption" style={{ marginTop: 4 }}>
            สิทธิ์ปลดล็อกผูกกับบัญชี LINE ของคุณ — ล็อกอินเครื่องไหนก็เรียนต่อได้
          </div>
          {isLineLoginConfigured ? (
            <button
              type="button"
              onClick={() => startLineLogin(learner?.id, `/redeem/${encodeURIComponent(code.trim())}`)}
              className="btn btn-block"
              style={{ marginTop: 12, padding: '14px', borderRadius: 12, background: '#06C755', color: '#fff', fontWeight: 800, border: 'none' }}
            >
              <MessageCircle size={18} /> เข้าสู่ระบบด้วย LINE
            </button>
          ) : (
            <div className="callout callout-info" style={{ marginTop: 10 }}>
              ระบบล็อกอินยังไม่พร้อมใช้งาน ติดต่อทีมงานเพื่อปลดล็อก
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={redeem} className="card" style={{ marginTop: 12 }}>
          <label className="label">โค้ดปลดล็อก</label>
          <input
            className="input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="FAV-XXXXXXXX"
            maxLength={20}
            style={{ fontFamily: 'monospace' }}
          />
          {error && <div className="callout callout-warning" style={{ marginTop: 10 }}>{error}</div>}
          <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 10 }} disabled={busy || !code.trim()}>
            <KeyRound size={16} /> {busy ? 'กำลังปลดล็อก…' : 'ปลดล็อก'}
          </button>
        </form>
      )}
    </div>
  )
}
