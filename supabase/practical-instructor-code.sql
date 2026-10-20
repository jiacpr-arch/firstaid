-- รันแล้วบนโปรเจกต์ jia-unified (migration practical_instructor_code, 20 ต.ค. 2026)
-- รหัสผู้สอนต่อ session (แบบ ACLS) — ผู้ช่วยไม่ต้องมีบัญชีแอดมิน
-- คอลัมน์เดียว nullable; สร้าง/หมุนรหัสผ่าน api/attendance/instructor-code.js (แอดมินเท่านั้น)
alter table practical_sessions add column if not exists instructor_code text;
