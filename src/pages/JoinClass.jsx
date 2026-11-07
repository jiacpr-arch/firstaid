import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Users, CheckCircle2, HeartPulse, BookOpen, MessageCircle, ExternalLink, Copy, Check } from 'lucide-react'
import { useEnsureLearner } from '../hooks/useLearner'
import { prefillRealName, realNameProblem } from '../../api/_lib/realName.js'
import { useLearnerStore } from '../stores/learnerStore'
import { upsertLearner } from '../db/database'
import { flushSync } from '../db/sync'
import { authHeader } from '../utils/authHeader'
import { supabase, isSupabaseConfigured } from '../config/supabaseClient'
import { startHubLogin } from '../utils/hubAuth'
import { detectInAppBrowser, detectAndroidOemBrowser } from '../utils/inAppBrowser'
import { fetchHubState, saveCardName } from '../utils/hubCertificate'
import Seo from '../components/Seo'

// เข้าร่วมคลาสด้วยรหัส 6 หลักจากครูผู้สอน (/join หรือ /join/:code จาก QR)
// ต่างจากหน้าเช็คชื่อ (คีออส): ต้อง join บน "เครื่องของตัวเอง" เพราะ enrollment
// ผูกกับ learner.id ของเครื่อง — ความคืบหน้าที่ sync ขึ้นไปถึงจะโชว์บน dashboard ครู
export default function JoinClass() {
  useEnsureLearner()
  const { code: paramCode } = useParams()
  const navigate = useNavigate()
  const learner = useLearnerStore((s) => s.learner)
  const updateLearner = useLearnerStore((s) => s.updateLearner)

  const [code, setCode] = useState(paramCode || '')
  const [nameVal, setNameVal] = useState(() => prefillRealName(learner?.name, { lineName: learner?.lineName || '' }))
  const [phoneVal, setPhoneVal] = useState(learner?.phone || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [joined, setJoined] = useState(null)
  // เข้าคลาสต้องล็อกอินก่อน (LINE) — ทุกคนในคลาสจึงมีบัญชีระบบกลาง + เลขบัตรนักเรียนตั้งแต่วันแรก
  // ใบประกาศออกได้ และครูเห็นชื่อ LINE คู่ชื่อจริง (เคยมีคนเข้าคลาสโดยไม่ล็อกอินจนจบคลาส แล้วออกใบในระบบกลางไม่ได้)
  const [auth, setAuth] = useState(() => (isSupabaseConfigured ? 'checking' : 'off'))
  const [autoRedirect, setAutoRedirect] = useState(false)
  // เบราว์เซอร์ติดเครื่อง Android (Xiaomi/Realme ฯลฯ) ล็อกอิน LINE แล้วไม่กลับมา — ให้เปิดใน Chrome เหมือนเบราว์เซอร์ในแอป
  const [oemBrowser] = useState(() => detectAndroidOemBrowser())
  const [inApp] = useState(() => detectInAppBrowser() || (oemBrowser ? 'oem' : null))
  const [copied, setCopied] = useState(false)
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '')
  // Android: เปิดหน้านี้ใน Chrome ตรง ๆ (intent) · iOS: คัดลอกลิงก์ไปเปิดใน Safari
  const chromeIntent = typeof window !== 'undefined'
    ? `intent://${window.location.host}${window.location.pathname}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent('https://play.google.com/store/apps/details?id=com.android.chrome')};end`
    : ''
  // iOS 17+: x-safari-https:// เปิดลิงก์ใน Safari จากแอปอื่น (เช่นแอป Google ที่ตั้งเป็นเบราว์เซอร์หลัก)
  const safariLink = typeof window !== 'undefined' ? `x-safari-https://${window.location.host}${window.location.pathname}` : ''
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.origin + window.location.pathname); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!supabase) return undefined
    let cancelled = false
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      if (data?.session) { setAuth('in'); return }
      setAuth('out')
      // มาจาก QR (/join/<code>): พาไปล็อกอิน LINE ทันที แล้วกลับมาหน้านี้ — กันวนซ้ำถ้าเพิ่งลองไปไม่เกิน 3 นาที
      let recent = false
      try {
        const last = Math.max(Number(sessionStorage.getItem('fa.joinLoginAt') || 0), Number(localStorage.getItem('fa.joinLoginAt') || 0))
        recent = Date.now() - last < 180_000
      } catch { /* ignore */ }
      // เบราว์เซอร์ในแอป (Google/FB/IG/LINE) ไม่พาไปล็อกอินอัตโนมัติ — ให้เปิดใน Chrome/Safari ก่อน (กันวนลูป)
      if (paramCode && !recent && !inApp) setAutoRedirect(true)
    }).catch(() => { if (!cancelled) setAuth('out') })
    return () => { cancelled = true }
  }, [paramCode, inApp])

  const markLoginAttempt = () => {
    const now = String(Date.now())
    try { sessionStorage.setItem('fa.joinLoginAt', now) } catch { /* ignore */ }
    try { localStorage.setItem('fa.joinLoginAt', now) } catch { /* ignore */ }
  }

  const loginWithLine = () => {
    markLoginAttempt()
    startHubLogin(learner?.id, paramCode ? `/join/${paramCode}` : '/join', { line: true })
  }
  const loginWithJia = () => {
    markLoginAttempt()
    startHubLogin(learner?.id, paramCode ? `/join/${paramCode}` : '/join')
  }

  useEffect(() => {
    if (!autoRedirect || !learner?.id) return
    markLoginAttempt()
    startHubLogin(learner.id, `/join/${paramCode}`, { line: true })
  }, [autoRedirect, learner?.id, paramCode])

  const nameProblem = nameVal.trim() ? realNameProblem(nameVal, { lineName: learner?.lineName || '' }) : ''

  const submit = async () => {
    if (!code.trim() || !nameVal.trim() || !learner?.id || nameProblem) return
    setLoading(true)
    setError('')
    try {
      const headers = { 'Content-Type': 'application/json', ...(await authHeader()) }
      const resp = await fetch('/api/cohorts/join', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          learnerId: learner.id,
          name: nameVal.trim(),
          phone: phoneVal.trim() || null,
        }),
      })
      const body = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        setError(
          resp.status === 404 ? 'ไม่พบคลาสนี้ — ตรวจรหัสอีกครั้ง'
            : resp.status === 410 ? 'คลาสนี้ปิดรับแล้ว'
              : body.error === 'class_full' ? 'คลาสนี้รับผู้เรียนครบจำนวนแล้ว — ติดต่อผู้สอน'
              : body.error === 'phone_required' ? 'คลาสนี้ต้องกรอกเบอร์โทร (ใช้เบอร์เดียวกันตอนเรียน CPR ออนไลน์)'
                : body.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่',
        )
        return
      }

      const patch = {
        name: nameVal.trim(),
        phone: phoneVal.trim(),
        cohortCode: body.code,
        cohortName: body.cohortName,
        // คลาสรวม CPR: จำโค้ดไว้ให้แบนเนอร์คลาส/หน้า Post-test พาไปเรียน CPR ต่อ (useClassCpr)
        cprPromoCode: body.cprPromoCode || null,
        cprStatus: body.cprPromoCode ? 'todo' : 'none',
        cprStatusCode: body.code,
        // พิมพ์ชื่อจริงเองแล้ว — ไม่ต้องถามซ้ำก่อนบทที่ 2 (needsRealName)
        realNameAt: Date.now(),
      }
      updateLearner(patch)
      // ชื่อจริงนี้คือชื่อบนใบประกาศ: ใส่บนบัตรนักเรียน JIA ด้วย (ชื่อที่ครูยืนยันแล้วจะไม่ถูกแก้) — ไม่สำเร็จก็ไม่ขวางการเข้าคลาส
      fetchHubState().then((st) => (st?.profile ? saveCardName(st.profile, { name: nameVal.trim(), phone: phoneVal.trim() }) : null)).catch(() => {})
      await upsertLearner({ ...learner, ...patch }).catch(() => {})
      // ดันความคืบหน้าที่ค้างในเครื่องขึ้น Supabase ทันที ให้ครูเห็นบน dashboard เลย
      flushSync(learner.id)
      setJoined(body)
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  if (joined?.cprPromoCode) {
    // คลาสรวม CPR + ปฐมพยาบาล: เรียนออนไลน์ 2 ส่วนในเว็บนี้ก่อนวันเรียนจริง — ปฐมพยาบาล แล้วต่อ CPR (/cpr)
    // ไม่ต้องข้ามเว็บ/กรอกโค้ดใหม่ ผลสอบ CPR ผูกกับเบอร์ในคลาสนี้ให้ครูเห็นอัตโนมัติ (api/cpr/grade.js)
    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <CheckCircle2 size={44} color="#347053" style={{ margin: '0 auto' }} />
          <div className="text-title" style={{ marginTop: 10 }}>เข้าร่วมคลาสแล้ว!</div>
          <div className="text-caption" style={{ marginTop: 4 }}>
            {joined.cohortName} — ก่อนวันเรียนจริง ต้องเรียนออนไลน์ให้ครบ 2 ส่วน (ในเว็บนี้ทั้งหมด)
          </div>
        </div>

        <div className="card" style={{ marginTop: 12 }}>
          <div className="text-body-strong"><BookOpen size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />ขั้นที่ 1: ปฐมพยาบาล</div>
          <div className="text-caption" style={{ marginTop: 4 }}>
            ทำ pre-test → เรียนทุกบท → ฝึกสถานการณ์ผ่านหมวดละ 1 ฉาก → post-test ผ่าน 80% (ล็อกอิน LINE เพื่อเปิดบทที่ 2 เป็นต้นไป — คนในคลาสเรียนฟรีทุกบท)
          </div>
          <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 10 }} onClick={() => navigate('/')}>
            เริ่มเรียนปฐมพยาบาล
          </button>
        </div>

        <div className="card" style={{ marginTop: 12 }}>
          <div className="text-body-strong"><HeartPulse size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />ขั้นที่ 2: CPR & AED</div>
          <div className="callout" style={{ margin: '6px 0 0', padding: '8px 12px' }}>
            <b>บังคับ</b> — เรียน<b>หลังจบปฐมพยาบาล</b> (ทำ Post-test ผ่านแล้ว ปุ่มเรียน CPR จะขึ้นด้านบนหน้าหลักและหน้าเรียน) ให้จบก่อนวันอบรม
          </div>
          <div className="text-caption" style={{ marginTop: 6 }}>
            เรียนในเว็บนี้ได้เลย ฟรีทุกบทสำหรับคนในคลาส — ไม่ต้องสมัครหรือกรอกโค้ดใหม่ ครูเห็นความคืบหน้าอัตโนมัติ
          </div>
        </div>
      </div>
    )
  }

  if (joined) {
    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: 'center', padding: 28 }}>
          <CheckCircle2 size={48} color="#347053" style={{ margin: '0 auto' }} />
          <div className="text-title" style={{ marginTop: 12 }}>เข้าร่วมคลาสแล้ว!</div>
          <div className="text-caption" style={{ marginTop: 4 }}>
            {joined.cohortName} — ครูผู้สอนจะเห็นความคืบหน้าการเรียนของคุณ
          </div>
        </div>
        <button type="button" className="btn btn-primary btn-block btn-lg" style={{ marginTop: 16 }} onClick={() => navigate('/')}>
          เริ่มเรียนเลย
        </button>
      </div>
    )
  }

  if (auth === 'checking' || autoRedirect) {
    return (
      <div className="page-container">
        <Seo title="เข้าร่วมคลาสเรียน | Jia Training Center" noindex path="/join" />
        <div className="card" style={{ textAlign: 'center', padding: 28, marginTop: 12 }}>
          <div className="text-body">{autoRedirect ? 'กำลังพาไปเข้าสู่ระบบด้วย LINE…' : 'กำลังตรวจสอบการเข้าสู่ระบบ…'}</div>
          {autoRedirect && (
            <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 14, background: '#06C755', borderColor: '#06C755' }} onClick={loginWithLine}>
              <MessageCircle size={18} /> เข้าสู่ระบบด้วย LINE
            </button>
          )}
        </div>
      </div>
    )
  }

  if (auth === 'out') {
    return (
      <div className="page-container">
        <Seo title="เข้าร่วมคลาสเรียน | Jia Training Center" noindex path="/join" />
        <div className="card" style={{ marginTop: 12, textAlign: 'center', padding: 24 }}>
          {inApp && (
            <div className="callout" style={{ marginBottom: 14, textAlign: 'left', borderColor: '#E9D9B7', background: '#F7EFDF', color: '#7A5A1F' }} data-testid="join-inapp">
              <div className="text-body-strong" style={{ color: '#7A5A1F' }}>
                <ExternalLink size={15} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                เปิดหน้านี้ใน {isAndroid ? 'Chrome' : 'Safari'} ก่อน
              </div>
              <div className="text-caption" style={{ marginTop: 4, color: '#7A5A1F' }}>
                {inApp === 'oem' ? <>ตอนนี้เปิดอยู่ในเบราว์เซอร์ของเครื่อง {oemBrowser} —</> : <>ตอนนี้เปิดอยู่ในแอป {inApp === 'google' ? 'Google' : inApp === 'line' ? 'LINE' : inApp === 'facebook' ? 'Facebook' : 'Instagram'} —</>}
                การเข้าสู่ระบบด้วย LINE ในนี้อาจวนกลับไปหน้าเข้าสู่ระบบซ้ำ ๆ
              </div>
              {isAndroid ? (
                <a href={chromeIntent} className="btn btn-primary btn-block" style={{ marginTop: 10 }}>
                  <ExternalLink size={16} /> เปิดใน Chrome
                </a>
              ) : (
                <>
                  <a href={safariLink} className="btn btn-primary btn-block" style={{ marginTop: 10 }}>
                    <ExternalLink size={16} /> เปิดใน Safari
                  </a>
                  <div className="text-caption" style={{ marginTop: 6, color: '#7A5A1F' }}>
                    ถ้ากดแล้วไม่เปิด: คัดลอกลิงก์ แล้วเปิดแอป Safari วางลิงก์ในช่องที่อยู่
                  </div>
                </>
              )}
              <button type="button" className="btn btn-secondary btn-block" style={{ marginTop: 8 }} onClick={copyLink}>
                {copied ? <><Check size={14} /> คัดลอกลิงก์แล้ว</> : <><Copy size={14} /> คัดลอกลิงก์</>}
              </button>
              {/* ไม่ใช้ Chrome/Safari: ล็อกอินด้วยอีเมลไม่ต้องสลับไปแอป LINE จึงไม่ติดลูปในเบราว์เซอร์ของแอป */}
              <div className="text-caption" style={{ marginTop: 10, color: '#7A5A1F' }}>หรือไม่ต้องเปลี่ยนเบราว์เซอร์:</div>
              <button type="button" className="btn btn-secondary btn-block" style={{ marginTop: 4 }} onClick={loginWithJia}>
                เข้าสู่ระบบด้วยอีเมล (บัญชี JIA)
              </button>
            </div>
          )}
          <div className="text-title">เข้าสู่ระบบก่อนเข้าคลาส</div>
          <div className="text-caption" style={{ marginTop: 6 }}>
            ใช้ LINE เข้าสู่ระบบครั้งเดียว เพื่อบันทึกการเรียน เช็คชื่อวันอบรม และรับใบประกาศของคลาสนี้
          </div>
          <button type="button" className="btn btn-primary btn-block btn-lg" style={{ marginTop: 16, background: '#06C755', borderColor: '#06C755' }} onClick={loginWithLine}>
            <MessageCircle size={18} /> เข้าสู่ระบบด้วย LINE
          </button>
          <button type="button" className="btn btn-ghost btn-block" style={{ marginTop: 8, fontSize: 13 }} onClick={loginWithJia}>
            ไม่มี LINE? เข้าสู่ระบบด้วยบัญชี JIA (อีเมล)
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <Seo title="เข้าร่วมคลาสเรียน | Jia Training Center" noindex path="/join" />
      <div style={{ marginTop: 8 }}>
        <div className="text-caption">ห้องเรียน</div>
        <div className="text-title">เข้าร่วมคลาสด้วยรหัส</div>
      </div>

      {!isSupabaseConfigured && (
        <div className="callout callout-info" style={{ marginTop: 12 }}>
          ยังไม่ได้เชื่อมต่อ Supabase — ฟีเจอร์คลาสใช้ไม่ได้ในโหมดออฟไลน์
        </div>
      )}

      <div className="card" style={{ marginTop: 12 }}>
        <label className="label">รหัสคลาส 6 หลัก (จากครูผู้สอน)</label>
        <input
          className="input"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="เช่น A3F9K2"
          maxLength={6}
          style={{ letterSpacing: 3, fontWeight: 700, textAlign: 'center', fontSize: 18 }}
        />
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <label className="label">ชื่อ-นามสกุลจริง (ใช้พิมพ์บนใบประกาศ)</label>
        <input className="input" value={nameVal} onChange={(e) => setNameVal(e.target.value)} placeholder="ชื่อ นามสกุล ตามบัตรประชาชน" />
        {nameProblem && <div className="text-caption" style={{ color: '#A0392F', marginTop: 4 }}>{nameProblem}</div>}
        {learner?.lineName && <div className="text-caption" style={{ marginTop: 4 }}>ชื่อ LINE ของคุณ: {learner.lineName} (ครูจะเห็นคู่กับชื่อจริง)</div>}
        <label className="label" style={{ marginTop: 10 }}>เบอร์โทร</label>
        <input className="input" value={phoneVal} onChange={(e) => setPhoneVal(e.target.value)} inputMode="tel" placeholder="0812345678" />
      </div>

      <div className="callout callout-info" style={{ marginTop: 8 }}>
        <Users size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
        กดเข้าร่วมจาก<b>มือถือ/เครื่องของตัวเอง</b>เท่านั้น — ความคืบหน้าการเรียนผูกกับเครื่องนี้
        (ล็อกอิน LINE ใน <Link to="/settings" style={{ color: 'var(--color-brand)' }}>ตั้งค่า</Link> เพื่อย้ายเครื่องได้)
      </div>

      {error && <div className="callout callout-danger" style={{ marginTop: 8 }}>{error}</div>}

      <button
        type="button"
        className="btn btn-primary btn-block btn-lg"
        style={{ marginTop: 16 }}
        disabled={!code.trim() || !nameVal.trim() || !!nameProblem || loading || !isSupabaseConfigured}
        onClick={submit}
      >
        <Users size={18} /> {loading ? 'กำลังเข้าร่วม…' : 'เข้าร่วมคลาส'}
      </button>
    </div>
  )
}
