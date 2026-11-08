-- ชำระเงินออนไลน์ผ่าน Stripe (api/checkout/*) — สิทธิ์ที่ได้จากการจ่ายเงินบันทึก source = 'stripe'
-- order_ref = 'stripe:<checkout session id>' ; รันครั้งเดียวบน Supabase (idempotent)
alter table lesson_entitlements drop constraint if exists lesson_entitlements_source_check;
alter table lesson_entitlements add constraint lesson_entitlements_source_check
  check (source in ('voucher', 'admin_grant', 'stripe'));
