import { generateCode, generateInstructorCode } from './instructorAuth.js'

// คลาส (แบบ ACLS) = cohort + รอบอบรมภาคปฏิบัติ 1 รอบ สร้างพร้อมกัน ได้ 2 รหัส:
//   รหัสคลาส (6 ตัว, cohorts.code)  — แจกนักเรียน ใช้ที่ /join/:code
//   รหัสผู้ช่วย (8 ตัว)             — เก็บทั้งที่ cohorts.instructor_code และ practical_sessions.instructor_code
//                                     ผู้ช่วยใช้รหัสนี้สแกน/เช็คชื่อ/ให้คะแนนผ่าน /scan/:id (ไม่ต้องล็อกอิน)
// ไม่ผูกกับบัญชีผู้ใช้ (instructor_id เป็น null) แถวพวกนี้เห็นได้เฉพาะ service role
// สร้างได้เฉพาะแอดมิน (api/classes/create.js)

const UNIQUE_VIOLATION = '23505'
const ATTEMPTS = 5

async function insertWithUniqueCode(admin, table, makeRow, select) {
  for (let i = 0; i < ATTEMPTS; i += 1) {
    const { data, error } = await admin.from(table).insert(makeRow()).select(select).single()
    if (!error) return data
    if (error.code !== UNIQUE_VIOLATION) throw error
  }
  throw new Error(`could not generate a unique code for ${table}`)
}

export async function createClass(admin, { name, location = null, now = new Date() }) {
  const instructorCode = generateInstructorCode()

  const cohort = await insertWithUniqueCode(admin, 'cohorts', () => ({
    name,
    code: generateCode(6),
    instructor_id: null,
    instructor_code: instructorCode,
    created_via: 'app',
  }), 'id, name, code')

  let session
  try {
    session = await insertWithUniqueCode(admin, 'practical_sessions', () => ({
      cohort_id: cohort.id,
      instructor_id: null,
      title: name,
      location,
      qr_token: generateCode(6),
      kind: 'session',
      starts_at: now.toISOString(),
      instructor_code: instructorCode,
    }), 'id')
  } catch (err) {
    // ไม่ทิ้งคลาสครึ่งเดียวไว้ (มี cohort แต่ไม่มีรอบ)
    await admin.from('cohorts').delete().eq('id', cohort.id)
    throw err
  }

  return {
    classId: cohort.id,
    sessionId: session.id,
    className: cohort.name,
    classCode: cohort.code,
    instructorCode,
  }
}

// ปิดคลาส: รหัสผู้สอนและ session ใช้ไม่ได้ต่อ (cohorts.deleted_at + practical_sessions.closed_at)
// ไม่ลบข้อมูลใด ๆ — แอดมินยังเห็นคลาสนี้ได้
export async function closeClass(admin, cohortId, now = new Date()) {
  const at = now.toISOString()
  const { error: cErr } = await admin.from('cohorts').update({ deleted_at: at }).eq('id', cohortId)
  if (cErr) throw cErr
  const { error: sErr } = await admin.from('practical_sessions').update({ closed_at: at }).eq('cohort_id', cohortId)
  if (sErr) throw sErr
}

// รายการคลาสทั้งหมดสำหรับแอดมิน (รวมที่ผู้สอนสร้างจากแอป ซึ่ง RLS ซ่อนจาก client) พร้อมจำนวนนักเรียน
// และรหัสผู้สอน (แอดมินใช้กู้คืนรหัสที่ผู้สอนทำหาย) ใหม่สุดก่อน
export function buildClassList({ cohorts = [], enrollments = [], sessions = [] }) {
  const counts = new Map()
  for (const e of enrollments) counts.set(e.cohort_id, (counts.get(e.cohort_id) || 0) + 1)
  const firstSession = new Map()
  for (const s of [...sessions].sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)))) {
    if (!firstSession.has(s.cohort_id)) firstSession.set(s.cohort_id, s.id)
  }
  return [...cohorts]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      instructorCode: c.instructor_code || null,
      createdVia: c.created_via || 'admin',
      createdAt: c.created_at,
      closed: !!c.deleted_at,
      students: counts.get(c.id) || 0,
      sessionId: firstSession.get(c.id) || null,
    }))
}
