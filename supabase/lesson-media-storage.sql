-- Storage สำหรับสื่อบทเรียน (ใช้กับหน้า /admin/media)
-- รันครั้งเดียวใน Supabase: SQL Editor → วางสคริปต์นี้ → Run
-- หรือสร้าง bucket ชื่อ "lesson-media" แบบ Public ผ่านหน้า Storage ก็ได้

-- 1) สร้าง bucket แบบ public (อ่านได้ทุกคน เขียนได้เฉพาะผู้ล็อกอิน)
insert into storage.buckets (id, name, public)
values ('lesson-media', 'lesson-media', true)
on conflict (id) do update set public = true;

-- 2) Policies บน storage.objects เฉพาะ bucket นี้
--    อ่าน (ดูรูป/วิดีโอในบทเรียน) — สาธารณะ
drop policy if exists "lesson-media public read" on storage.objects;
create policy "lesson-media public read"
  on storage.objects for select
  using (bucket_id = 'lesson-media');

--    อัปโหลด — เฉพาะผู้ที่ล็อกอิน (ครู/แอดมิน)
drop policy if exists "lesson-media auth insert" on storage.objects;
create policy "lesson-media auth insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'lesson-media');

--    แก้ไข/แทนที่ — เฉพาะผู้ที่ล็อกอิน
drop policy if exists "lesson-media auth update" on storage.objects;
create policy "lesson-media auth update"
  on storage.objects for update to authenticated
  using (bucket_id = 'lesson-media')
  with check (bucket_id = 'lesson-media');

--    ลบ — เฉพาะผู้ที่ล็อกอิน
drop policy if exists "lesson-media auth delete" on storage.objects;
create policy "lesson-media auth delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'lesson-media');
