import { useEffect, useState } from 'react'
import { Lock, MessageCircle, KeyRound, CheckCircle2 } from 'lucide-react'
import { chapters } from '../courses/firstaid/lessons'
import { CHAPTER_PRICES, COURSE_BUNDLE_PRICE } from '../config/pricing'
import { useAuthStore } from '../stores/authStore'
import { useLearnerStore } from '../stores/learnerStore'
import { useEntitlementStore } from '../stores/entitlementStore'
import { startLineLogin, isLineLoginConfigured } from '../utils/lineAuth'
import { lineInterestUrl } from '../utils/lineLinks'
import { authHeader } from '../utils/authHeader'
import { track } from '../utils/analytics'

// Paywall shown in place of locked lesson content — rendered by LessonReader's
// chapter-entitlement guard. Phase 1: no in-app checkout yet, so the buyer pays
// via PromptPay/LINE off-app and redeems the voucher code they're given here.
export default function ChapterUnlockCard({ chapter }) {
  const session = useAuthStore((s) => s.session)
  const learner = useLearnerStore((s) => s.learner)
  const refreshEntitlements = useEntitlementStore((s) => s.refresh)

  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const chapterInfo = chapters.find((c) => c.id === chapter)
  const price = CHAPTER_PRICES[chapter]

  useEffect(() => {
    track('price_view', { chapter, price, source: 'lesson_reader' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter])

  const buyMessage = `สนใจปลดล็อกหมวด "${chapterInfo?.title || chapter}" (฿${price}) — เรียนออนไลน์`
  const bundleMessage = `สนใจปลดล็อกทั้งคอร์ส (฿${COURSE_BUNDLE_PRICE}) — เรียนออนไลน์`

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
        setBusy(false)
        return
      }
      track('voucher_redeemed', { code: trimmed, chapter: data.chapter })
      await refreshEntitlements(session)
      setDone(true)
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: 'center', padding: 28 }}>
          <CheckCircle2 size={44} color="#10B981" style={{ margin: '0 auto' }} />
          <div className="text-title" style={{ marginTop: 12 }}>ปลดล็อกสำเร็จ!</div>
          <div className="text-body" style={{ marginTop: 8 }}>รีเฟรชหน้านี้เพื่อเริ่มเรียนต่อ</div>
          <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 16 }}
            onClick={() => window.location.reload()}>
            เข้าเรียนต่อ
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="card" style={{ textAlign: 'center', padding: 28 }}>
        <Lock size={44} color="var(--color-text-secondary)" style={{ margin: '0 auto' }} />
        <div className="text-title" style={{ marginTop: 12 }}>หมวดนี้ต้องปลดล็อกก่อน</div>
        <div className="text-body" style={{ marginTop: 8 }}>
          {chapterInfo?.title || `หมวด ${chapter}`} — ฿{price}
        </div>
      </div>

      {!session ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="text-body-strong">เข้าสู่ระบบด้วย LINE ก่อน</div>
          <div className="text-caption" style={{ marginTop: 4 }}>
            สิทธิ์ปลดล็อกผูกกับบัญชี LINE ของคุณ — ล็อกอินเครื่องไหนก็เรียนต่อได้
          </div>
          {isLineLoginConfigured ? (
            <button
              type="button"
              onClick={() => startLineLogin(learner?.id)}
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
        <>
          <div className="card" style={{ marginTop: 12 }}>
            <div className="text-body-strong">ซื้อผ่าน LINE</div>
            <div className="text-caption" style={{ marginTop: 4 }}>
              แจ้งชำระเงิน (PromptPay) แล้วรับโค้ดปลดล็อกจากทีมงาน
            </div>
            <a
              href={lineInterestUrl(buyMessage)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track('cta_click', { source: 'chapter_unlock', chapter })}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                marginTop: 10, padding: '12px', borderRadius: 10,
                background: '#06C755', color: '#fff', fontWeight: 800, fontSize: 14, textDecoration: 'none',
              }}
            >
              <MessageCircle size={16} /> ซื้อหมวดนี้ ฿{price} ผ่าน LINE
            </a>
            <a
              href={lineInterestUrl(bundleMessage)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track('cta_click', { source: 'chapter_unlock_bundle', chapter })}
              style={{
                display: 'block', textAlign: 'center', marginTop: 8,
                fontSize: 12, color: 'var(--color-text-muted)',
              }}
            >
              หรือปลดล็อกทั้งคอร์สทีเดียว ฿{COURSE_BUNDLE_PRICE} (ถูกกว่าซื้อแยก)
            </a>
          </div>

          <form onSubmit={redeem} className="card" style={{ marginTop: 12 }}>
            <div className="text-body-strong">มีโค้ดแล้ว?</div>
            <label className="label" style={{ marginTop: 8 }}>กรอกโค้ดปลดล็อก</label>
            <input
              className="input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="FAV-XXXXXXXX"
              maxLength={20}
            />
            {error && <div className="callout callout-warning" style={{ marginTop: 10 }}>{error}</div>}
            <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 10 }} disabled={busy || !code.trim()}>
              <KeyRound size={16} /> {busy ? 'กำลังปลดล็อก…' : 'ปลดล็อก'}
            </button>
          </form>
        </>
      )}
    </div>
  )
}
