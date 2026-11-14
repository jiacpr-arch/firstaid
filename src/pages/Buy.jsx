import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, CreditCard, KeyRound, Loader2, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react'
import { chapters } from '../courses/firstaid/lessons'
import { CHAPTER_PRICES, COURSE_BUNDLE_CHAPTER, COURSE_BUNDLE_PRICE, CPR_CHAPTER, CPR_CHAPTER_TITLE, FREE_CHAPTER } from '../config/pricing'
import { useAuthStore } from '../stores/authStore'
import { useLearnerStore } from '../stores/learnerStore'
import { useEntitlementStore } from '../stores/entitlementStore'
import { useEnsureLearner } from '../hooks/useLearner'
import { useEnsureEntitlements } from '../hooks/useEntitlements'
import { isLineLoginConfigured } from '../utils/lineAuth'
import { startHubLogin } from '../utils/hubAuth'
import { lineInterestUrl } from '../utils/lineLinks'
import { confirmCheckout, startCheckout } from '../utils/checkout'
import { openPurchaseReceipt } from '../utils/purchaseReceipt'
import { track } from '../utils/analytics'
import Seo from '../components/Seo'
import AccountCard from '../components/AccountCard'

// หน้าซื้อคอร์สออนไลน์ (/buy) — ราคาทั้งหมดในหน้าเดียว กดแล้วไปจ่าย Stripe (บัตร / PromptPay) ปลดล็อกทันที
// กลับจาก Stripe: /buy?session_id=cs_… → ยืนยันกับเซิร์ฟเวอร์แล้วโชว์ "ชำระเงินสำเร็จ"
// /buy?chapter=N → ไฮไลต์ + (หลังล็อกอินกลับมา) เปิดหน้าจ่ายของรายการนั้นให้อัตโนมัติ

const PAID_CHAPTERS = [
  ...chapters.filter((c) => CHAPTER_PRICES[c.id]).map((c) => ({ id: c.id, title: c.title })),
  { id: CPR_CHAPTER, title: CPR_CHAPTER_TITLE },
]
const SEPARATE_TOTAL = PAID_CHAPTERS.reduce((s, c) => s + CHAPTER_PRICES[c.id], 0)
const BUNDLE_SAVING = SEPARATE_TOTAL - COURSE_BUNDLE_PRICE

const itemLabel = (ch) => (ch === COURSE_BUNDLE_CHAPTER
  ? 'ทั้งคอร์ส'
  : `หมวด ${ch}${ch === CPR_CHAPTER ? ` ${CPR_CHAPTER_TITLE}` : ''}`)

export default function Buy() {
  useEnsureLearner()
  useEnsureEntitlements()
  const [params] = useSearchParams()
  const session = useAuthStore((s) => s.session)
  const authLoading = useAuthStore((s) => s.loading)
  const learner = useLearnerStore((s) => s.learner)
  const owned = useEntitlementStore((s) => s.chapters)
  const ownsCpr = useEntitlementStore((s) => s.cpr)
  const refreshEntitlements = useEntitlementStore((s) => s.refresh)

  const sessionId = params.get('session_id')
  const wanted = params.get('chapter') != null ? Number(params.get('chapter')) : null
  const cancelled = params.get('cancelled') != null

  const [busy, setBusy] = useState(null) // chapter ที่กำลังเปิดหน้าจ่าย
  const [error, setError] = useState('')
  const [lineOnly, setLineOnly] = useState(false) // เซิร์ฟเวอร์ยังไม่ได้ตั้ง Stripe
  const [result, setResult] = useState(null) // { status, chapter } หลังกลับจาก Stripe
  const autoStarted = useRef(false)

  const isOwned = (ch) => {
    if (ch === CPR_CHAPTER) return ownsCpr
    if (ch === COURSE_BUNDLE_CHAPTER) return ownsCpr && owned.has(0)
    return owned.has(0) || owned.has(ch)
  }

  useEffect(() => { track('price_view', { source: 'buy_page', chapter: wanted }) }, [wanted])

  const buy = async (chapter) => {
    if (busy != null) return
    setError('')
    if (!session) {
      track('checkout_login', { chapter })
      startHubLogin(learner?.id, `/buy?chapter=${chapter}`, { line: isLineLoginConfigured })
      return
    }
    setBusy(chapter)
    const r = await startCheckout(chapter, 'buy_page')
    if (r.ok) return // กำลัง redirect ไป Stripe
    setBusy(null)
    if (r.error === 'stripe_not_configured') setLineOnly(true)
    else if (r.error === 'login_required') setError('กรุณาเข้าสู่ระบบอีกครั้ง แล้วกดซื้อใหม่')
    else if (r.error === 'account_not_linked') setError('บัญชีที่เข้าสู่ระบบอยู่ยังใช้ซื้อไม่ได้ — ออกจากระบบ แล้วเข้าใหม่ด้วย LINE จากนั้นกดซื้ออีกครั้ง')
    else setError(`เปิดหน้าชำระเงินไม่สำเร็จ กรุณาลองใหม่ หรือสั่งซื้อทาง LINE (รหัส ${r.code})`)
  }

  // ล็อกอินเสร็จกลับมาที่ /buy?chapter=N → ไปหน้าจ่ายต่อเลย ไม่ต้องกดซ้ำ
  useEffect(() => {
    if (autoStarted.current || authLoading || !session || wanted == null || sessionId) return
    if (wanted !== COURSE_BUNDLE_CHAPTER && !CHAPTER_PRICES[wanted]) return
    const t = setTimeout(() => {
      if (autoStarted.current) return
      autoStarted.current = true
      buy(wanted)
    }, 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session, wanted, sessionId])

  // กลับจาก Stripe → ยืนยัน (PromptPay อาจยัง pending สักครู่ ลองซ้ำ)
  useEffect(() => {
    if (!sessionId || authLoading || !session) return
    let stop = false
    const run = async () => {
      for (let i = 0; i < 6 && !stop; i += 1) {
        try {
          const r = await confirmCheckout(sessionId)
          if (stop) return
          setResult(r)
          if (r.status === 'paid') {
            await refreshEntitlements(session)
            if (!stop && r.receipt) openPurchaseReceipt(window, document, r.receipt)
            return
          }
        } catch {
          if (stop) return
          setResult({ status: 'error' })
        }
        await new Promise((res) => setTimeout(res, 2500))
      }
    }
    run()
    return () => { stop = true }
  }, [sessionId, authLoading, session, refreshEntitlements])

  const seo = <Seo title="ซื้อคอร์สปฐมพยาบาลออนไลน์ | Jia Training Center" path="/buy" />

  if (sessionId) {
    const paid = result?.status === 'paid'
    return (
      <div className="page-container">
        {seo}
        <div className="card" style={{ textAlign: 'center', padding: 28, marginTop: 8 }}>
          {paid ? (
            <>
              <CheckCircle2 size={48} color="#347053" style={{ margin: '0 auto' }} />
              <div className="text-title" style={{ marginTop: 12 }}>ชำระเงินสำเร็จ ปลดล็อกแล้ว!</div>
              <div className="text-body" style={{ marginTop: 8 }}>
                {itemLabel(result.chapter)} — เรียนได้ทันที ล็อกอินเครื่องไหนก็เรียนต่อได้
              </div>
              <Link to={result.chapter === CPR_CHAPTER ? '/cpr' : '/learn'} className="btn btn-primary btn-block" style={{ marginTop: 16 }}>
                เริ่มเรียนเลย
              </Link>
            </>
          ) : !session && !authLoading ? (
            <>
              <div className="text-title">เข้าสู่ระบบเพื่อตรวจสอบการชำระเงิน</div>
              <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 16 }}
                onClick={() => startHubLogin(learner?.id, `/buy?session_id=${encodeURIComponent(sessionId)}`, { line: isLineLoginConfigured })}>
                เข้าสู่ระบบ
              </button>
            </>
          ) : result?.status === 'error' ? (
            <>
              <div className="text-title">ตรวจสอบการชำระเงินไม่สำเร็จ</div>
              <div className="text-body" style={{ marginTop: 8 }}>ถ้าตัดเงินแล้ว ระบบจะปลดล็อกให้อัตโนมัติภายในไม่กี่นาที หรือทักทีมงานทาง LINE</div>
              <a href={lineInterestUrl(`ชำระเงินออนไลน์แล้วแต่ยังไม่ปลดล็อก (${sessionId.slice(-8)})`)} target="_blank" rel="noopener noreferrer"
                className="btn btn-secondary btn-block" style={{ marginTop: 16 }}>
                <MessageCircle size={16} /> ติดต่อทีมงาน
              </a>
            </>
          ) : (
            <>
              <Loader2 size={40} className="spin" style={{ margin: '0 auto', color: 'var(--color-brand)' }} />
              <div className="text-title" style={{ marginTop: 12 }}>กำลังยืนยันการชำระเงิน…</div>
              <div className="text-caption" style={{ marginTop: 8 }}>
                {result?.status === 'pending' ? 'ถ้าจ่ายด้วย PromptPay อาจใช้เวลาสักครู่ ไม่ต้องปิดหน้านี้' : 'รอสักครู่'}
              </div>
              <Link to="/learn" className="text-caption" style={{ display: 'block', marginTop: 16 }}>ไปหน้าบทเรียน</Link>
            </>
          )}
        </div>
      </div>
    )
  }

  const buyButton = (chapter, { primary = false, label } = {}) => {
    if (isOwned(chapter)) {
      return <span className="badge badge-success"><CheckCircle2 size={13} /> ปลดล็อกแล้ว</span>
    }
    const price = chapter === COURSE_BUNDLE_CHAPTER ? COURSE_BUNDLE_PRICE : CHAPTER_PRICES[chapter]
    if (lineOnly) {
      return (
        <a href={lineInterestUrl(`สนใจซื้อ${itemLabel(chapter)} (฿${price}) — เรียนออนไลน์`)} target="_blank" rel="noopener noreferrer"
          onClick={() => track('cta_click', { source: 'buy_page_line', chapter })}
          className={`btn ${primary ? 'btn-block' : ''}`}
          style={{ background: '#06C755', color: '#fff', border: 'none', fontWeight: 800, whiteSpace: 'nowrap' }}>
          <MessageCircle size={16} /> {label || `ซื้อ ฿${price}`} ทาง LINE
        </a>
      )
    }
    return (
      <button type="button" onClick={() => buy(chapter)} disabled={busy != null}
        className={`btn ${primary ? 'btn-primary btn-block' : 'btn-secondary'}`}
        style={{ whiteSpace: 'nowrap', fontWeight: 800 }}>
        {busy === chapter ? <Loader2 size={16} className="spin" /> : primary ? <CreditCard size={16} /> : null}
        {busy === chapter ? 'กำลังเปิดหน้าชำระเงิน…' : (label || `ซื้อ ฿${price}`)}
      </button>
    )
  }

  return (
    <div className="page-container">
      {seo}
      <header style={{ marginTop: 8, marginBottom: 16 }}>
        <span className="text-eyebrow">เรียนออนไลน์</span>
        <h1 className="text-display" style={{ margin: '2px 0 0' }}>ซื้อคอร์สปฐมพยาบาล</h1>
        <div className="text-body" style={{ color: 'var(--color-text-muted)' }}>
          จ่ายด้วยบัตรหรือ PromptPay — ปลดล็อกทันที เรียนได้ไม่จำกัดเวลา
        </div>
      </header>

      {cancelled && <div className="callout callout-info" style={{ marginBottom: 12 }}>ยกเลิกการชำระเงินแล้ว — เลือกซื้อใหม่ได้ทุกเมื่อ</div>}
      {lineOnly && <div className="callout callout-info" style={{ marginBottom: 12 }}>ตอนนี้รับชำระผ่าน LINE — แจ้งโอน PromptPay แล้วรับโค้ดปลดล็อกจากทีมงาน</div>}
      {error && <div className="callout callout-warning" style={{ marginBottom: 12 }}>{error}</div>}

      {/* บัญชีที่จะผูกสิทธิ์ — เห็นชัดว่าซื้อให้บัญชีไหน และมีปุ่มออกจากระบบ/สลับบัญชี */}
      <AccountCard style={{ marginBottom: 12 }} />

      {/* ทั้งคอร์ส — ตัวเลือกแนะนำ */}
      <section className="card" style={{
        padding: 20, border: `2px solid ${wanted === COURSE_BUNDLE_CHAPTER || wanted == null ? 'var(--color-brand)' : 'var(--color-border)'}`,
      }}>
        <span className="badge badge-brand"><Sparkles size={13} /> คุ้มที่สุด</span>
        <div className="text-title" style={{ marginTop: 8 }}>ปลดล็อกทั้งคอร์ส</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
          <span style={{ fontSize: 34, fontWeight: 800, color: 'var(--color-brand)' }}>฿{COURSE_BUNDLE_PRICE}</span>
          <span className="text-caption" style={{ textDecoration: 'line-through' }}>฿{SEPARATE_TOTAL}</span>
          <span className="badge badge-warning">ประหยัด ฿{BUNDLE_SAVING}</span>
        </div>
        <ul className="text-body" style={{ margin: '10px 0 14px', paddingLeft: 20, lineHeight: 1.8 }}>
          <li>บทเรียนครบทุกหมวด (หมวด 2–4) + CPR &amp; AED ออนไลน์</li>
          <li>สอบ Post-test รับใบประกาศ</li>
          <li>เรียนได้ไม่จำกัดเวลา ล็อกอินเครื่องไหนก็เรียนต่อได้</li>
        </ul>
        {buyButton(COURSE_BUNDLE_CHAPTER, { primary: true, label: `ซื้อทั้งคอร์ส ฿${COURSE_BUNDLE_PRICE}` })}
      </section>

      {/* รายหมวด */}
      <h2 className="text-body-strong" style={{ margin: '20px 0 8px' }}>หรือซื้อเฉพาะหมวด</h2>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="text-body-strong">หมวด {FREE_CHAPTER}: {chapters.find((c) => c.id === FREE_CHAPTER)?.title}</div>
          </div>
          <Link to="/learn" className="badge badge-success">ฟรี — เรียนเลย</Link>
        </div>
        {PAID_CHAPTERS.map((c, i) => (
          <div key={c.id} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
            borderBottom: i < PAID_CHAPTERS.length - 1 ? '1px solid var(--color-border)' : 'none',
            background: wanted === c.id ? 'var(--color-brand-soft)' : undefined,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="text-body-strong">หมวด {c.id}: {c.title}</div>
              <div className="text-caption">฿{CHAPTER_PRICES[c.id]}</div>
            </div>
            {buyButton(c.id)}
          </div>
        ))}
      </div>

      <div className="text-caption" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14 }}>
        <ShieldCheck size={15} /> ชำระเงินปลอดภัยผ่าน Stripe · รองรับบัตรเครดิต/เดบิต และ PromptPay
      </div>
      {!session && !authLoading && (
        <div className="text-caption" style={{ marginTop: 6 }}>
          กดซื้อแล้วจะให้เข้าสู่ระบบด้วย LINE ก่อน (ครั้งเดียว) เพื่อผูกสิทธิ์กับบัญชีของคุณ
        </div>
      )}

      <div className="card" style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Link to="/redeem" className="text-body-strong" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <KeyRound size={16} /> มีโค้ดปลดล็อกแล้ว? กรอกโค้ดที่นี่
        </Link>
        <a href={lineInterestUrl('สอบถามการซื้อคอร์สออนไลน์')} target="_blank" rel="noopener noreferrer"
          className="text-body-strong" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MessageCircle size={16} /> สอบถาม / ขอใบเสร็จ / ซื้อให้องค์กร ทาง LINE
        </a>
      </div>
    </div>
  )
}
