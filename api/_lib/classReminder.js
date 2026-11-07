// เตือนนักเรียนในคลาสที่ยังเรียนออนไลน์ไม่ครบ (ยังไม่ "พร้อม" ตาม readiness.js) ทาง LINE
//
// 2 ทาง:
//   kind 'manual' — ผู้สอน/แอดมินกดปุ่มในแท็บภาพรวม (api/classes/remind.js) กันกดซ้ำด้วย cooldown 12 ชม.
//   kind 'd3'/'d1' — cron รายวัน (api/nurture/run.js) ส่งเองเมื่อเหลือ 3 วัน / 1 วันก่อนวันเรียน (cohorts.starts_on)
//                     ส่งครั้งเดียวต่อคนต่อคลาสต่อ kind
// ส่งได้เฉพาะคนที่เคยล็อกอิน LINE (line_identities) และไม่ได้พิมพ์ "หยุด" (nurture_opted_out) —
// คนไม่มี LINE ส่งรายชื่อ+เบอร์กลับไปให้ผู้สอนโทรเอง ประวัติการส่งอยู่ที่ class_reminder_log
// (supabase/class-reminders.sql) ถ้ายังไม่มีตารางนี้ จะไม่ส่งอะไรเลย (fail closed กันส่งซ้ำทุกวัน)
import { classifyReadiness } from './readiness.js'
import { loadCohortSummary } from './cohortSummaryLoader.js'
import { pushLineMessage } from './lineMessage.js'
import { TOTAL_LESSONS } from '../../src/courses/firstaid/lessons.js'

export const MANUAL_COOLDOWN_HOURS = 12
export const SCHEDULED_KINDS = { 3: 'd3', 1: 'd1' }
const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000
const BKK_OFFSET_MS = 7 * HOUR_MS
const APP_URL = process.env.VITE_PUBLIC_BASE_URL || 'https://firstaid.morroo.com'
const FOOTER = '\n\n— พิมพ์ "หยุด" หากไม่ต้องการรับข้อความแบบนี้'
const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

// วันที่ปัจจุบันตามเวลาไทย เป็น 'YYYY-MM-DD'
export function bangkokToday(now = new Date()) {
  return new Date(now.getTime() + BKK_OFFSET_MS).toISOString().slice(0, 10)
}

export function addDays(isoDate, days) {
  return new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

// อีกกี่วันถึงวันเรียน (นับตามวันที่ไทย): 0 = วันนี้, ติดลบ = ผ่านไปแล้ว, null = ไม่ได้ระบุวัน
export function daysUntil(startsOn, now = new Date()) {
  if (!startsOn || !/^\d{4}-\d{2}-\d{2}$/.test(startsOn)) return null
  return Math.round((Date.parse(`${startsOn}T00:00:00Z`) - Date.parse(`${bangkokToday(now)}T00:00:00Z`)) / DAY_MS)
}

export function thaiDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number)
  return `${d} ${THAI_MONTHS[m - 1]} ${y + 543}`
}

function whenLine(cohort, days) {
  const name = cohort.name ? `"${cohort.name}"` : 'ภาคปฏิบัติ'
  if (days == null || days < 0) return `ก่อนเข้าอบรม ${name}`
  const date = thaiDate(cohort.startsOn)
  if (days === 0) return `วันนี้ (${date}) มีอบรม ${name}`
  if (days === 1) return `พรุ่งนี้ (${date}) มีอบรม ${name}`
  return `อีก ${days} วัน (${date}) จะถึงวันอบรม ${name}`
}

export function reminderMessage({ learner, cohort, missing, days, appUrl = APP_URL }) {
  const hello = learner.name ? `สวัสดีค่ะ คุณ${learner.name} 👋` : 'สวัสดีค่ะ 👋'
  const needsFirstAid = learner.postTest?.passed !== true
  const needsCpr = cohort.includesCpr && learner.cpr?.completed !== true
  const lines = [
    hello,
    `${whenLine(cohort, days)} — ยังต้องเรียนออนไลน์ให้ครบก่อนนะคะ`,
    '',
    'ที่ยังขาดอยู่:',
    ...missing.map((m) => `• ${m}`),
  ]
  if (needsFirstAid) lines.push('', `📚 เรียนปฐมพยาบาลต่อ 👉 ${appUrl}/learn`)
  if (needsCpr) {
    // คอร์ส CPR ของคลาสรวมอยู่ในเว็บนี้แล้ว (/cpr) — เปิดหลังทำ Post-test ปฐมพยาบาลผ่าน
    lines.push('', `❤️ เรียน CPR & AED ออนไลน์ (ต่อจากปฐมพยาบาล) 👉 ${appUrl}/cpr`)
  }
  return lines.join('\n') + FOOTER
}

// learner_id -> { lineUserId, optedOut } — คนเดียวมีหลายแถวได้ ถ้าแถวไหน opt-out ไว้ถือว่า opt-out
export function indexIdentities(rows = []) {
  const map = new Map()
  for (const r of rows) {
    if (!r.learner_id || !r.line_user_id) continue
    const prev = map.get(r.learner_id)
    const optedOut = r.nurture_opted_out === true || prev?.optedOut === true
    map.set(r.learner_id, { lineUserId: prev?.lineUserId || r.line_user_id, optedOut })
  }
  return map
}

// เลือกว่าจะส่งถึงใคร — pure เพื่อเทสได้โดยไม่ต้องมี DB
export function planClassReminders({ summary, identities = [], logs = [], kind = 'manual', now = new Date() }) {
  const cohort = summary.cohort
  const opts = { totalLessons: TOTAL_LESSONS, requireCpr: !!cohort.includesCpr }
  const days = daysUntil(cohort.startsOn, now)
  const ids = indexIdentities(identities)
  const cooldownSince = now.getTime() - MANUAL_COOLDOWN_HOURS * HOUR_MS
  const blocked = (learnerId) => logs.some((l) => l.learner_id === learnerId && (
    kind === 'manual' ? Date.parse(l.sent_at) >= cooldownSince : l.kind === kind
  ))

  const out = { toSend: [], noLine: [], optedOut: [], recentlySent: [], ready: 0 }
  for (const learner of summary.learners || []) {
    const { status, missing } = classifyReadiness(learner, opts)
    if (status === 'ready') { out.ready += 1; continue }
    const person = { learnerId: learner.learnerId, name: learner.name || learner.lineName || null, phone: learner.phone || null }
    const id = ids.get(learner.learnerId)
    if (!id) { out.noLine.push(person); continue }
    if (id.optedOut) { out.optedOut.push(person); continue }
    if (blocked(learner.learnerId)) { out.recentlySent.push(person); continue }
    out.toSend.push({ ...person, lineUserId: id.lineUserId, text: reminderMessage({ learner, cohort, missing, days }) })
  }
  return out
}

async function selectByLearners(admin, table, columns, learnerIds, extra = (q) => q) {
  const rows = []
  for (let i = 0; i < learnerIds.length; i += 100) {
    const { data, error } = await extra(admin.from(table).select(columns).in('learner_id', learnerIds.slice(i, i + 100)))
    if (error) throw error
    rows.push(...(data || []))
  }
  return rows
}

// โหลดคลาส → วางแผน → (ถ้าไม่ใช่ dryRun) ส่ง + บันทึก log
// คืน null ถ้าไม่เจอคลาส; โยน error ถ้า DB พัง (รวมถึงยังไม่มีตาราง class_reminder_log)
export async function sendClassReminders(admin, cohortId, {
  kind = 'manual', dryRun = false, now = new Date(), push = pushLineMessage,
} = {}) {
  const summary = await loadCohortSummary(admin, cohortId)
  if (!summary) return null
  const learnerIds = [...new Set((summary.learners || []).map((l) => l.learnerId).filter(Boolean))]

  const [identities, logs] = learnerIds.length
    ? await Promise.all([
      selectByLearners(admin, 'line_identities', 'line_user_id, learner_id, nurture_opted_out', learnerIds),
      selectByLearners(admin, 'class_reminder_log', 'learner_id, kind, sent_at', learnerIds, (q) => q.eq('cohort_id', cohortId)),
    ])
    : [[], []]

  const plan = planClassReminders({ summary, identities, logs, kind, now })
  const result = {
    cohort: { id: summary.cohort.id, name: summary.cohort.name, startsOn: summary.cohort.startsOn },
    daysUntilClass: daysUntil(summary.cohort.startsOn, now),
    total: (summary.learners || []).length,
    ready: plan.ready,
    candidates: plan.toSend.length,
    noLine: plan.noLine,
    optedOut: plan.optedOut.length,
    recentlySent: plan.recentlySent.length,
    sample: plan.toSend[0]?.text || null,
    sent: 0,
    failed: 0,
    dryRun,
  }
  if (dryRun) return result

  for (const item of plan.toSend) {
    const r = await push(item.lineUserId, item.text)
    if (!r.ok) { result.failed += 1; continue }
    result.sent += 1
    const { error } = await admin.from('class_reminder_log').insert({
      cohort_id: cohortId, learner_id: item.learnerId, line_user_id: item.lineUserId, kind, sent_at: now.toISOString(),
    })
    if (error) console.error('class reminder: log insert failed', error)
  }
  return result
}

// cron: คลาสที่ยังไม่ปิดและเหลือ 3 หรือ 1 วันก่อนวันเรียน
export async function runScheduledClassReminders(admin, { now = new Date(), push = pushLineMessage } = {}) {
  const today = bangkokToday(now)
  const targets = Object.keys(SCHEDULED_KINDS).map((d) => addDays(today, Number(d)))
  const { data: cohorts, error } = await admin
    .from('cohorts')
    .select('id, starts_on, deleted_at')
    .in('starts_on', targets)
  if (error) throw error

  const results = []
  for (const c of cohorts || []) {
    if (c.deleted_at) continue
    const kind = SCHEDULED_KINDS[daysUntil(c.starts_on, now)]
    if (!kind) continue
    try {
      const r = await sendClassReminders(admin, c.id, { kind, now, push })
      if (r) results.push({ cohortId: c.id, kind, sent: r.sent, failed: r.failed, candidates: r.candidates })
    } catch (err) {
      console.error('class reminder: cohort failed', c.id, err)
      results.push({ cohortId: c.id, kind, error: err.message || String(err) })
    }
  }
  return results
}
