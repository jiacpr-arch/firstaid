import { useEffect, useState } from 'react'
import { Award, Download } from 'lucide-react'
import { useEnsureLearner } from '../hooks/useLearner'
import { useLearnerStore } from '../stores/learnerStore'
import { getBestExam, getCertificates } from '../db/database'
import { CERT_KINDS, evaluatePracticalEligibility } from '../courses/firstaid/cert'
import CertificatePreview from '../components/CertificatePreview'
import CertUpsellCard from '../components/CertUpsellCard'
import TheoryCertCard from '../components/TheoryCertCard'
import { downloadCertPdf } from '../utils/certPdf'

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function Certification() {
  useEnsureLearner()
  const learner = useLearnerStore((s) => s.learner)

  const [postAttempt, setPostAttempt] = useState(null)
  const [certs, setCerts] = useState([])

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

  const theoryCert = certs.find((c) => c.kind === 'theory')
  const practicalCert = certs.find((c) => c.kind === 'practical')

  const practicalEval = evaluatePracticalEligibility({
    hasTheory: !!theoryCert,
    approvedAttendance: practicalCert?.fromApproval || false,
  })

  const onTheoryIssued = (cert) => {
    setCerts((c) => [...c.filter((x) => x.kind !== 'theory'), cert])
  }

  const downloadPdf = (cert) => {
    downloadCertPdf({
      kind: cert.kind,
      learnerName: cert.learnerName || learner?.name || '',
      dateStr: fmtDate(cert.issuedAt),
      code: cert.code,
      instructorName: cert.instructorName,
      location: cert.location,
    }).catch((err) => {
      console.error('download cert pdf failed', err)
      alert('สร้าง PDF ไม่สำเร็จ กรุณาลองใหม่')
    })
  }

  return (
    <div className="page-container">
      <div style={{ marginTop: 8 }}>
        <div className="text-caption">ใบประกาศของฉัน</div>
        <div className="text-title">ทฤษฎี + ปฏิบัติ</div>
      </div>

      {/* Theory — self-service issuance (name + phone + email + PDPA consent) */}
      <TheoryCertCard postAttempt={postAttempt} onIssued={onTheoryIssued} />

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
                learnerName={practicalCert.learnerName || learner?.name || ''}
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
      {(theoryCert || practicalCert) && <CertUpsellCard source="cert_page" />}
    </div>
  )
}
