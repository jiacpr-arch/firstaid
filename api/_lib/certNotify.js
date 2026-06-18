// Real-time LINE notification when a new certificate is issued, so the
// instructor knows immediately that someone finished — no need to poll the DB.

import { notifyLine } from './lineNotify.js'

// Start of "today" in Asia/Bangkok (UTC+7), as a UTC ISO string. Lets the daily
// tally follow the owner's local day instead of UTC midnight (which is 07:00 BKK).
export function bangkokTodayStartISO(now = new Date()) {
  const bkk = new Date(now.getTime() + 7 * 3600 * 1000)
  const startUtcMs = Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), bkk.getUTCDate()) - 7 * 3600 * 1000
  return new Date(startUtcMs).toISOString()
}

// Builds the LINE message body. Pure function (no env / network) so it's testable.
export function buildCertMessage({ kind, learnerName, learnerPhone, score, location, todayCount }) {
  const lines = []
  if (kind === 'practical') {
    lines.push('🏅 ออกใบประกาศภาคปฏิบัติแล้ว')
    lines.push(`👤 ${learnerName || '-'}`)
    if (location) lines.push(`📍 ${location}`)
  } else {
    lines.push('🎓 มีผู้เรียนจบใหม่! (ภาคทฤษฎี)')
    lines.push(`👤 ${learnerName || '-'}`)
    if (learnerPhone) lines.push(`📞 ${learnerPhone}`)
    lines.push(typeof score === 'number' ? `✅ post-test: ${score}%` : '✅ ผ่าน post-test')
  }
  if (typeof todayCount === 'number') lines.push(`📅 วันนี้รวม ${todayCount} คน`)
  return lines.join('\n')
}

async function countTodayByKind(admin, kind) {
  try {
    const { count } = await admin
      .from('certificates')
      .select('id', { count: 'exact', head: true })
      .eq('kind', kind)
      .gte('issued_at', bangkokTodayStartISO())
    return typeof count === 'number' ? count : undefined
  } catch {
    return undefined
  }
}

// Fire-and-forget: looks up today's running total then pushes to LINE. Never
// throws — a failed notification must not block the learner getting their cert.
export async function notifyCertIssued(admin, { kind, learnerName, learnerPhone, score, location }) {
  const todayCount = await countTodayByKind(admin, kind)
  const text = buildCertMessage({ kind, learnerName, learnerPhone, score, location, todayCount })
  return notifyLine(text)
}
