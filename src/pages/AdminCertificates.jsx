import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

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
          ใบประกาศภาคทฤษฎีออกอัตโนมัติเมื่อผู้เรียนผ่าน post-test ≥ 80%
        </div>
        <div className="text-body" style={{ marginTop: 8 }}>
          ใบประกาศภาคปฏิบัติออกอัตโนมัติเมื่อครูผู้สอนกด "อนุมัติ" ใน{' '}
          <Link to="/admin/sessions" style={{ color: 'var(--color-brand)' }}>หน้าคลาสภาคปฏิบัติ</Link>
        </div>
        <div className="text-caption" style={{ marginTop: 8 }}>
          (หน้าค้นหา/เพิกถอน — เพิ่มในเฟสถัดไป)
        </div>
      </div>
    </div>
  )
}
