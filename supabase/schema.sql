-- firstaid schema (Phase 4+5)
-- Run on a fresh Supabase project. Service-role API endpoints under api/*
-- bypass RLS; the anon-key client uses RLS policies defined at the bottom.

create extension if not exists "pgcrypto";

create table if not exists cohorts (
  id          uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  code        text not null unique,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists idx_cohorts_instructor on cohorts(instructor_id);

create table if not exists enrollments (
  cohort_id   uuid not null references cohorts(id) on delete cascade,
  learner_id  uuid not null,
  name        text,
  phone       text,
  joined_at   timestamptz not null default now(),
  primary key (cohort_id, learner_id)
);

create table if not exists lesson_progress (
  id          bigserial primary key,
  learner_id  uuid not null,
  lesson_id   text not null,
  read_at     timestamptz not null,
  unique (learner_id, lesson_id)
);

create table if not exists quiz_attempts (
  id           bigserial primary key,
  uuid         uuid not null unique,
  learner_id   uuid not null,
  lesson_id    text not null,
  score        int  not null,
  correct      int,
  total        int,
  passed       boolean,
  finished_at  timestamptz not null
);

create table if not exists exam_attempts (
  id           bigserial primary key,
  uuid         uuid not null unique,
  learner_id   uuid not null,
  kind         text not null check (kind in ('pre', 'post')),
  score        int  not null,
  correct      int,
  total        int,
  passed       boolean,
  finished_at  timestamptz not null
);

create table if not exists simulation_runs (
  id          bigserial primary key,
  uuid        uuid not null unique,
  learner_id  uuid not null,
  scenario_id text not null,
  score       int,
  total       int,
  passed      boolean,
  finished_at timestamptz not null
);

create table if not exists practical_sessions (
  id            uuid primary key default gen_random_uuid(),
  cohort_id     uuid references cohorts(id) on delete set null,
  instructor_id uuid not null references auth.users(id) on delete cascade,
  title         text not null,
  location      text,
  qr_token      text not null unique,
  starts_at     timestamptz not null default now(),
  ends_at       timestamptz,
  closed_at     timestamptz
);
create index if not exists idx_sessions_instructor on practical_sessions(instructor_id);

create table if not exists attendance (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references practical_sessions(id) on delete cascade,
  learner_id    uuid not null,
  learner_name  text,
  learner_phone text,
  checked_in_at timestamptz not null default now(),
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  approved_by   uuid references auth.users(id),
  approved_at   timestamptz,
  note          text,
  unique (session_id, learner_id)
);
create index if not exists idx_attendance_session on attendance(session_id);

create table if not exists certificates (
  id           uuid primary key default gen_random_uuid(),
  learner_id   uuid not null,
  cohort_id    uuid references cohorts(id) on delete set null,
  kind         text not null check (kind in ('theory','practical')),
  code         text not null unique,
  issued_at    timestamptz not null default now(),
  learner_name text,
  learner_phone text,
  learner_email text,
  pdpa_consent_at timestamptz,
  location     text,
  source_ref   uuid,
  pdf_url      text,
  revoked_at   timestamptz,
  unique (learner_id, kind)
);

-- Phase 3: booth mode — kind column on practical_sessions (idempotent for existing deployments).
alter table if exists practical_sessions add column if not exists kind text not null default 'session' check (kind in ('session', 'booth'));

-- Contact fields for self-service theory issuance (idempotent for existing deployments).
alter table if exists certificates add column if not exists learner_phone text;
alter table if exists certificates add column if not exists learner_email text;
alter table if exists certificates add column if not exists pdpa_consent_at timestamptz;

-- RLS: instructors only see their own cohorts / sessions
alter table cohorts enable row level security;
alter table practical_sessions enable row level security;
alter table attendance enable row level security;
alter table certificates enable row level security;

-- LINE nurture (Phase 5): log of re-engagement messages pushed to learners,
-- used to dedupe/throttle the daily cron (api/nurture/run.js). Service-role only.
create table if not exists line_nurture_log (
  id           bigserial primary key,
  learner_id   uuid not null,
  line_user_id text not null,
  campaign     text not null check (campaign in ('abandoned', 'almost_done', 'completed')),
  sent_at      timestamptz not null default now()
);
create index if not exists idx_nurture_log_learner on line_nurture_log(learner_id);

-- Opt-out flag lives on line_identities (created by the LINE Login feature).
-- Guarded so this file applies cleanly whether or not that table exists yet.
alter table if exists line_identities add column if not exists nurture_opted_out boolean not null default false;
alter table if exists line_identities add column if not exists nurture_opted_out_at timestamptz;

-- Learner-data tables: written via service-role API (bypasses RLS) or local Dexie,
-- never by the public anon client. RLS on with no policy = service-role-only access,
-- which blocks anon read/write (protects enrollments PII + exam_attempts integrity).
alter table enrollments enable row level security;
alter table lesson_progress enable row level security;
alter table quiz_attempts enable row level security;
alter table exam_attempts enable row level security;
alter table simulation_runs enable row level security;
alter table line_nurture_log enable row level security;

create policy "instructor own cohorts" on cohorts
  for all using (instructor_id = auth.uid()) with check (instructor_id = auth.uid());

create policy "instructor own sessions" on practical_sessions
  for all using (instructor_id = auth.uid()) with check (instructor_id = auth.uid());

create policy "instructor reads attendance for own sessions" on attendance
  for select using (
    exists (select 1 from practical_sessions s where s.id = session_id and s.instructor_id = auth.uid())
  );
create policy "instructor updates attendance for own sessions" on attendance
  for update using (
    exists (select 1 from practical_sessions s where s.id = session_id and s.instructor_id = auth.uid())
  );

-- Certificates: learners can read their own via service-role API only (no public RLS read).
-- Service role bypasses RLS so api/certificates/* endpoints can insert/upsert freely.

-- ===== LINE Login identity mapping =====
-- Bridges a LINE userId to a Supabase auth user and the learner's permanent id.
-- Written ONLY by the service-role bridge (api/auth/line.js). RLS enabled with no
-- policy = no anon/authenticated access; service role bypasses RLS.
create table if not exists line_identities (
  line_user_id text primary key,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  learner_id   uuid not null,
  email        text,
  display_name text,
  picture_url  text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_line_identities_learner on line_identities(learner_id);
create index if not exists idx_line_identities_auth on line_identities(auth_user_id);

alter table line_identities enable row level security;

-- Phase 2: course interest leads — learners who want to be contacted about practical training
create table if not exists course_interest (
  id         uuid primary key default gen_random_uuid(),
  learner_id text,
  name       text not null,
  phone      text not null,
  source     text,
  created_at timestamptz not null default now()
);
alter table course_interest enable row level security;
-- service-role only (inserted via api/leads/interest.js, no public read)

-- ===== Course paywall (Phase 1): per-chapter unlock via voucher code =====
-- chapter 0 = whole-course bundle (unlocks every chapter, cheaper than buying separately).
-- learner_id is the canonical id from line_identities — a learner must be logged in
-- via LINE before an entitlement can be granted, so purchases survive a device change.
create table if not exists lesson_entitlements (
  learner_id  uuid not null,
  chapter     int  not null default 0 check (chapter between 0 and 4),
  source      text not null check (source in ('voucher', 'admin_grant')),
  order_ref   text,
  granted_at  timestamptz not null default now(),
  primary key (learner_id, chapter)
);
create index if not exists idx_entitlements_learner on lesson_entitlements(learner_id);

create table if not exists vouchers (
  code        text primary key,
  chapter     int  not null default 0 check (chapter between 0 and 4),
  status      text not null default 'active' check (status in ('active', 'redeemed', 'void')),
  price_thb   int,
  redeemed_by uuid,
  redeemed_at timestamptz,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

-- Service-role only (api/entitlements/*, api/vouchers/*) — no anon/authenticated
-- policy, same pattern as enrollments/lesson_progress above. Money-adjacent tables
-- are never written directly by the client.
alter table lesson_entitlements enable row level security;
alter table vouchers enable row level security;
