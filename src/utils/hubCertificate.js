import { supabase } from '../config/supabaseClient'

// The JIA Hub's central online certificate (class.jiacpr.com, learning_hub.person_certificates) is
// the certificate learners see and print. firstaid shares the Hub's Supabase project, so these are
// plain RPCs with the learner's own session. This app still records its own theory certificate
// (api/certificates/issue-theory.js) for the practical certificate, LINE follow-up and /verify of
// FA- codes; the learner just isn't shown it unless the Hub can't give them one.
export const HUB_URL = 'https://class.jiacpr.com'
export const HUB_COURSE_ID = 'firstaid'

async function rpc(fn, action, payload = {}) {
  const { data, error } = await supabase.rpc(fn, { action, payload })
  if (error) throw new Error(error.message || 'ระบบกลางไม่ตอบกลับ')
  return data
}

// { signedIn, cert, claimable, profile } — signedIn:false when there is no Supabase or no session;
// null when the Hub couldn't be reached (callers fall back to this app's own certificate). Never throws.
export async function fetchHubState() {
  try {
    if (!supabase) return { signedIn: false }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return { signedIn: false }
    const [mine, profile] = await Promise.all([
      rpc('jia_person_certificates', 'mine'),
      rpc('jia_identity', 'me').catch(() => null),
    ])
    return {
      signedIn: true,
      cert: (mine?.certificates || []).find((c) => c.courseId === HUB_COURSE_ID && c.status === 'issued') || null,
      claimable: (mine?.claimable || []).some((c) => c.courseId === HUB_COURSE_ID),
      profile,
    }
  } catch {
    return null
  }
}

// Puts the name typed for the certificate on the learner's JIA student card, which is where the
// Hub takes the certificate name from. A name an instructor already verified is never touched.
export async function saveCardName(profile, { name, phone }) {
  if (!profile || profile.nameLocked) return
  if ((profile.nameTh || '').trim() === name && (profile.phone || '') === phone) return
  await rpc('jia_identity', 'saveProfile', { nameTh: name, nameEn: profile.nameEn || '', phone, pdpaConsent: true })
}

export function claimHubCertificate() {
  return rpc('jia_person_certificates', 'claim', { courseId: HUB_COURSE_ID })
}
