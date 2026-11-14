import { useEffect, useState } from 'react'
import { Lock, MessageCircle, KeyRound, CheckCircle2, CreditCard, Loader2, ShieldCheck, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { chapters, lessons } from '../courses/firstaid/lessons'
import { CHAPTER_PRICES, COURSE_BUNDLE_PRICE, COURSE_BUNDLE_CHAPTER, CPR_CHAPTER, CPR_CHAPTER_TITLE } from '../config/pricing'
import { startCheckout } from '../utils/checkout'
import { useAuthStore } from '../stores/authStore'
import { useLearnerStore } from '../stores/learnerStore'
import { useEntitlementStore } from '../stores/entitlementStore'
import { isLineLoginConfigured } from '../utils/lineAuth'
import { startHubLogin } from '../utils/hubAuth'
import { lineInterestUrl } from '../utils/lineLinks'
import { authHeader } from '../utils/authHeader'
import { track } from '../utils/analytics'

// ราคารวมถ้าซื้อแยกทุกหมวด (โชว์ขีดฆ่าเทียบราคาทั้งคอร์ส) และจำนวนบทในหมวดเสียเงิน
const SEPARATE_TOTAL = Object.values(CHAPTER_PRICES).reduce((sum, p) => sum + p, 0)
const PAID_LESSON_COUNT = lessons.filter((l) => CHAPTER_PRICES[l.chapter]).length

// Paywall shown in place of locked lesson content — rendered by LessonReader's
// chapter-entitlement guard. Primary path: Stripe Checkout (card / PromptPay) → unlocks
// instantly (api/checkout/*, return page /buy). Fallback: pay via LINE and redeem a voucher code.
export default function ChapterUnlockCard({ chapter }) {
  const session = useAuthStore((s) => s.session)
  const learner = useLearnerStore((s) => s.learner)
  const refreshEntitlements = useEntitlementStore((s) => s.refresh)

  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [paying, setPaying] = useState(null) // chapter ที่กำลังเปิดหน้าจ่าย Stripe
  const [lineOnly, setLineOnly] = useState(false) // เซิร์ฟเวอร์ยังไม่ได้ตั้ง Stripe → ใช้ LINE
  const [payError, setPayError] = useState('')

  // ยังไม่ล็อกอิน (หรือ token หมดอายุ) → ไปล็อกอินก่อน แล้วกลับมาที่ /buy?chapter=N ซึ่งเปิดหน้าจ่ายต่อให้เอง
  const loginThenPay = (target) => {
    track('checkout_login', { chapter: target, source: 'chapter_unlock' })
    startHubLogin(learner?.id, `/buy?chapter=${target}`, { line: isLineLoginConfigured })
  }

  const pay = async (target) => {
    if (paying != null) return
    setPayError('')
    if (!session) { loginThenPay(target); return }
    setPaying(target)
    const r = await startCheckout(target, 'chapter_unlock')
    if (r.ok) return
    setPaying(null)
    if (r.error === 'stripe_not_configured') setLineOnly(true)
    else if (r.error === 'login_required') loginThenPay(target)
    else setPayError('เปิดหน้าชำระเงินไม่สำเร็จ กรุณาลองใหม่ หรือซื้อผ่าน LINE')
  }

  const chapterInfo = chapter === CPR_CHAPTER ? { id: CPR_CHAPTER, title: CPR_CHAPTER_TITLE } : chapters.find((c) => c.id === chapter)
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
          <CheckCircle2 size={44} color="#347053" style={{ margin: '0 auto' }} />
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

  const isCpr = chapter === CPR_CHAPTER
  const chapterLessons = isCpr ? 0 : lessons.filter((l) => l.chapter === chapter).length

  return (
    <div className="page-container">
      <div className="card" style={{ textAlign: 'center', padding: '22px 20px' }}>
        <Lock size={36} color="var(--color-text-secondary)" style={{ margin: '0 auto' }} />
        <div className="text-title" style={{ marginTop: 10 }}>หมวดนี้ต้องปลดล็อกก่อน</div>
        <div className="text-body" style={{ marginTop: 6 }}>
          หมวด {chapter}: {chapterInfo?.title}{chapterLessons ? ` · ${chapterLessons} บทเรียน` : ''}
        </div>
      </div>

      {!lineOnly && (
        <>
          {/* ทั้งคอร์ส — ข้อเสนอหลัก เห็นได้ทั้งก่อนและหลังล็อกอิน */}
          <div className="card" style={{ marginTop: 12, border: '2px solid var(--color-brand)' }}>
            <span className="badge badge-brand"><Sparkles size={13} /> คุ้มที่สุด</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
              <span className="text-title">ปลดล็อกทั้งคอร์ส</span>
              <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-brand)' }}>฿{COURSE_BUNDLE_PRICE}</span>
              <span className="text-caption" style={{ textDecoration: 'line-through' }}>฿{SEPARATE_TOTAL}</span>
            </div>
            <ul className="text-body" style={{ margin: '8px 0 12px', paddingLeft: 20, lineHeight: 1.7 }}>
              <li>บทเรียนครบทุกหมวด {PAID_LESSON_COUNT} บท + CPR &amp; AED ออนไลน์</li>
              <li>เรียนครบแล้วสอบ Post-test <strong>รับใบประกาศ</strong></li>
              <li>จ่ายครั้งเดียว เรียนได้ไม่จำกัดเวลา</li>
            </ul>
            <button type="button" className="btn btn-primary btn-block" style={{ fontWeight: 800 }}
              disabled={paying != null} onClick={() => pay(COURSE_BUNDLE_CHAPTER)}>
              {paying === COURSE_BUNDLE_CHAPTER ? <Loader2 size={16} className="spin" /> : <CreditCard size={16} />}
              ซื้อทั้งคอร์ส ฿{COURSE_BUNDLE_PRICE}
            </button>
            <button type="button" className="btn btn-secondary btn-block" style={{ marginTop: 8 }}
              disabled={paying != null} onClick={() => pay(chapter)}>
              {paying === chapter && <Loader2 size={16} className="spin" />}
              ซื้อเฉพาะหมวดนี้ ฿{price}
            </button>
            {payError && <div className="callout callout-warning" style={{ marginTop: 10 }}>{payError}</div>}
            <div className="text-caption" style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={14} style={{ flexShrink: 0 }} />
              <span>
                บัตรเครดิต/เดบิต หรือ PromptPay ผ่าน Stripe — ปลดล็อกทันที
                {!session && ' · กดซื้อแล้วเข้าสู่ระบบด้วย LINE ครั้งเดียวเพื่อผูกสิทธิ์กับบัญชี'}
              </span>
            </div>
            <Link to={`/buy?chapter=${chapter}`} className="text-caption" style={{ display: 'block', textAlign: 'center', marginTop: 8 }}>
              ดูราคาทุกหมวด
            </Link>
          </div>
        </>
      )}

      {!session ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="text-body-strong">ซื้อไว้แล้ว หรือมีโค้ดปลดล็อก?</div>
          <div className="text-caption" style={{ marginTop: 4 }}>
            เข้าสู่ระบบเพื่อเรียนต่อ — สิทธิ์ผูกกับบัญชีของคุณ ล็อกอินเครื่องไหนก็เรียนได้
          </div>
          {isLineLoginConfigured ? (
            <button
              type="button"
              onClick={() => startHubLogin(learner?.id, chapter === CPR_CHAPTER ? '/cpr' : '/learn', { line: true })}
              className="btn btn-block"
              style={{ marginTop: 12, padding: '12px', borderRadius: 12, background: '#06C755', color: '#fff', fontWeight: 800, border: 'none' }}
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
            <div className="text-body-strong">{lineOnly ? 'ซื้อผ่าน LINE' : 'หรือซื้อผ่าน LINE'}</div>
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
