import { useEffect, useState } from 'react'
import { Award, Download, ImageDown } from 'lucide-react'
import { useLearnerStore } from '../stores/learnerStore'
import { getCertificates, upsertLearner } from '../db/database'
import { CERT_KINDS, evaluateTheoryEligibility } from '../courses/firstaid/cert'
import { issueTheoryCertificate } from '../utils/certIssue'
import CertificatePreview from './CertificatePreview'
import LineGateCard from './LineGateCard'
import HubCertificateCard from './HubCertificateCard'
import AccountCard from './AccountCard'
import { isSupabaseConfigured } from '../config/supabaseClient'
import { useAuthSession } from '../hooks/useAuthSession'
import { readHubCard, saveHubCardName } from '../utils/hubProfile'
// jspdf/html-to-image หนักรวม ~450KB — โหลดเฉพาะตอนกดดาวน์โหลด ไม่ให้ปนใน chunk หลัก
import { track } from '../utils/analytics'

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
}

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
const phoneDigits = (v) => v.replace(/\D/g, '')

// Self-service theory certificate card: collects name + phone + email + PDPA consent,
// issues the certificate once, then locks. Shared by the post-test results screen and the
// /certificate page.
//
// Every new certificate is issued by the JIA Hub (owner decision 23 Oct 2026): wherever Supabase is
// configured the form waits for a login (LINE or the JIA account), puts the name on the learner's JIA
// student card, and the request records the passed post-test at the Hub — the certificate shown is the
// Hub's (HubCertificateCard), never a local one. Certificates issued here before stay as they were.
// A build without Supabase keeps issuing its own (there is no Hub to send the learner to).
export default function TheoryCertCard({ postAttempt, onIssued }) {
  const learner = useLearnerStore((s) => s.learner)
  const updateLearner = useLearnerStore((s) => s.updateLearner)

  const [cert, setCert] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { session, loading: sessionLoading } = useAuthSession()
  const hubMode = isSupabaseConfigured
  const [hubCard, setHubCard] = useState(null)

  // The JIA student card's name is the name on the Hub certificate: prefill it, and keep it read-only
  // once an instructor has locked it.
  useEffect(() => {
    if (!hubMode || !session) return undefined
    let cancelled = false
    readHubCard().then((card) => {
      if (cancelled || !card) return
      setHubCard(card)
      if (card.name) setName(card.name)
    })
    return () => { cancelled = true }
  }, [hubMode, session])

  useEffect(() => {
    if (!learner?.id) return
    let cancelled = false
    getCertificates(learner.id).then((list) => {
      if (cancelled) return
      setCert(list.find((c) => c.kind === 'theory') || null)
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [learner?.id])

  // Seed the form from the learner profile once it's available.
  const [seededFor, setSeededFor] = useState(null)
  if (learner?.id && seededFor !== learner.id) {
    setSeededFor(learner.id)
    setName(learner.name || '')
    setPhone(learner.phone || '')
    setEmail(learner.email || '')
  }

  const accent = '#546A50' // โทนใบประกาศ (cert-title) ของ JIA Learning Hub — PDF ยังใช้สีตาม CERT_KINDS
  const theoryEval = evaluateTheoryEligibility({ postTestAttempt: postAttempt })
  const lineAdded = !!learner?.lineAdded

  const confirmLine = async () => {
    updateLearner({ lineAdded: true })
    track('line_add', { source: 'cert_gate' })
    await upsertLearner({ ...learner, lineAdded: true })
  }

  const nameOk = name.trim().length > 0
  const phoneOk = phoneDigits(phone).length >= 9
  const emailOk = isEmail(email)
  const canIssue = nameOk && phoneOk && emailOk && consent && theoryEval.eligible && !busy

  const issue = async () => {
    if (!canIssue || !learner?.id) return
    setBusy(true)
    setError('')
    try {
      const patch = { name: name.trim(), phone: phone.trim(), email: email.trim() }
      updateLearner(patch)
      const merged = { ...learner, ...patch }
      await upsertLearner(merged)
      if (hubMode) await saveHubCardName(patch.name, patch.phone)
      const { cert: issued } = await issueTheoryCertificate({
        learner: merged,
        attempt: postAttempt,
        phone: patch.phone,
        email: patch.email,
        hub: hubMode,
      })
      setCert(issued)
      onIssued?.(issued)
    } catch (err) {
      console.error('issue theory cert failed', err)
      setError(hubMode && err?.message ? err.message : 'ออกใบประกาศไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setBusy(false)
    }
  }

  const certArgs = () => ({
    kind: 'theory',
    learnerName: cert.learnerName || learner?.name || '',
    dateStr: fmtDate(cert.issuedAt),
    code: cert.code,
  })

  const downloadPdf = () => {
    import('../utils/certPdf')
      .then(({ downloadCertPdf }) => downloadCertPdf(certArgs()))
      .catch((err) => {
        console.error('download cert pdf failed', err)
        setError('สร้าง PDF ไม่สำเร็จ กรุณาลองใหม่')
      })
  }

  const downloadPng = () => {
    import('../utils/certImage')
      .then(({ downloadCertPng }) => downloadCertPng(certArgs()))
      .catch((err) => {
        console.error('download cert png failed', err)
        setError('บันทึกรูปไม่สำเร็จ กรุณาลองใหม่')
      })
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Award size={22} strokeWidth={1.6} color={accent} />
        <div style={{ flex: 1 }}>
          <div className="text-body-strong">ใบประกาศภาคทฤษฎี</div>
          <div className="text-caption">ออกเมื่อผ่าน Post-test ≥ 80%</div>
        </div>
        {cert ? <span className="badge badge-success">ได้รับแล้ว</span> :
          theoryEval.eligible && !lineAdded ? <span className="badge badge-brand">อีกขั้นเดียว</span> :
          theoryEval.eligible ? <span className="badge badge-brand">พร้อมออก</span> :
          <span className="badge badge-muted">ยังไม่พร้อม</span>}
      </div>

      {/* Issued by the Hub — shown from there */}
      {cert?.hubIssued && (session
        ? <HubCertificateCard requested />
        : (
          <>
            <div className="text-caption" style={{ marginTop: 8 }}>เข้าสู่ระบบเพื่อดูใบประกาศของคุณจากระบบกลาง JIA</div>
            <AccountCard showSignedOut style={{ marginTop: 10 }} />
          </>
        ))}

      {/* Issued here before the Hub took over — locked preview + download */}
      {cert && !cert.hubIssued && (
        <>
          <div style={{ marginTop: 14 }}>
            <CertificatePreview
              kind="theory"
              learnerName={cert.learnerName || learner?.name || ''}
              dateStr={fmtDate(cert.issuedAt)}
              code={cert.code}
            />
          </div>
          <div className="text-caption" style={{ marginTop: 8 }}>
            ออกใบประกาศแล้ว — ข้อมูลถูกล็อก หากต้องการแก้ไขกรุณาติดต่อเจ้าหน้าที่
          </div>
          <button type="button" className="btn btn-secondary btn-block" style={{ marginTop: 10 }}
            onClick={downloadPng}>
            <ImageDown size={16} /> บันทึกเป็นรูปภาพ (PNG)
          </button>
          <button type="button" className="btn btn-secondary btn-block" style={{ marginTop: 8 }}
            onClick={downloadPdf}>
            <Download size={16} /> ดาวน์โหลด PDF
          </button>
        </>
      )}

      {/* Not yet eligible */}
      {loaded && !cert && !theoryEval.eligible && (
        <div className="text-caption" style={{ marginTop: 8 }}>{theoryEval.reason}</div>
      )}

      {/* Eligible & not issued — LINE gate first, then form */}
      {loaded && !cert && theoryEval.eligible && !lineAdded && (
        <LineGateCard onConfirm={confirmLine} />
      )}

      {/* Eligible — every certificate comes from the JIA Hub, so log in first */}
      {loaded && !cert && theoryEval.eligible && lineAdded && hubMode && !session && !sessionLoading && (
        <div style={{ marginTop: 12 }} data-testid="cert-login-gate">
          <div className="text-body-strong">เข้าสู่ระบบเพื่อรับใบประกาศ</div>
          <div className="text-caption" style={{ marginTop: 4 }}>
            ใบประกาศ JIA ทุกใบออกจากระบบกลาง (class.jiacpr.com) — มี QR Code ตรวจสอบได้ ใส่รูปได้
            และรวมใบทุกคอร์สไว้ในบัญชีเดียว
          </div>
          <AccountCard showSignedOut style={{ marginTop: 10 }} />
        </div>
      )}

      {loaded && !cert && theoryEval.eligible && lineAdded && (!hubMode || session) && (
        <div style={{ marginTop: 12 }}>
          <label className="label">ชื่อ-นามสกุล</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)}
            readOnly={!!hubCard?.nameLocked}
            placeholder="ชื่อที่จะแสดงบนใบประกาศ" />
          {hubMode && (
            <div className="text-caption" style={{ marginTop: 4 }}>
              {hubCard?.nameLocked
                ? 'ชื่อนี้ยืนยันแล้วบนบัตรนักเรียน JIA — แก้ไขได้โดยติดต่อเจ้าหน้าที่'
                : 'ใช้เป็นชื่อบนบัตรนักเรียน JIA และใบประกาศของคุณที่ระบบกลาง'}
            </div>
          )}

          <label className="label" style={{ marginTop: 10 }}>เบอร์โทร</label>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)}
            inputMode="tel" placeholder="0XX-XXX-XXXX" />

          <label className="label" style={{ marginTop: 10 }}>อีเมล</label>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)}
            inputMode="email" type="email" placeholder="you@email.com" />

          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
              style={{ marginTop: 3 }} />
            <span className="text-caption">
              ยินยอมให้ Jia Training Center เก็บและใช้ชื่อ เบอร์โทร และอีเมล เพื่อออกใบประกาศและติดต่อเรื่องการอบรม
              ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)
            </span>
          </label>

          {error && <div className="callout callout-warning" style={{ marginTop: 10 }}>{error}</div>}

          <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 12 }}
            disabled={!canIssue} onClick={issue}>
            {busy ? 'กำลังออกใบประกาศ…' : hubMode ? 'รับใบประกาศ (ระบบกลาง JIA)' : 'ออกใบประกาศ'}
          </button>
          {!consent && (
            <div className="text-caption" style={{ marginTop: 6, textAlign: 'center' }}>
              กรุณากรอกข้อมูลให้ครบและติ๊กยินยอมก่อนออกใบประกาศ
            </div>
          )}
        </div>
      )}

      {/* The Hub's central online certificate next to one issued here before (nothing until there is one) */}
      {!cert?.hubIssued && <HubCertificateCard />}
    </div>
  )
}
