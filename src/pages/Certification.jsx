import { useEffect, useState } from 'react'
import { useEnsureLearner } from '../hooks/useLearner'
import { useLearnerStore } from '../stores/learnerStore'
import { getBestExam, getCertificates } from '../db/database'
import { evaluatePracticalEligibility } from '../courses/firstaid/cert'
import PracticalCertCard from '../components/PracticalCertCard'
import CertUpsellCard from '../components/CertUpsellCard'
import TheoryCertCard from '../components/TheoryCertCard'
import CertGuideVideo from '../components/CertGuideVideo'
import AedRentalCard from '../components/AedRentalCard'
import Seo from '../components/Seo'
import AccountCard from '../components/AccountCard'

export default function Certification() {
  useEnsureLearner()
  const learner = useLearnerStore((s) => s.learner)

  const [postAttempt, setPostAttempt] = useState(null)
  const [certs, setCerts] = useState([])
  const [certsLoaded, setCertsLoaded] = useState(false)

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
      setCertsLoaded(true)
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

  return (
    <div className="page-container">
      <Seo
        title="ใบประกาศปฐมพยาบาล — สอบออนไลน์ฟรี รับใบได้ทันที | Jia Training Center"
        description="เรียนจบ สอบผ่าน รับใบประกาศภาคทฤษฎีปฐมพยาบาลเบื้องต้นฟรี มี QR Code ตรวจสอบได้ พิมพ์/บันทึก PDF ได้ทันที โดย Jia Training Center"
        path="/certificate"
      />
      <div style={{ marginTop: 8 }}>
        <div className="text-caption">ใบประกาศของฉัน</div>
        <div className="text-title">ทฤษฎี + ปฏิบัติ</div>
      </div>

      <AccountCard style={{ marginTop: 12 }} />

      {/* Theory — self-service issuance (name + phone + email + PDPA consent) */}
      <TheoryCertCard postAttempt={postAttempt} onIssued={onTheoryIssued} />

      {/* วิดีโอสอนขั้นตอนรับใบประกาศ — เฉพาะคนที่ยังไม่มีใบภาคทฤษฎี (ไม่แสดงในหน้าสอบ) */}
      {certsLoaded && !theoryCert && <CertGuideVideo />}
      <AedRentalCard source="certificate_page" />

      {/* Practical — the Hub's certificate, reported by this app after the practical day */}
      <PracticalCertCard ownCert={practicalCert} reason={practicalEval.reason} />

      {/* ชวนต่อยอดไปอบรมภาคปฏิบัติ — แสดงเมื่อได้ใบประกาศแล้ว */}
      {(theoryCert || practicalCert) && <CertUpsellCard source="cert_page" />}
    </div>
  )
}
