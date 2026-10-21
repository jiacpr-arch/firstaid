-- ===== Blended class: CPR + first aid =====
-- คลาสรวม 1 วัน: ผู้เรียนเรียนทฤษฎีออนไลน์ 2 เว็บ (firstaid + cpr.morroo.com) แล้วมาฝึกจริง
-- ต่อยอดระบบคลาสแบบ ACLS (classes-instructor-code.sql) — ไม่มีตารางใหม่ เพิ่มแค่คอลัมน์
--
-- includes_cpr   = คลาสรวม CPR: cpr_promo_code คือแถวใน lead_promo_codes (ตารางของ jia-online
--                  ใน project เดียวกัน) ที่ api/_lib/classes.js สร้างให้ตอนสร้างคลาส
-- unlock_lessons = คนที่อยู่ในคลาสนี้ (ที่ยังไม่ปิด) เปิดทุกบทบน firstaid ได้ (api/entitlements/index.js)
-- group_label    = กลุ่มฝึก A–D ในวันเรียนจริง (api/attendance/group.js)
-- Apply via Supabase MCP `apply_migration` ก่อน deploy — DB แชร์กับ jia-online/Hub จึงใช้ if not exists
alter table cohorts
  add column if not exists includes_cpr   boolean not null default false,
  add column if not exists cpr_promo_code text,
  add column if not exists unlock_lessons boolean not null default false,
  add column if not exists starts_on      date;

alter table enrollments
  add column if not exists group_label text;
