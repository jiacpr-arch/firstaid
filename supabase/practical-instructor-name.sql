-- รันแล้วบนโปรเจกต์ jia-unified (migration practical_instructor_name, 26 ต.ค. 2026)
-- ชื่อผู้สอนของรอบอบรม — พิมพ์บนใบประกาศภาคปฏิบัติของระบบกลาง JIA (api/_lib/hubPractical.js)
-- คอลัมน์เดียว nullable; ตั้งตอนสร้างคลาส หรือแก้ทีหลังที่ /admin/teach (api/classes/instructor-name.js)
alter table practical_sessions add column if not exists instructor_name text
  check (instructor_name is null or char_length(instructor_name) between 2 and 100);
