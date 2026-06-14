-- ขยายตาราง lesson_media ให้ผูกสื่อ (รูป/วิดีโอ) กับเนื้อหาได้ทุกประเภท
-- (บทเรียน / สถานการณ์จำลอง / ผังช่วยชีวิต) — ใช้กับหน้า /admin/lesson-media
-- รันครั้งเดียวใน Supabase (โปรเจกต์เดียวกับที่แอปใช้): SQL Editor → วาง → Run
-- ปลอดภัยกับข้อมูลเดิม: แถวบทเรียนเดิมจะได้ content_type='lesson' อัตโนมัติ

-- ประเภทเนื้อหา: 'lesson' (ใช้ after_step), 'scenario'/'algorithm' (ใช้ step_id)
alter table public.lesson_media
  add column if not exists content_type text not null default 'lesson';

-- ผูกรูปกับ step ที่มี id (สถานการณ์/ผัง เป็น branching ไม่ใช่ลำดับเส้นตรง)
alter table public.lesson_media
  add column if not exists step_id text;

-- จำกัดค่าที่รับได้ (กันพิมพ์ผิด) — drop ก่อนกัน error ตอนรันซ้ำ
alter table public.lesson_media
  drop constraint if exists lesson_media_content_type_check;
alter table public.lesson_media
  add constraint lesson_media_content_type_check
  check (content_type in ('lesson', 'scenario', 'algorithm'));

-- คอลัมน์ lesson_id ถูกใช้เป็น "content id" ทั่วไป (id ของบท/สถานการณ์/ผัง)
create index if not exists lesson_media_content_idx
  on public.lesson_media (content_type, lesson_id);

-- RLS เดิม (public read / authenticated write) ครอบคลุมคอลัมน์ใหม่อยู่แล้ว ไม่ต้องแก้
