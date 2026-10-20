import { generateCode, generateInstructorCode, normalizeCode } from './instructorAuth.js'

// คลาส (แบบ ACLS) = cohort + รอบอบรมภาคปฏิบัติ 1 รอบ สร้างพร้อมกัน ได้ 2 รหัส:
//   รหัสคลาส (6 ตัว, cohorts.code)  — แจกนักเรียน ใช้ที่ /join/:code
//   รหัสผู้สอน (8 ตัว)              — เก็บทั้งที่ cohorts.instructor_code และ practical_sessions.instructor_code
// ไม่ผูกกับบัญชีผู้ใช้ (instructor_id เป็น null) แถวพวกนี้เห็นได้เฉพาะ service role

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

// หาคลาสจากรหัสผู้สอน — คืน { cls } หรือ { status, error }
export async function findClassByInstructorCode(admin, rawCode) {
  const code = normalizeCode(rawCode)
  if (!code) return { status: 400, error: 'กรุณาใส่รหัสผู้สอน' }

  const { data: cohort } = await admin
    .from('cohorts')
    .select('id, name, code, deleted_at')
    .eq('instructor_code', code)
    .maybeSingle()

  if (!cohort) {
    // ใส่รหัสนักเรียนมาแทน — บอกให้ชัด (แบบ ACLS) แทนที่จะตอบว่าผิดเฉย ๆ
    const { data: asStudent } = await admin.from('cohorts').select('id').eq('code', code).maybeSingle()
    if (asStudent) return { status: 403, error: 'นี่คือรหัสสำหรับนักเรียน ไม่ใช่รหัสผู้สอน' }
    return { status: 403, error: 'รหัสผู้สอนไม่ถูกต้อง' }
  }
  if (cohort.deleted_at) return { status: 410, error: 'คลาสนี้ถูกปิดแล้ว' }

  const { data: session } = await admin
    .from('practical_sessions')
    .select('id')
    .eq('cohort_id', cohort.id)
    .order('starts_at')
    .limit(1)
    .maybeSingle()

  return {
    cls: {
      classId: cohort.id,
      sessionId: session?.id || null,
      className: cohort.name,
      classCode: cohort.code,
    },
  }
}
