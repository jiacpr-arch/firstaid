import { useEffect, useState } from 'react'
import { Award, Download } from 'lucide-react'
import { useEnsureLearner } from '../hooks/useLearner'
import { useLearnerStore } from '../stores/learnerStore'
import {
  getBestExam,
  getCertificates,
  saveCertificate,
  upsertLearner,
} from '../db/database'
import {
  CERT_KINDS,
  evaluateTheoryEligibility,
  evaluatePracticalEligibility,
  generateCertCode,
} from '../courses/firstaid/cert'
import CertificatePreview from '../components/CertificatePreview'
import CertUpsellCard from '../components/CertUpsellCard'
import { downloadCertPdf } from '../utils/certPdf'

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function Certification() {
  useEnsureLearner()
  const learner = useLearnerStore((s) => s.learner)
  const updateLearner = useLearnerStore((s) => s.updateLearner)

  const [nameInput, setNameInput] = useState(learner?.name || '')
  const [phoneInput, setPhoneInput] = useState(learner?.phone || '')
  const [postAttempt, setPostAttempt] = useState(null)
  const [certs, setCerts] = useState([])
  const [busy, setBusy] = useState(false)

  // Sync local form when learner profile changes elsewhere — set-during-render pattern
  const [prevLearnerKey, setPrevLearnerKey] = useState(
    `${learner?.id || ''}|${learner?.name || ''}|${learner?.phone || ''}`,
  )
  const learnerKey = `${learner?.id || ''}|${learner?.name || ''}|${learner?.phone || ''}`
  if (prevLearnerKey !== learnerKey) {
    setPrevLearnerKey(learnerKey)
    setNameInput(learner?.name || '')
    setPhoneInput(learner?.phone || '')
  }

  useEffect(() => {
    if (!learner?.id) return
    let cancelled = false
    Promise.all([
      getBestExam(learner.id, 'post'),
      getCertificates(learner.id),
    ]).then(([best, c]) => {
      if (cancelled) return
      setPostAttempt(best)
      setCerts(c)
    })
    return () => { cancelled = true }
  }, [learner?.id])

  const saveProfile = async () => {
    if (!nameInput.trim()) return
    const patch = { name: nameInput.trim(), phone: phoneInput.trim() }
    updateLearner(patch)
    await upsertLearner({ ...learner, ...patch })
  }

  const theoryCert = certs.find((c) => c.kind === 'theory')
  const practicalCert = certs.find((c) => c.kind === 'practical')

  const theoryEval = evaluateTheoryEligibility({ postTestAttempt: postAttempt })
  const practicalEval = evaluatePracticalEligibility({
    hasTheory: !!theoryCert,
    approvedAttendance: practicalCert?.fromApproval || false,
  })

  const issueTheory = async () => {
    if (!learner?.name?.trim()) {
      alert('กรุณาตั้งชื่อก่อน')
      return
    }
    if (!theoryEval.eligible) return
    setBusy(true)
    const code = generateCertCode()
    const cert = {
      id: `theory-${learner.id}`,
      learnerId: learner.id,
      kind: 'theory',
      code,
      issuedAt: new Date().toISOString(),
    }
    await saveCertificate(cert)
    setCerts((c) => [...c.filter((x) => x.kind !== 'theory'), cert])
    setBusy(false)
  }

  const downloadPdf = (cert) => {
    downloadCertPdf({
      kind: cert.kind,
      learnerName: learner?.name || '',
      dateStr: fmtDate(cert.issuedAt),
      code: cert.code,
      instructorName: cert.instructorName,
      location: cert.location,
    })
  }

  return (
    <div className="page-container">
      <div style={{ marginTop: 8 }}>
        <div className="text-caption">ใบประกาศของฉัน</div>
        <div className="text-title">ทฤษฎี + ปฏิบัติ</div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="text-body-strong" style={{ marginBottom: 8 }}>ข้อมูลผู้เรียน</div>
        <label className="label">ชื่อ-นามสกุล</label>
        <input className="input" value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="ชื่อสำหรับใบประกาศ" />
        <label className="label" style={{ marginTop: 10 }}>เบอร์โทร (เลือกใส่)</label>
        <input className="input" value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} inputMode="tel" placeholder="0XX-XXX-XXXX" />
        <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={saveProfile}>
          บันทึก
        </button>
      </div>

      {/* Theory */}
      <div className="card" style={{ marginTop: 16, borderTop: `4px solid ${CERT_KINDS.theory.accent}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Award size={22} color={CERT_KINDS.theory.accent} />
          <div style={{ flex: 1 }}>
            <div className="text-body-strong">ใบประกาศภาคทฤษฎี</div>
            <div className="text-caption">ออกอัตโนมัติเมื่อผ่าน Post-test ≥ 80%</div>
          </div>
          {theoryCert ? <span className="badge badge-success">ได้รับแล้ว</span> :
            theoryEval.eligible ? <span className="badge badge-brand">พร้อมออก</span> :
            <span className="badge badge-muted">ยังไม่พร้อม</span>}
        </div>
        {!theoryCert && !theoryEval.eligible && (
          <div className="text-caption" style={{ marginTop: 8 }}>{theoryEval.reason}</div>
        )}
        {!theoryCert && theoryEval.eligible && (
          <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 12 }}
            disabled={busy} onClick={issueTheory}>
            ออกใบประกาศ
          </button>
        )}
        {theoryCert && (
          <>
            <div style={{ marginTop: 14 }}>
              <CertificatePreview
                kind="theory"
                learnerName={learner?.name || ''}
                dateStr={fmtDate(theoryCert.issuedAt)}
                code={theoryCert.code}
              />
            </div>
            <button type="button" className="btn btn-secondary btn-block" style={{ marginTop: 10 }}
              onClick={() => downloadPdf(theoryCert)}>
              <Download size={16} /> ดาวน์โหลด PDF
            </button>
          </>
        )}
      </div>

      {/* Practical */}
      <div className="card" style={{ marginTop: 16, borderTop: `4px solid ${CERT_KINDS.practical.accent}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Award size={22} color={CERT_KINDS.practical.accent} />
          <div style={{ flex: 1 }}>
            <div className="text-body-strong">ใบประกาศภาคปฏิบัติ</div>
            <div className="text-caption">ครูผู้สอนจะอนุมัติให้หลังเรียนปฏิบัติเสร็จ</div>
          </div>
          {practicalCert ? <span className="badge badge-success">ได้รับแล้ว</span> :
            <span className="badge badge-muted">รออนุมัติ</span>}
        </div>
        {!practicalCert && (
          <div className="text-caption" style={{ marginTop: 8 }}>{practicalEval.reason || 'มาเช็คชื่อภาคปฏิบัติแล้วรอครูอนุมัติ'}</div>
        )}
        {practicalCert && (
          <>
            <div style={{ marginTop: 14 }}>
              <CertificatePreview
                kind="practical"
                learnerName={learner?.name || ''}
                dateStr={fmtDate(practicalCert.issuedAt)}
                code={practicalCert.code}
                instructorName={practicalCert.instructorName}
                location={practicalCert.location}
              />
            </div>
            <button type="button" className="btn btn-secondary btn-block" style={{ marginTop: 10 }}
              onClick={() => downloadPdf(practicalCert)}>
              <Download size={16} /> ดาวน์โหลด PDF
            </button>
          </>
        )}
      </div>

      {/* ชวนต่อยอดไปอบรมภาคปฏิบัติ — แสดงเมื่อได้ใบประกาศแล้ว */}
      {(theoryCert || practicalCert) && <CertUpsellCard />}
    </div>
  )
}
