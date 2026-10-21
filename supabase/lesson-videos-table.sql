-- คลิปประจำบท + mini quiz — ใช้กับหน้า /admin/lesson-videos
-- 1 แถวต่อบท ค่าในตารางนี้ทับ `video` ที่ระบุใน src/courses/firstaid/lessons.js
-- รันครั้งเดียวใน Supabase (โปรเจกต์เดียวกับที่แอปใช้): SQL Editor → วาง → Run

create table if not exists public.lesson_videos (
  lesson_id   text primary key,                            -- ตรงกับ id ใน lessons.js เช่น 'duty'
  youtube     text not null,                               -- รหัสวิดีโอ YouTube (unlisted)
  orientation text not null default 'portrait' check (orientation in ('portrait', 'landscape')),
  position    text not null default 'start' check (position in ('start', 'end')),   -- ต้นบท / ท้ายบท
  quiz        jsonb not null default '[]'::jsonb,          -- [{ question, choices:[{id,text}], correctId, explanation }]
  updated_at  timestamptz not null default now()
);

alter table public.lesson_videos enable row level security;

-- อ่านได้ทุกคน (ผู้เรียนต้องเห็นคลิป)
drop policy if exists "lesson_videos public read" on public.lesson_videos;
create policy "lesson_videos public read"
  on public.lesson_videos for select using (true);

-- เพิ่ม/แก้/ลบ เฉพาะผู้ที่ล็อกอิน (แอดมิน)
drop policy if exists "lesson_videos auth write" on public.lesson_videos;
create policy "lesson_videos auth write"
  on public.lesson_videos for all to authenticated
  using (true) with check (true);

-- ตารางที่สร้างไปก่อนหน้านี้ (ยังไม่มีคอลัมน์ position) — รันซ้ำได้
alter table public.lesson_videos add column if not exists position text not null default 'start';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'lesson_videos_position_check') then
    alter table public.lesson_videos add constraint lesson_videos_position_check check (position in ('start', 'end'));
  end if;
end $$;
