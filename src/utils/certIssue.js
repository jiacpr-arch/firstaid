import { saveCertificate } from '../db/database'
import { generateCertCode } from '../courses/firstaid/cert'

// Issues the theory certificate, preferring the server (Supabase-backed, gives a
// verifiable code + one-per-learner guarantee) and falling back to a purely local
// certificate when the backend isn't configured or is unreachable. Either way the
// result is persisted to Dexie so it survives reloads and works offline.
export async function issueTheoryCertificate({ learner, attempt, phone, email }) {
  const learnerName = (learner?.name || '').trim()
  const localId = `theory-${learner.id}`

  try {
    const res = await fetch('/api/certificates/issue-theory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        learnerId: learner.id,
        learnerName,
        learnerPhone: phone,
        learnerEmail: email,
        consent: true,
        score: attempt?.score,
        passed: attempt?.passed,
      }),
    })
    if (res.ok) {
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
  } catch {
    // Network error / backend offline — fall through to local issuance.
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
