-- ⚠️ โหมด "admin ไม่มีรหัส" — เปิดให้บันทึก/อัปโหลดสื่อได้โดยไม่ต้องล็อกอิน
-- ใช้คู่กับ env VITE_ADMIN_OPEN=true (ฝั่งเว็บ)
--
-- คำเตือน: หลังรันสคริปต์นี้ "ใครก็ตามที่เข้าเว็บ" จะเพิ่ม/แก้/ลบสื่อและอัปไฟล์ได้
--          เหมาะใช้ช่วงเริ่มต้นเท่านั้น เมื่อพร้อมใช้จริงให้รันส่วน "ปิดโหมดนี้" ด้านล่าง
-- รันใน Supabase: SQL Editor → วาง → Run

-- 1) ตาราง lesson_media: อนุญาตให้ anon (ผู้ใช้ที่ไม่ได้ล็อกอิน) เพิ่ม/แก้/ลบ
drop policy if exists "lesson_media anon write" on public.lesson_media;
create policy "lesson_media anon write"
  on public.lesson_media for all to anon
  using (true) with check (true);

-- 2) Storage bucket lesson-media: อนุญาตให้ anon อัป/แก้/ลบไฟล์
drop policy if exists "lesson-media anon insert" on storage.objects;
create policy "lesson-media anon insert"
  on storage.objects for insert to anon
  with check (bucket_id = 'lesson-media');

drop policy if exists "lesson-media anon update" on storage.objects;
create policy "lesson-media anon update"
  on storage.objects for update to anon
  using (bucket_id = 'lesson-media')
  with check (bucket_id = 'lesson-media');

drop policy if exists "lesson-media anon delete" on storage.objects;
create policy "lesson-media anon delete"
  on storage.objects for delete to anon
  using (bucket_id = 'lesson-media');

-- ──────────────────────────────────────────────────────────────
-- ปิดโหมดนี้ (กลับมาต้องล็อกอินถึงเขียนได้) — รันบล็อกนี้ + เอา env VITE_ADMIN_OPEN ออก
-- ──────────────────────────────────────────────────────────────
-- drop policy if exists "lesson_media anon write"  on public.lesson_media;
-- drop policy if exists "lesson-media anon insert" on storage.objects;
-- drop policy if exists "lesson-media anon update" on storage.objects;
-- drop policy if exists "lesson-media anon delete" on storage.objects;
