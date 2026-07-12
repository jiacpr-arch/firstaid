-- ปิดช่องโหว่: ยกเลิก write policy แบบเปิดกว้างของสื่อบทเรียน
-- (ของเดิมจาก open-admin-writes.sql — ใครมี anon key ก็เพิ่ม/แก้/ลบสื่อได้
--  และ "auth write" ก็ไม่ปลอดภัยเช่นกัน เพราะผู้เรียนที่ล็อกอิน LINE ทุกคน
--  เป็น authenticated user ของ Supabase)
--
-- หลังรัน: การเขียนทั้งหมดต้องผ่าน /api/media/admin (requireAdmin + service role)
-- ส่วนการอ่าน (public read) คงเดิม — หน้าเว็บแสดงสื่อได้ตามปกติ
-- รันใน Supabase: SQL Editor → วาง → Run

-- 1) ตาราง lesson_media
drop policy if exists "lesson_media anon write" on public.lesson_media;
drop policy if exists "lesson_media auth write" on public.lesson_media;

-- 2) Storage bucket lesson-media (signed upload URL จาก API ยังใช้ได้ ไม่พึ่ง policy พวกนี้)
drop policy if exists "lesson-media anon insert" on storage.objects;
drop policy if exists "lesson-media anon update" on storage.objects;
drop policy if exists "lesson-media anon delete" on storage.objects;
drop policy if exists "lesson-media auth insert" on storage.objects;
drop policy if exists "lesson-media auth update" on storage.objects;
drop policy if exists "lesson-media auth delete" on storage.objects;
