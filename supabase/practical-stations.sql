-- สถานีฝึก/สอบภาคปฏิบัติต่อ session (ระบบเช็คชื่อแบบ ACLS)
-- ยังไม่ได้รันบน Supabase — รันใน SQL editor หลังตรวจแล้ว
-- RLS เปิดโดยไม่มี policy = เข้าถึงได้เฉพาะ service role (ผ่าน api/attendance/*)

create table if not exists session_stations (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references practical_sessions(id) on delete cascade,
  name        text not null,
  kind        text not null default 'practice' check (kind in ('practice','exam')),
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_session_stations_session on session_stations(session_id);

create table if not exists station_checkins (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references practical_sessions(id) on delete cascade,
  station_id      uuid not null references session_stations(id) on delete cascade,
  learner_id      uuid not null,
  checked_in_at   timestamptz not null default now(),
  checked_in_by   uuid references auth.users(id),
  passed          boolean,            -- ฐานสอบเท่านั้น; null = ยังไม่ตัดสิน
  score           int,                -- จำนวนข้อที่ทำได้
  checklist_id    text,
  checklist_items jsonb,              -- { "1": true, "2": false, ... }
  note            text,
  unique (station_id, learner_id)
);
create index if not exists idx_station_checkins_session on station_checkins(session_id);

alter table session_stations enable row level security;
alter table station_checkins enable row level security;
