-- คลาสแบบ ACLS: ผู้สอนสร้างคลาสจากในแอปได้โดยไม่ต้องมีบัญชี (ดู api/classes/create.js)
--   cohort + รอบอบรม 1 รอบ ถูกสร้างพร้อมกัน ได้รหัสคลาส (cohorts.code) และรหัสผู้สอน (8 ตัว)
--   เก็บรหัสผู้สอนเดียวกันที่ cohorts.instructor_code และ practical_sessions.instructor_code
-- แถวที่สร้างจากแอปมี instructor_id เป็น null → นโยบาย RLS "instructor own ..." มองไม่เห็น
--   เข้าถึงได้เฉพาะ service role ผ่าน api/* เท่านั้น
-- รันแล้วบนโปรเจกต์ jia-unified (migration classes_instructor_code, 20 ต.ค. 2026) — ทุกคำสั่งเพิ่ม/ผ่อนเงื่อนไข ไม่ลบข้อมูล

alter table cohorts alter column instructor_id drop not null;
alter table practical_sessions alter column instructor_id drop not null;

alter table cohorts add column if not exists instructor_code text;
alter table cohorts add column if not exists created_via text not null default 'admin';

create unique index if not exists idx_cohorts_instructor_code
  on cohorts(instructor_code) where instructor_code is not null;
create unique index if not exists idx_sessions_instructor_code
  on practical_sessions(instructor_code) where instructor_code is not null;
