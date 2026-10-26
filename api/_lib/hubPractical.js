// Sends a passed practical day to the Hub, which issues the learner's central PRACTICAL certificate
// (jia-learning-hub, 20261130100000_practical_person_certificates.sql — jia_results('recordPractical')).
// Like hubResults.js this is a plain service-role RPC on the shared Supabase project.
//
// This app still records its own practical certificate row (issuePractical.js) for the class
// dashboards, LINE alerts and FA- verification; the learner is shown the Hub's certificate instead.
// The Hub needs a real account: a learner who was anonymous on the day is sent once they log in
// (api/certificates/hub-practical.js). Never throws — a Hub that is down or refuses must not block
// check-in, grading or this app's own certificate.
import { HUB_RESULTS_CLIENT, HUB_COURSE_ID } from './hubResults.js'

// The instructor printed on the certificate: the session's instructor_name (set when the class is
// created, editable at /admin/teach), else the instructor account's name, else the training centre.
//
// The Hub's firstaid skills (courses.definition.skills). This app's practical rule — every practice
// station attended and the exam station passed with every ★ item (or an approved check-in for a
// session without stations) — is the instructor's pass for the whole practical course, so a learner
// who meets it is reported as passing every skill.
export const HUB_PRACTICAL_SKILLS = ['scene', 'bleeding', 'choking', 'scenario']
export const PRACTICAL_INSTRUCTOR_FALLBACK = 'Jia Training Center'

export function buildPracticalPayload({ userId, attendanceId, session, instructorName }) {
  const startsAt = session?.starts_at ? new Date(session.starts_at) : null
  const endsAt = session?.ends_at ? new Date(session.ends_at) : null
  const hours = startsAt && endsAt ? Math.round(((endsAt - startsAt) / 3_600_000) * 10) / 10 : null
  return {
    sourceClient: HUB_RESULTS_CLIENT,
    userId,
    courseId: HUB_COURSE_ID,
    attemptRef: `firstaid-practical:${attendanceId}`,
    skills: Object.fromEntries(HUB_PRACTICAL_SKILLS.map((id) => [id, true])),
    instructorName: (instructorName || '').trim().slice(0, 100) || PRACTICAL_INSTRUCTOR_FALLBACK,
    sessionTitle: (session?.title || '').replace(/[<>]/g, '').trim().slice(0, 200),
    trainedAt: (startsAt || new Date()).toISOString(),
    trainingHours: hours > 0 && hours < 100 ? hours : null,
  }
}

// The Hub account behind a learner id: a LINE login (line_identities) — the only binding this app
// can read. null for a learner who never logged in.
export async function hubUserIdForLearner(admin, learnerId) {
  const { data } = await admin
    .from('line_identities')
    .select('auth_user_id')
    .eq('learner_id', learnerId)
    .maybeSingle()
  return data?.auth_user_id || null
}

async function instructorNameFor(admin, instructorId) {
  if (!instructorId || !admin.auth?.admin?.getUserById) return null
  try {
    const { data } = await admin.auth.admin.getUserById(instructorId)
    const meta = data?.user?.user_metadata || {}
    return meta.full_name || meta.name || null
  } catch {
    return null
  }
}

// { recorded, certificate, pending } from the Hub, or { skipped } / { failed }.
export async function recordPracticalAtHub(admin, { learnerId, attendanceId, userId = null }) {
  try {
    const uid = userId || await hubUserIdForLearner(admin, learnerId)
    if (!uid) return { skipped: 'no-account' }
    const { data: att } = await admin
      .from('attendance')
      .select('session_id, status')
      .eq('id', attendanceId)
      .maybeSingle()
    if (!att || att.status !== 'approved') return { skipped: 'no-approved-attendance' }
    const { data: session } = await admin
      .from('practical_sessions')
      .select('title, starts_at, ends_at, instructor_id, instructor_name')
      .eq('id', att.session_id)
      .maybeSingle()
    const payload = buildPracticalPayload({
      userId: uid, attendanceId, session,
      instructorName: session?.instructor_name || await instructorNameFor(admin, session?.instructor_id),
    })
    const { data, error } = await admin.rpc('jia_results', { action: 'recordPractical', payload })
    if (error) throw error
    return { recorded: true, certificate: data?.certificate || null, pending: data?.pending || null }
  } catch (err) {
    console.warn('hub practical result not recorded (non-fatal)', err?.message || err)
    return { failed: err?.message || 'error' }
  }
}
