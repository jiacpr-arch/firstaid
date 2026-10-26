import { Printer, ShieldCheck, Camera } from 'lucide-react'
import { HUB_URL } from '../utils/hubCertificate'

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
}

// The learner's certificate (online theory, or practical when cert.kind is 'practical') as the JIA Hub issued it (class.jiacpr.com): the same certificate every
// JIA course prints, with a QR code to verify it. Opening and printing happen on the Hub, where the
// learner picks portrait or landscape and whether to show their photo.
export default function HubCertificateCard({ cert }) {
  const practical = cert.kind === 'practical'
  return (
    <div data-testid="hub-certificate" style={{
      marginTop: 14, borderRadius: 14, overflow: 'hidden', border: '1px solid #d6bd72',
      background: 'linear-gradient(165deg,#24377a 0%,#1b2a5b 55%,#121d42 100%)', color: '#fff',
    }}>
      <div style={{ padding: '18px 18px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, letterSpacing: 4, color: '#e6cc7a', fontWeight: 700 }}>{practical ? 'CERTIFICATE OF TRAINING' : 'CERTIFICATE OF COMPLETION'}</div>
        <div style={{ fontSize: 24, fontWeight: 700, marginTop: 2 }}>ประกาศนียบัตร</div>
        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 10 }}>มอบให้แก่</div>
        <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.3 }}>{cert.name}</div>
        {cert.nameEn && <div style={{ fontSize: 13, opacity: 0.85 }}>{cert.nameEn}</div>}
        <div style={{ fontSize: 12.5, marginTop: 8, opacity: 0.9 }}>ปฐมพยาบาลเบื้องต้น — {practical ? 'ภาคปฏิบัติ' : 'ภาคทฤษฎี (ออนไลน์)'}</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginTop: 12, fontSize: 12 }}>
          <div><div style={{ fontSize: 10, letterSpacing: 1.5, color: '#e6cc7a' }}>เลขที่</div><div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{cert.number}</div></div>
          {cert.expiresAt && <div><div style={{ fontSize: 10, letterSpacing: 1.5, color: '#e6cc7a' }}>หมดอายุ</div><div style={{ fontWeight: 700 }}>{fmtDate(cert.expiresAt)}</div></div>}
        </div>
      </div>
      <div style={{ background: '#fbf8f0', padding: 12, color: '#1b2a5b' }}>
        <a className="btn btn-primary btn-block" style={{ textDecoration: 'none' }}
          href={HUB_URL + '/portal/certificates'} target="_blank" rel="noreferrer">
          <Printer size={16} /> เปิด / พิมพ์ / บันทึก PDF ↗
        </a>
        <div className="text-caption" style={{ marginTop: 6, textAlign: 'center' }}>
          เลือกได้ทั้งแนวตั้งและแนวนอน · สแกน QR บนใบเพื่อตรวจสอบได้ทุกที่
        </div>
        <div className="text-caption" style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', gap: 8, fontWeight: 700 }}>
          <a href={HUB_URL + cert.verifyPath} target="_blank" rel="noreferrer"><ShieldCheck size={13} /> ตรวจสอบใบ ↗</a>
          <a href={HUB_URL + '/account'} target="_blank" rel="noreferrer"><Camera size={13} /> ใส่รูปบนใบประกาศ ↗</a>
        </div>
      </div>
    </div>
  )
}
