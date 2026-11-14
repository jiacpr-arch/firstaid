-- แคมเปญ nurture ใหม่ "buy_nudge" (api/_lib/nurtureBuyNudge.js): ชวนซื้อคอร์สทาง LINE ครั้งเดียวต่อคน
-- ต้องรันก่อนแคมเปญจะเริ่มส่ง — ถ้ายังไม่รัน cron จะบันทึก log ไม่ได้และ "ไม่ส่ง" (กันส่งซ้ำทุกวัน)
alter table line_nurture_log drop constraint if exists line_nurture_log_campaign_check;
alter table line_nurture_log add constraint line_nurture_log_campaign_check
  check (campaign in ('abandoned', 'almost_done', 'completed', 'buy_nudge'));
