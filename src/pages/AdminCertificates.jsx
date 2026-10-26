import { Link } from 'react-router-dom'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { HUB_URL } from '../utils/hubCertificate'

// ใบประกาศทั้งสองแบบออกจากระบบกลาง JIA — ค้นหา แก้ชื่อ เพิกถอน ทำที่หน้าเจ้าหน้าที่ของระบบกลาง
export default function AdminCertificates() {
  return (
    <div className="page-container">
      <Link to="/admin" className="btn btn-ghost" style={{ paddingLeft: 0 }}>
        <ArrowLeft size={16} /> หน้าควบคุม
      </Link>
      <div style={{ marginTop: 4 }}>
        <div className="text-caption">จัดการ</div>
        <div className="text-title">ใบประกาศ</div>
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <div className="text-body">
          ใบประกาศทั้งภาคทฤษฎี (ออนไลน์) และภาคปฏิบัติ ออกจาก<b>ระบบกลาง JIA</b> (class.jiacpr.com)
        </div>
        <ul className="text-body" style={{ margin: '8px 0 0', paddingLeft: 20, lineHeight: 1.7 }}>
          <li>ภาคทฤษฎี: ออกอัตโนมัติเมื่อผู้เรียนเข้าสู่ระบบและผ่าน Post-test ≥ 80%</li>
          <li>
            ภาคปฏิบัติ: ออกอัตโนมัติเมื่อสอบสถานีผ่านใน{' '}
            <Link to="/admin/teach" style={{ color: 'var(--color-brand)' }}>คลาสของฉัน</Link> — ดูว่าใครได้ใบแล้วที่แท็บ "ใบประกาศ"
          </li>
        </ul>
        <a className="btn btn-primary btn-block" style={{ marginTop: 12, textDecoration: 'none' }}
          href={`${HUB_URL}/operations/certificates`} target="_blank" rel="noreferrer">
          <ExternalLink size={16} /> ค้นหา / แก้ชื่อ / เพิกถอน ที่ระบบกลาง
        </a>
        <div className="text-caption" style={{ marginTop: 6 }}>
          เข้าด้วยบัญชีเจ้าหน้าที่ของระบบกลาง · แก้ชื่อและเพิกถอนได้เฉพาะแอดมิน
        </div>
      </div>
    </div>
  )
}
