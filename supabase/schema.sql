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
  location     text,
  source_ref   uuid,
  pdf_url      text,
  revoked_at   timestamptz,
  unique (learner_id, kind)
);

-- RLS: instructors only see their own cohorts / sessions
alter table cohorts enable row level security;
alter table practical_sessions enable row level security;
alter table attendance enable row level security;
alter table certificates enable row level security;

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
