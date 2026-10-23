import { useEffect, useState } from 'react'
import { Award, Download, ImageDown } from 'lucide-react'
import { useLearnerStore } from '../stores/learnerStore'
import { getCertificates, upsertLearner } from '../db/database'
import { evaluateTheoryEligibility } from '../courses/firstaid/cert'
import { issueTheoryCertificate } from '../utils/certIssue'
import { fetchHubState, saveCardName, claimHubCertificate } from '../utils/hubCertificate'
import CertificatePreview from './CertificatePreview'
import LineGateCard from './LineGateCard'
import HubCertificateCard from './HubCertificateCard'
// jspdf/html-to-image หนักรวม ~450KB — โหลดเฉพาะตอนกดดาวน์โหลด ไม่ให้ปนใน chunk หลัก
import { track } from '../utils/analytics'

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
}

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
const phoneDigits = (v) => v.replace(/\D/g, '')

// Asks the Hub for the certificate (it may already have issued it on its own) and returns the fresh
// state; on refusal returns the old state and reports the Hub's reason (e.g. no name on the card yet).
async function getHubCertificate(state, onError) {
  if (!state?.signedIn || state.cert) return state
  try {
    await claimHubCertificate()
    track('hub_cert_claimed', { source: 'theory_card' })
    onError('')
    return await fetchHubState()
  } catch (err) {
    onError(err.message)
    return state
  }
}

// Self-service theory certificate card: collects name + phone + email + PDPA consent, records this
// app's own theory certificate (practical certificate, LINE follow-up, FA- verification), then shows
// the learner the JIA Hub's central certificate — the one they open, print and verify. Only when the
// Hub can't give one (not signed in, Hub unreachable, result not at the Hub) does the learner see
// this app's own certificate, so nobody is left without one.
// Shared by the post-test results screen and the /certificate page.
export default function TheoryCertCard({ postAttempt, onIssued }) {
  const learner = useLearnerStore((s) => s.learner)
  const updateLearner = useLearnerStore((s) => s.updateLearner)

  const [cert, setCert] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [hub, setHub] = useState(undefined) // undefined = loading, null = unreachable
  const [hubError, setHubError] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!learner?.id) return
    let cancelled = false
    Promise.all([getCertificates(learner.id), fetchHubState()]).then(async ([list, hubState]) => {
      if (cancelled) return
      const own = list.find((c) => c.kind === 'theory') || null
      setCert(own)
      setLoaded(true)
      // Already issued here and the Hub is ready to issue its own: fetch it straight away, so a
      // learner from before the switch sees the central certificate without pressing anything.
      const next = own && hubState?.claimable && !hubState.cert ? await getHubCertificate(hubState, setHubError) : hubState
      if (!cancelled) setHub(next)
    })
    return () => { cancelled = true }
  }, [learner?.id])

  // Seed the form once: the Hub certificate's name, else the student card's, else this app's profile.
  const [seededFor, setSeededFor] = useState(null)
  if (learner?.id && loaded && seededFor !== learner.id) {
    setSeededFor(learner.id)
    setName(hub?.cert?.name || hub?.profile?.nameTh || learner.name || '')
    setPhone(learner.phone || hub?.profile?.phone || '')
    setEmail(learner.email || hub?.profile?.email || '')
  }
  // The name printed on the Hub certificate comes from the student card; once a certificate exists or
  // an instructor has verified the card, that name is fixed.
  const nameFixed = !!(hub?.cert || hub?.profile?.nameLocked)

  const theoryEval = evaluateTheoryEligibility({ postTestAttempt: postAttempt })
  const lineAdded = !!learner?.lineAdded
  const hubCert = hub?.cert || null

  const confirmLine = async () => {
    updateLearner({ lineAdded: true })
    track('line_add', { source: 'cert_gate' })
    await upsertLearner({ ...learner, lineAdded: true })
  }

  const nameOk = name.trim().length >= 2
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
      if (hub?.signedIn && !nameFixed) {
        await saveCardName(hub.profile, { name: patch.name, phone: patch.phone }).catch((err) => setHubError(err.message))
      }
      const { cert: issued } = await issueTheoryCertificate({
        learner: merged,
        attempt: postAttempt,
        phone: patch.phone,
        email: patch.email,
      })
      setCert(issued)
      onIssued?.(issued)
      setHub(await getHubCertificate(hub?.signedIn ? await fetchHubState() : hub, setHubError))
    } catch (err) {
      console.error('issue theory cert failed', err)
      setError('ออกใบประกาศไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setBusy(false)
    }
  }

  // Learners who got this app's certificate before the switch: fetch their Hub certificate on request.
  // A student card with no name yet gets the name already on this app's certificate.
  const retryHub = async () => {
    setBusy(true)
    try {
      const state = await fetchHubState()
      const certName = (cert?.learnerName || '').trim()
      if (state?.signedIn && !state.cert && state.profile && !(state.profile.nameTh || '').trim() && certName.length >= 2) {
        await saveCardName(state.profile, { name: certName, phone: state.profile.phone || cert.learnerPhone || '' })
          .catch((err) => setHubError(err.message))
      }
      setHub(await getHubCertificate(state, setHubError))
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

  const issued = !!cert

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Award size={22} strokeWidth={1.6} color="#1b2a5b" />
        <div style={{ flex: 1 }}>
          <div className="text-body-strong">ใบประกาศภาคทฤษฎี</div>
          <div className="text-caption">ออกเมื่อผ่าน Post-test ≥ 80% · ใบกลาง JIA ตรวจสอบได้ด้วย QR</div>
        </div>
        {issued || hubCert ? <span className="badge badge-success">ได้รับแล้ว</span> :
          theoryEval.eligible && !lineAdded ? <span className="badge badge-brand">อีกขั้นเดียว</span> :
          theoryEval.eligible ? <span className="badge badge-brand">พร้อมออก</span> :
          <span className="badge badge-muted">ยังไม่พร้อม</span>}
      </div>

      {/* Issued — the Hub's certificate when there is one */}
      {issued && hubCert && <HubCertificateCard cert={hubCert} />}

      {/* Issued, but no Hub certificate yet — say why, offer to retry, and keep this app's own one */}
      {issued && !hubCert && hub !== undefined && (
        <>
          {hub?.signedIn && (
            <div className="callout callout-info" style={{ marginTop: 12 }}>
              <div className="text-caption">
                {hubError || 'ยังไม่ได้รับใบกลาง JIA (แบบใหม่ มี QR Code)'}
              </div>
              <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 8 }} disabled={busy} onClick={retryHub}>
                {busy ? 'กำลังขอรับ…' : 'ขอรับใบกลาง JIA'}
              </button>
            </div>
          )}
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
      {loaded && !issued && !theoryEval.eligible && (
        <div className="text-caption" style={{ marginTop: 8 }}>{theoryEval.reason}</div>
      )}

      {/* Eligible & not issued — LINE gate first, then form */}
      {loaded && !issued && theoryEval.eligible && !lineAdded && (
        <LineGateCard onConfirm={confirmLine} />
      )}

      {loaded && !issued && theoryEval.eligible && lineAdded && (
        <div style={{ marginTop: 12 }}>
          <label className="label">ชื่อ-นามสกุล (ภาษาไทย)</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="ชื่อที่จะแสดงบนใบประกาศ" readOnly={nameFixed} />
          <div className="text-caption" style={{ marginTop: 4 }}>
            {nameFixed
              ? 'ชื่อนี้มาจากบัตรนักเรียน JIA ของคุณ — หากต้องการแก้ไขกรุณาติดต่อเจ้าหน้าที่'
              : 'ชื่อนี้จะพิมพ์บนใบประกาศและบันทึกในบัตรนักเรียน JIA ของคุณ'}
          </div>

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
            {busy ? 'กำลังออกใบประกาศ…' : 'รับใบประกาศ'}
          </button>
          {!consent && (
            <div className="text-caption" style={{ marginTop: 6, textAlign: 'center' }}>
              กรุณากรอกข้อมูลให้ครบและติ๊กยินยอมก่อนออกใบประกาศ
            </div>
          )}
        </div>
      )}
    </div>
  )
}
