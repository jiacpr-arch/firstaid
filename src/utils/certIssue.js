import { saveCertificate } from '../db/database'
import { generateCertCode } from '../courses/firstaid/cert'
import { authHeader } from './authHeader'

// Issues the theory certificate, preferring the server (Supabase-backed, gives a
// verifiable code + one-per-learner guarantee) and falling back to a purely local
// certificate when the backend isn't configured or is unreachable. Either way the
// result is persisted to Dexie so it survives reloads and works offline.
//
// The server re-scores the post-test from the raw answers (it never trusts a
// client-supplied score), so we send `answers` rather than score/passed.
export async function issueTheoryCertificate({ learner, attempt, phone, email }) {
  const learnerName = (learner?.name || '').trim()
  const localId = `theory-${learner.id}`

  let res = null
  try {
    res = await fetch('/api/certificates/issue-theory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify({
        learnerId: learner.id,
        learnerName,
        learnerPhone: phone,
        learnerEmail: email,
        consent: true,
        answers: attempt?.answers,
      }),
    })
  } catch {
    // Network error / backend offline — fall through to local issuance.
  }

  if (res?.ok) {
    const { certificate } = await res.json()
    const cert = {
      id: localId,
      learnerId: learner.id,
      kind: 'theory',
      code: certificate.code,
      issuedAt: certificate.issued_at,
      learnerName: certificate.learner_name || learnerName,
      learnerPhone: certificate.learner_phone || phone,
      learnerEmail: certificate.learner_email || email,
      synced: true,
    }
    await saveCertificate(cert)
    return { cert, synced: true }
  }

  // The server understood the request and said no (post-test not passed,
  // learnerId mismatch, …) — honor the rejection instead of minting a local
  // certificate that verification would then 404 on. 5xx still falls through
  // to the local fallback, same as being unreachable.
  if (res && res.status >= 400 && res.status < 500) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Certificate rejected (${res.status})`)
  }

  // Local fallback: still give the learner a certificate they can keep & download.
  const cert = {
    id: localId,
    learnerId: learner.id,
    kind: 'theory',
    code: generateCertCode(),
    issuedAt: new Date().toISOString(),
    learnerName,
    learnerPhone: phone,
    learnerEmail: email,
    synced: false,
  }
  await saveCertificate(cert)
  return { cert, synced: false }
}
