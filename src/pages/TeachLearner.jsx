import { useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { useClassStore } from '../stores/classStore'
import AdminLearnerDetail from './AdminLearnerDetail'

// รายละเอียดนักเรียนในหน้าผู้สอน (/admin/teach/learners/:learnerId) — ใช้หน้าเดียวกับหน้ารายละเอียด
// ของแอดมิน แต่ปุ่มกลับไปที่หน้าผู้สอนของคลาสที่เปิดอยู่
export default function TeachLearner() {
  const classId = useClassStore((s) => s.classId)
  const teach = useMemo(() => ({ cohortId: classId }), [classId])
  if (!classId) return <Navigate to="/admin/teach" replace />
  return <AdminLearnerDetail teach={teach} />
}
