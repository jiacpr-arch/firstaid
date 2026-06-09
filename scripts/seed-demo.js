#!/usr/bin/env node
// Seed instructor account + sample cohort for demo / local dev.
//
// Usage:
//   VITE_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   INSTRUCTOR_EMAIL=demo@firstaid.local INSTRUCTOR_PASSWORD=demo1234 \
//   node scripts/seed-demo.js
//
// Idempotent: re-runs upsert by email/code. Safe to run multiple times.

import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.env.INSTRUCTOR_EMAIL || 'demo@firstaid.local'
const password = process.env.INSTRUCTOR_PASSWORD || 'demo1234'
const cohortName = process.env.COHORT_NAME || 'รุ่นทดลอง 2026'
const cohortCode = process.env.COHORT_CODE || 'DEMO2026'

if (!url || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

async function getOrCreateInstructor() {
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 200 })
  if (listErr) throw listErr
  const existing = list.users.find((u) => u.email === email)
  if (existing) {
    console.log(`✓ Instructor exists: ${email} (${existing.id})`)
    return existing
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'instructor', display_name: 'Demo Instructor' },
  })
  if (error) throw error
  console.log(`+ Created instructor: ${email} (${data.user.id})`)
  return data.user
}

async function upsertCohort(instructorId) {
  const { data: existing } = await supabase
    .from('cohorts')
    .select('id, name, code')
    .eq('code', cohortCode)
    .maybeSingle()

  if (existing) {
    console.log(`✓ Cohort exists: ${cohortCode} (${existing.id})`)
    return existing
  }
  const { data, error } = await supabase
    .from('cohorts')
    .insert({ instructor_id: instructorId, name: cohortName, code: cohortCode })
    .select()
    .single()
  if (error) throw error
  console.log(`+ Created cohort: ${cohortName} [${cohortCode}] (${data.id})`)
  return data
}

async function seedSampleEnrollments(cohortId) {
  const samples = [
    { name: 'สมชาย ใจดี', phone: '0801111111' },
    { name: 'สมหญิง พึ่งตัวเอง', phone: '0802222222' },
    { name: 'อนันต์ สามารถ', phone: '0803333333' },
  ]
  for (const s of samples) {
    const learnerId = crypto.randomUUID()
    const { error } = await supabase
      .from('enrollments')
      .upsert(
        { cohort_id: cohortId, learner_id: learnerId, ...s },
        { onConflict: 'cohort_id,learner_id', ignoreDuplicates: true },
      )
    if (error && !error.message.includes('duplicate')) throw error
  }
  console.log(`+ Seeded ${samples.length} sample enrollments (idempotent skip if re-run)`)
}

async function main() {
  console.log('Seeding demo data...\n')
  const instructor = await getOrCreateInstructor()
  const cohort = await upsertCohort(instructor.id)
  await seedSampleEnrollments(cohort.id)
  console.log('\n✓ Done.')
  console.log('\nLogin at /admin with:')
  console.log(`  email:    ${email}`)
  console.log(`  password: ${password}`)
  console.log(`  cohort:   ${cohortName} (code: ${cohortCode})`)
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
