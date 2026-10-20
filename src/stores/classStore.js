import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// คลาสที่ผู้สอนเปิดอยู่บนเครื่องนี้ (แบบ ACLS: ไม่มีบัญชี — สิทธิ์ผู้สอนมาจาก "รหัสผู้สอน" ที่เครื่องถืออยู่)
// เก็บใน localStorage; กรอกรหัสผู้สอนบนเครื่องอื่นเพื่อเชื่อมคลาสเดิมได้ (api/classes/verify.js)
export const useClassStore = create(
  persist(
    (set) => ({
      classId: null, // cohorts.id
      sessionId: null, // practical_sessions.id ของคลาสนี้
      className: '',
      classCode: '', // รหัสให้นักเรียนเข้าร่วม
      instructorCode: '', // รหัสลับของผู้สอน
      setClass: (c) => set({
        classId: c.classId,
        sessionId: c.sessionId || null,
        className: c.className || '',
        classCode: c.classCode || '',
        instructorCode: c.instructorCode || '',
      }),
      setInstructorCode: (instructorCode) => set({ instructorCode }),
      clearClass: () => set({ classId: null, sessionId: null, className: '', classCode: '', instructorCode: '' }),
    }),
    { name: 'firstaid.class' },
  ),
)
