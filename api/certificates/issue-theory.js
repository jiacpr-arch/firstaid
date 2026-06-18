import { randomUUID } from 'node:crypto'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { generateCertCode } from '../_lib/certCode.js'
import { notifyAdminLine } from '../_lib/lineNotify.js'

const PASSING = 80

export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  const {
    learnerId,
    learnerName,
    learnerPhone,
    learnerEmail,
    consent,
    score,
    passed,
  } = req.body || {}
  // Contact details + PDPA consent are required for self-service issuance.
  if (!learnerId || !learnerName || !learnerPhone || !learnerEmail) {
    res.status(400).json({ error: 'Missing fields' })
    return
  }
  if (!consent) { res.status(400).json({ error: 'Consent required' }); return }

  // Idempotent: a learner gets exactly one theory certificate. Return the existing
  // one before doing any writes so repeated taps never create duplicates.
  const { data: existing } = await admin
    .from('certificates')
    .select('*')
    .eq('learner_id', learnerId)
    .eq('kind', 'theory')
    .maybeSingle()
  if (existing) { res.status(200).json({ certificate: existing }); return }

  // The post-test is scored on the client; record the passing attempt server-side
  // if it isn't there yet so the certificate is backed by a real attempt row.
  const { data: attempts } = await admin
    .from('exam_attempts')
    .select('score, passed')
    .eq('learner_id', learnerId)
    .eq('kind', 'post')
    .order('score', { ascending: false })
    .limit(1)
  let best = attempts?.[0]
  if (!best && typeof score === 'number' && passed && score >= PASSING) {
    const { data: inserted } = await admin
      .from('exam_attempts')
      .insert({
        uuid: randomUUID(),
        learner_id: learnerId,
        kind: 'post',
        score,
        passed: true,
        finished_at: new Date().toISOString(),
      })
      .select('score, passed')
      .single()
    best = inserted
  }
  if (!best || !best.passed || best.score < PASSING) {
    res.status(409).json({ error: 'Post-test not passed' })
    return
  }

  const cert = {
    learner_id: learnerId,
    kind: 'theory',
    code: generateCertCode(),
    issued_at: new Date().toISOString(),
    learner_name: learnerName,
    learner_phone: learnerPhone,
    learner_email: learnerEmail,
    pdpa_consent_at: new Date().toISOString(),
  }
  const { data, error } = await admin.from('certificates').insert(cert).select().single()
  if (error) {
    // Lost a race with a concurrent issue — return the row that won.
    if (error.code === '23505') {
      const { data: winner } = await admin
        .from('certificates')
        .select('*')
        .eq('learner_id', learnerId)
        .eq('kind', 'theory')
        .maybeSingle()
      if (winner) { res.status(200).json({ certificate: winner }); return }
    }
    res.status(500).json({ error: error.message })
    return
  }

  // A fresh theory cert means a real lead just finished the course — alert the
  // admin on LINE. Awaited (so the push completes before the function freezes)
  // but never allowed to fail issuance: notifyAdminLine swallows its own errors.
  const issuedAt = new Date(data.issued_at).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  await notifyAdminLine(
    [
      '🎓 มีคนรับใบเซอร์ทฤษฎีใหม่!',
      `👤 ${learnerName}`,
      `📞 ${learnerPhone}`,
      `✉️ ${learnerEmail}`,
      `📊 post-test ${best.score}/100`,
      `🔖 รหัส ${data.code}`,
      `🕐 ${issuedAt}`,
    ].join('\n'),
  )

  res.status(200).json({ certificate: data })
}
