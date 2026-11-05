-- ===== LINE เตือนนักเรียนในคลาสที่ยังเรียนออนไลน์ไม่ครบ =====
-- ประวัติการส่ง (api/_lib/classReminder.js) ใช้กันส่งซ้ำ:
--   manual = ผู้สอนกดปุ่มในแท็บภาพรวม (cooldown 12 ชม. ต่อคน)
--   d3/d1  = cron ส่งเองก่อนวันเรียน 3 วัน / 1 วัน (ครั้งเดียวต่อคนต่อคลาส)
-- ยังไม่มีตารางนี้ = ระบบไม่ส่งอะไร (fail closed) — Apply via Supabase MCP `apply_migration` ก่อน deploy
create table if not exists class_reminder_log (
  id           bigserial primary key,
  cohort_id    uuid not null references cohorts(id) on delete cascade,
  learner_id   uuid not null,
  line_user_id text not null,
  kind         text not null check (kind in ('manual', 'd3', 'd1')),
  sent_at      timestamptz not null default now()
);
create index if not exists idx_class_reminder_log_cohort on class_reminder_log(cohort_id, learner_id);

-- service-role only (RLS on, no policy)
alter table class_reminder_log enable row level security;
