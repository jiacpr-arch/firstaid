-- ===== CPR & AED เป็นหมวดที่ 5 ของคอร์สออนไลน์ =====
-- คอร์ส CPR & AED 7 บท (หน้า /cpr, src/courses/cpr/modules.js) ขายเป็นหมวดเดียวกับหมวด 2–4
-- (src/config/pricing.js CPR_CHAPTER = 5) — ขยาย check ของ voucher/สิทธิ์ จาก 0–4 เป็น 0–5
-- chapter 0 (ทั้งคอร์ส) รวม CPR ด้วย ไม่ต้องแก้แถวเดิม
-- Apply via Supabase MCP `apply_migration` ก่อน deploy โค้ดที่ขายโค้ดหมวด 5
alter table lesson_entitlements drop constraint if exists lesson_entitlements_chapter_check;
alter table lesson_entitlements add constraint lesson_entitlements_chapter_check check (chapter between 0 and 5);
alter table vouchers drop constraint if exists vouchers_chapter_check;
alter table vouchers add constraint vouchers_chapter_check check (chapter between 0 and 5);
