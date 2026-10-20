import { useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { useClassStore } from '../stores/classStore'
import AdminLearnerDetail from './AdminLearnerDetail'

// รายละเอียดนักเรียนในหน้าผู้สอน (/teach/learners/:learnerId) — ใช้หน้าเดียวกับฝั่งแอดมิน
// แต่เรียก API ด้วยรหัสผู้สอนของคลาสที่เปิดอยู่ และกลับไปหน้า /teach
export default function TeachLearner() {
  const classId = useClassStore((s) => s.classId)
  const instructorCode = useClassStore((s) => s.instructorCode)
  const teach = useMemo(() => ({ cohortId: classId, instructorCode }), [classId, instructorCode])
  if (!classId) return <Navigate to="/teach" replace />
  return <AdminLearnerDetail teach={teach} />
}
