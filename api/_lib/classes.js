import { generateCode, generateInstructorCode } from './instructorAuth.js'
import { cprCompanyTag } from './cprProgress.js'

// คลาส (แบบ ACLS) = cohort + รอบอบรมภาคปฏิบัติ 1 รอบ สร้างพร้อมกัน ได้ 2 รหัส:
//   รหัสคลาส (6 ตัว, cohorts.code)  — แจกนักเรียน ใช้ที่ /join/:code
//   รหัสผู้ช่วย (8 ตัว)             — เก็บทั้งที่ cohorts.instructor_code และ practical_sessions.instructor_code
//                                     ผู้ช่วยใช้รหัสนี้สแกน/เช็คชื่อ/ให้คะแนนผ่าน /scan/:id (ไม่ต้องล็อกอิน)
// ไม่ผูกกับบัญชีผู้ใช้ (instructor_id เป็น null) แถวพวกนี้เห็นได้เฉพาะ service role
// สร้างได้เฉพาะแอดมิน (api/classes/create.js)
//
// คลาสรวม CPR (includesCpr): สร้างโค้ดกลาง pre-course บน cpr.morroo.com ให้ด้วย — แถวใน
// lead_promo_codes (ตารางของ jia-online ใน Supabase project เดียวกัน) รูปแบบเดียวกับที่หน้าแอดมิน
// ของเว็บนั้นสร้าง "โค้ดกลาง" เอง (src/admin/Admin.jsx) นักเรียนใช้ที่ cpr.morroo.com/?promo=<code>
// แล้ว cohortSummaryLoader อ่านความคืบหน้า CPR กลับมาด้วยเบอร์โทร (cprProgress.js)
// คนในคลาสนี้เปิดทุกบทบน firstaid ได้ด้วย (unlock_lessons) — ค่าคลาสรวมเรียนออนไลน์แล้ว

const UNIQUE_VIOLATION = '23505'
const ATTEMPTS = 5
const CPR_ALL_MODULES = [1, 2, 3, 4, 5, 6, 7]
const DAY_MS = 86_400_000

// โค้ดใช้ได้ถึง 60 วันหลังวันเรียน (เรียนล่วงหน้า + ตามเก็บ) หรือ 90 วันจากวันนี้ถ้าไม่ระบุวัน
// ที่นั่งเผื่อ 5 คน (walk-in / คนกรอกเบอร์อื่น)
export function cprPromoRow({ classCode, className, startsOn = null, seats = null, now = new Date() }) {
  const code = `JIA-FA-${classCode}`
  const base = startsOn ? new Date(`${startsOn}T23:59:59+07:00`) : now
  return {
    code,
    email: '',
    phone: `standing:${code}`,
    name: `คลาส firstaid: ${className}`.slice(0, 120),
    source: 'pre_course',
    company: cprCompanyTag(code),
    unlock_modules: CPR_ALL_MODULES,
    expires_at: new Date(base.getTime() + (startsOn ? 60 : 90) * DAY_MS).toISOString(),
    multi_use: true,
    max_uses: seats ? seats + 5 : null,
  }
}

// ชื่อผู้สอนที่พิมพ์บนใบประกาศภาคปฏิบัติ: ตัดช่องว่างซ้ำ ห้าม < > ยาวไม่เกิน 100 — สั้นกว่า 2 ตัว = ไม่ระบุ (null)
export function cleanInstructorName(value) {
  if (typeof value !== 'string') return null
  const v = value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 100)
  return v.length >= 2 ? v : null
}

async function insertWithUniqueCode(admin, table, makeRow, select) {
  for (let i = 0; i < ATTEMPTS; i += 1) {
    const { data, error } = await admin.from(table).insert(makeRow()).select(select).single()
    if (!error) return data
    if (error.code !== UNIQUE_VIOLATION) throw error
  }
  throw new Error(`could not generate a unique code for ${table}`)
}

export async function createClass(admin, {
  name, location = null, instructorName = null, includesCpr = false, startsOn = null, seats = null, now = new Date(),
}) {
  const instructorCode = generateInstructorCode()

  const cohort = await insertWithUniqueCode(admin, 'cohorts', () => ({
    name,
    code: generateCode(6),
    instructor_id: null,
    instructor_code: instructorCode,
    created_via: 'app',
    ...(includesCpr ? { includes_cpr: true, unlock_lessons: true, starts_on: startsOn } : {}),
  }), 'id, name, code')

  let session
  try {
    session = await insertWithUniqueCode(admin, 'practical_sessions', () => ({
      cohort_id: cohort.id,
      instructor_id: null,
      title: name,
      location,
      instructor_name: cleanInstructorName(instructorName),
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

  let cprPromoCode = null
  if (includesCpr) {
    const promo = cprPromoRow({ classCode: cohort.code, className: cohort.name, startsOn, seats, now })
    const { error: pErr } = await admin.from('lead_promo_codes').insert(promo)
    if (pErr) {
      // คลาส CPR ที่ไม่มีโค้ด CPR ใช้งานไม่ได้ — ย้อนทั้งคลาส
      await admin.from('practical_sessions').delete().eq('id', session.id)
      await admin.from('cohorts').delete().eq('id', cohort.id)
      throw pErr
    }
    const { error: uErr } = await admin.from('cohorts').update({ cpr_promo_code: promo.code }).eq('id', cohort.id)
    if (uErr) throw uErr
    cprPromoCode = promo.code
  }

  return {
    classId: cohort.id,
    sessionId: session.id,
    className: cohort.name,
    classCode: cohort.code,
    instructorCode,
    cprPromoCode,
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
