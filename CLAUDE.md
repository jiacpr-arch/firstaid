# CLAUDE.md

คู่มือสำหรับ Claude Code เมื่อทำงานใน repo นี้

## โปรเจกต์คืออะไร

**FirstAid Morroo** (https://firstaid.morroo.com) — แพลตฟอร์มเรียนปฐมพยาบาลออนไลน์ (PWA)
สำหรับบุคคลทั่วไป โดย Jia Training Center: 10 บทเรียน (~1 ชม.), 11 ผังช่วยชีวิตฉุกเฉิน,
5 สถานการณ์จำลอง, สอบ pre/post-test และออกใบเซอร์ — React + Vite, deploy บน Vercel,
ข้อมูล sync ผ่าน Supabase

คำสั่งหลัก: `npm run dev` (รัน local), `npm run build` (build + ตรวจว่าโค้ดพัง), `npx eslint src/`

มี Meta Pixel ติดอยู่ที่ `src/components/MetaPixel.jsx` (pixel ID ตั้งผ่าน `VITE_META_PIXEL_ID`,
default `1524889459310260`) — track PageView ทุกครั้งที่เปลี่ยนหน้า

## การเช็คผลแอด Facebook ("เช็คผลแอด")

เมื่อผู้ใช้พิมพ์ **"เช็คผลแอด"** หรือถามถึงผลโฆษณา ให้ดึงข้อมูลผ่าน **Facebook Ads MCP**
(`ads_get_ad_entities`) แล้วรายงานตามรูปแบบด้านล่าง

### ข้อมูลแคมเปญ (สร้าง 11 มิ.ย. 2026)

| รายการ | ค่า |
|---|---|
| Ad account | `10153192786713173` (Jiacpr, THB) |
| Campaign | `52556567918797` — FirstAid - Traffic - Jun 2026, OUTCOME_TRAFFIC, CBO ฿180/วัน |
| Ad set | `52556568123397` — FirstAid - TH Broad 20+, LINK_CLICKS, ไทยทั้งประเทศ อายุ 20+ |
| Ad A | `52556568346197` — รูป "4 นาที คือเส้นแบ่งชีวิต" (แนวเหตุฉุกเฉิน) |
| Ad B | `52556568357197` — รูป "เรียนฟรี 1 ชม. + ใบเซอร์" (แนวเรียนง่าย/ฟรี) |
| เพจ | Jia Training Center - อบรม CPR & AED (`1032110679988495`) |
| Landing page | https://firstaid.morroo.com |

### วิธีดึงข้อมูล

เรียก `ads_get_ad_entities` ด้วย `level: "ad"`, filter `ad.id IN [52556568346197, 52556568357197]`,
fields: `spend, impressions, clicks, cpc, ctr, cpm, frequency` — ดึง 2 ชุด: `date_preset: "yesterday"`
และสะสมรวมตั้งแต่เริ่ม (`time_range` จาก 2026-06-11 ถึงวันนี้)

### เกณฑ์ประเมิน (อิงผลเก่าของบัญชีนี้)

| ตัวชี้วัด | 🟢 ดี | 🟡 เฉยๆ | 🔴 ต้องแก้ |
|---|---|---|---|
| CPC | < ฿0.75 | ฿0.75–1.5 | > ฿1.5 |
| CTR | > 3% | 1.5–3% | < 1.5% |
| CPM | < ฿30 | ฿30–45 | > ฿45 |
| Frequency | < 2 | 2–3 | > 3 |

### รูปแบบรายงาน

สรุปสั้นเป็นภาษาไทย: ยอดใช้จ่าย + คลิกเมื่อวานและสะสม, CPC/CTR/CPM พร้อม emoji เกณฑ์,
Ad ไหนชนะ (CPC ถูกกว่า), และ action ที่แนะนำถ้ามีตัวแดง
หมายเหตุ: 3 วันแรก (ถึง ~14 มิ.ย.) อยู่ช่วง Learning Phase ตัวเลขแกว่ง อย่าเพิ่งตัดสิน

### แผน checkpoint

- **~14 มิ.ย. (วันที่ 3):** ถ้า CTR < 1.5% หรือ CPC > ฿1.5 → แนะนำเปลี่ยน creative
- **~18 มิ.ย. (วันที่ 7):** ปิด ad ตัวแพ้ A/B + พิจารณาเปลี่ยน optimization_goal เป็น
  LANDING_PAGE_VIEWS (Pixel เก็บข้อมูลพอแล้ว ใช้ `ads_update_entity` ที่ ad set)
- **~25 มิ.ย. (วันที่ 14):** สรุปรวม ถ้า CPC < ฿0.7 และอยาก scale → เพิ่มงบทีละ ~20%
  (`ads_update_entity` แก้ `campaign_daily_budget` ที่ campaign, หน่วยเป็นสตางค์ เช่น 21600 = ฿216)

### กฎที่ต้องจำ

- การเปิด/ปิดแอดหรือแก้งบ ต้องให้ผู้ใช้ยืนยันก่อนเสมอ (มีผลกับเงินจริง)
- targeting ในไทยต้องอายุ ≥ 20 และปิด Advantage+ Audience
  (`targeting_automation.advantage_audience = 0`) ไม่งั้น API ปฏิเสธ
- รูปโฆษณาอัพโหลดผ่าน Ads Manager Media Library แล้วดึง hash ด้วย `ads_get_ad_images`
  (MCP ยังอัพโหลดรูปเองไม่ได้)
