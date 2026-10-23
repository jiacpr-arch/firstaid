import { useEffect, useState } from 'react'
import { Award } from 'lucide-react'
import { useLearnerStore } from '../stores/learnerStore'
import { getCertificates, upsertLearner } from '../db/database'
import { evaluateTheoryEligibility } from '../courses/firstaid/cert'
import { issueTheoryCertificate } from '../utils/certIssue'
import { fetchHubState, saveCardName, claimHubCertificate } from '../utils/hubCertificate'
import LineGateCard from './LineGateCard'
import HubCertificateCard from './HubCertificateCard'
import AccountCard from './AccountCard'
import { isSupabaseConfigured } from '../config/supabaseClient'
import { HUB_URL } from '../utils/hubCertificate'
import { lineInterestUrl } from '../utils/lineLinks'
import { track } from '../utils/analytics'

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
// the learner the JIA Hub's central certificate — the one they open, print and verify. This app never
// renders its own certificate any more: a learner the Hub hasn't given one yet is sent there, and an
// FA- certificate issued before the switch is pointed there too (LINE OA if the Hub can't re-issue it).
// Shared by the post-test results screen and the /certificate page.
//
// Every new certificate comes from the Hub (owner decision 23 Oct 2026): wherever Supabase is
// configured the form waits for a login, issuance has no offline fallback, and a certificate issued
// that way (hubIssued) is never shown as this app's own — until the Hub's is there the learner sees
// "being issued" with a retry.
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
  const hubMode = isSupabaseConfigured

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
        hub: hubMode,
      })
      setCert(issued)
      onIssued?.(issued)
      setHub(await getHubCertificate(hub?.signedIn ? await fetchHubState() : hub, setHubError))
    } catch (err) {
      console.error('issue theory cert failed', err)
      setError(hubMode && err?.message ? err.message : 'ออกใบประกาศไม่สำเร็จ กรุณาลองใหม่')
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

  const issued = !!cert

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Award size={22} strokeWidth={1.6} color="#1b2a5b" />
        <div style={{ flex: 1 }}>
          <div className="text-body-strong">ใบประกาศภาคทฤษฎี</div>
          <div className="text-caption">ออกเมื่อผ่าน Post-test ≥ 80% · มี QR Code ตรวจสอบได้</div>
        </div>
        {issued || hubCert ? <span className="badge badge-success">ได้รับแล้ว</span> :
          theoryEval.eligible && !lineAdded ? <span className="badge badge-brand">อีกขั้นเดียว</span> :
          theoryEval.eligible ? <span className="badge badge-brand">พร้อมออก</span> :
          <span className="badge badge-muted">ยังไม่พร้อม</span>}
      </div>

      {/* Issued — the Hub's certificate when there is one */}
      {issued && hubCert && <HubCertificateCard cert={hubCert} />}

      {/* Issued for the Hub, which hasn't given its certificate yet — no local one, say why and retry */}
      {issued && cert.hubIssued && !hubCert && hub !== undefined && (
        <div className="callout callout-info" data-testid="hub-certificate-pending" style={{ marginTop: 12 }}>
          {hub?.signedIn === false ? (
            <>
              <div className="text-caption">เข้าสู่ระบบเพื่อดูใบประกาศของคุณจากระบบกลาง JIA</div>
              <AccountCard showSignedOut style={{ marginTop: 10 }} />
            </>
          ) : (
            <>
              <div className="text-caption">
                {hubError || 'ใบประกาศกำลังออกที่ระบบกลาง JIA — กดขอรับอีกครั้ง หรือเปิดหน้าใบประกาศของคุณที่ class.jiacpr.com'}
              </div>
              <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 8 }} disabled={busy} onClick={retryHub}>
                {busy ? 'กำลังออกใบประกาศ…' : 'รับใบประกาศแบบใหม่ (มี QR Code)'}
              </button>
              <a className="btn btn-secondary btn-block" style={{ marginTop: 8, textDecoration: 'none' }}
                href={HUB_URL + '/portal/certificates'} target="_blank" rel="noreferrer">
                เปิดใบประกาศของฉันที่ class.jiacpr.com ↗
              </a>
            </>
          )}
        </div>
      )}

      {/* Issued here before the switch, no Hub certificate yet — this app no longer shows its own
          certificate: send the learner to the Hub (log in / get the new one), where the old FA- code
          still verifies. A learner the Hub can't re-issue for is pointed to LINE OA. */}
      {issued && !cert.hubIssued && !hubCert && hub !== undefined && (
        <div className="callout callout-info" data-testid="legacy-certificate" style={{ marginTop: 12 }}>
          <div className="text-caption">
            ใบประกาศดู / พิมพ์ได้ที่ระบบกลาง JIA (class.jiacpr.com) — ใบเดิมของคุณ (เลขที่ {cert.code}) ยังใช้ได้
            และตรวจสอบได้ที่ระบบกลางด้วยเลขที่ + ชื่อ
          </div>
          {hub?.signedIn === false ? (
            <>
              <div className="text-caption" style={{ marginTop: 6 }}>เข้าสู่ระบบเพื่อรับใบแบบใหม่ (มี QR Code)</div>
              <AccountCard showSignedOut style={{ marginTop: 10 }} />
            </>
          ) : (
            <>
              {hubError && <div className="text-caption" style={{ marginTop: 6 }}>{hubError}</div>}
              <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 8 }} disabled={busy} onClick={retryHub}>
                {busy ? 'กำลังออกใบประกาศ…' : 'รับใบประกาศแบบใหม่ (มี QR Code)'}
              </button>
              <a className="btn btn-secondary btn-block" style={{ marginTop: 8, textDecoration: 'none' }}
                href={HUB_URL + '/portal/certificates'} target="_blank" rel="noreferrer">
                เปิดใบประกาศของฉันที่ class.jiacpr.com ↗
              </a>
            </>
          )}
          <div className="text-caption" style={{ marginTop: 10, textAlign: 'center' }}>
            ยังรับใบแบบใหม่ไม่ได้? ติดต่อ{' '}
            <a href={lineInterestUrl(`ขอรับใบประกาศแบบใหม่ (ใบเดิม ${cert.code})`)} target="_blank" rel="noreferrer"
              style={{ textDecoration: 'underline' }}>LINE OA @jiacpr</a>
          </div>
        </div>
      )}

      {/* Not yet eligible */}
      {loaded && !issued && !theoryEval.eligible && (
        <div className="text-caption" style={{ marginTop: 8 }}>{theoryEval.reason}</div>
      )}

      {/* Eligible & not issued — LINE gate first, then form */}
      {loaded && !issued && theoryEval.eligible && !lineAdded && (
        <LineGateCard onConfirm={confirmLine} />
      )}

      {/* Eligible — every certificate comes from the JIA Hub, so log in first */}
      {loaded && !issued && theoryEval.eligible && lineAdded && hubMode && hub?.signedIn === false && (
        <div style={{ marginTop: 12 }} data-testid="cert-login-gate">
          <div className="text-body-strong">เข้าสู่ระบบเพื่อรับใบประกาศ</div>
          <div className="text-caption" style={{ marginTop: 4 }}>
            ใบประกาศ JIA ทุกใบออกจากระบบกลาง (class.jiacpr.com) — มี QR Code ตรวจสอบได้ ใส่รูปได้
            และรวมใบทุกคอร์สไว้ในบัญชีเดียว
          </div>
          <AccountCard showSignedOut style={{ marginTop: 10 }} />
        </div>
      )}

      {loaded && !issued && theoryEval.eligible && lineAdded && (!hubMode || (hub !== undefined && hub?.signedIn !== false)) && (
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
