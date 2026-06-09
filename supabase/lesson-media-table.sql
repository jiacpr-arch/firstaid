-- ตารางผูกสื่อ (รูป/วิดีโอ) เข้ากับบทเรียน — ใช้กับหน้า /admin/lesson-media
-- ทำให้แอดมินเพิ่มรูป/วิดีโอในแต่ละบทได้จากหลังบ้าน โดยไม่ต้องแก้โค้ดหรือ redeploy
-- รันครั้งเดียวใน Supabase (โปรเจกต์เดียวกับที่แอปใช้): SQL Editor → วาง → Run

create table if not exists public.lesson_media (
  id          uuid primary key default gen_random_uuid(),
  lesson_id   text not null,                               -- ตรงกับ id ใน lessons.js เช่น 'assess'
  kind        text not null check (kind in ('image', 'video')),
  url         text,                                        -- URL ไฟล์ใน Storage (รูป หรือวิดีโออัปเอง)
  youtube     text,                                        -- รหัสวิดีโอ YouTube (ถ้าเป็นวิดีโอแบบฝัง)
  alt         text,
  caption     text,
  after_step  int,                                         -- แทรกหลังขั้นที่ N (1-based); 0=ก่อนขั้นแรก; ว่าง=ท้ายบท
  created_at  timestamptz not null default now()
);

create index if not exists lesson_media_lesson_idx on public.lesson_media (lesson_id);

alter table public.lesson_media enable row level security;

-- อ่านได้ทุกคน (ผู้เรียนต้องเห็นสื่อ)
drop policy if exists "lesson_media public read" on public.lesson_media;
create policy "lesson_media public read"
  on public.lesson_media for select using (true);

-- เพิ่ม/แก้/ลบ เฉพาะผู้ที่ล็อกอิน (แอดมิน)
drop policy if exists "lesson_media auth write" on public.lesson_media;
create policy "lesson_media auth write"
  on public.lesson_media for all to authenticated
  using (true) with check (true);
