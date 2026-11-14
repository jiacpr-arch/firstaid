-- ใบภาคปฏิบัติชื่อ JIA ออกได้เฉพาะคลาสของ JIA / ผู้สอนที่ JIA รับรอง (owner decision 14 Nov 2026)
-- Target project: jia-unified (tpoiyykbgsgnrdwzgzvn) — ตาราง cohorts ของ firstaid
-- คลาสสร้างโดยแอดมินเท่านั้น จึงเริ่มที่ "ออกได้" (ค่าเดิม) — ผู้สอนภายนอกที่ยังไม่รับรอง แอดมินเอาติ๊กออกตอนสร้างคลาส
-- หรือกด "ปิดใบ JIA" ในแท็บคลาส/QR. api/_lib/issuePractical.js ไม่ออกใบภาคปฏิบัติให้คลาสที่ jia_certified = false
alter table public.cohorts add column if not exists jia_certified boolean not null default true;
-- Undo: alter table public.cohorts drop column jia_certified;
