# LINE Nurture (Phase 5) — คู่มือติดตั้ง

ระบบส่งข้อความ LINE อัตโนมัติไปหา **ผู้เรียน** วันละครั้ง เพื่อดึงคนที่หายไปกลับมาเรียน
และชวนคนที่เรียนจบมาสมัครคลาส practical จริง

## ภาพรวม

- **`api/nurture/run.js`** — cron รันทุกวัน (10:00 น. ไทย / 03:00 UTC) เช็ค progress ของผู้เรียน
  แต่ละคนแล้วส่งข้อความ 1 แบบ ตามลำดับความสำคัญ:
  1. `completed` — สอบ Post-test ผ่าน → ฉลอง + ชวนคลาส practical
  2. `almost_done` — เรียนเหลือ ≤2 บท แต่ยังไม่สอบ → "เหลืออีก N บท รับใบเซอร์"
  3. `abandoned` — ไม่ได้เรียนมา ≥3 วัน (ยังไม่จบ) → "กลับมาเรียนต่อ"
- **`api/line/webhook.js`** — รับข้อความจากผู้ใช้ใน LINE: พิมพ์ "หยุด" = เลิกรับ, "เริ่ม" = รับต่อ
- **`api/_lib/lineMessage.js`** — ฟังก์ชัน push/reply ผ่าน Messaging API

## ขึ้นกับ LINE Login (PR #29)

ระบบนี้ส่งข้อความได้ก็ต่อเมื่อมีตาราง **`line_identities`** (map `line_user_id ↔ learner_id`)
ซึ่งสร้างโดยฟีเจอร์ LINE Login — **ก่อน PR #29 merge ระบบจะไม่ส่งอะไร** (return `{skipped:true}`)
ปลอดภัยที่จะ deploy ไว้ก่อน

## Env ที่ต้องตั้ง (Vercel)

| ตัวแปร | ใช้ทำอะไร |
|---|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | token ของ Messaging API channel (push/reply) — มีอยู่แล้วจากระบบแจ้งเตือนแอดมิน |
| `LINE_CHANNEL_SECRET` | channel secret ของ Messaging API channel เดิม — ใช้ verify ลายเซ็น webhook (`X-Line-Signature`) |
| `CRON_SECRET` | กัน endpoint cron ถูกยิงจากภายนอก |
| `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL` | อ่าน progress + เขียน log (มีอยู่แล้ว) |
| `VITE_PUBLIC_BASE_URL` | ใส่ลิงก์ในข้อความ (default `https://firstaid.morroo.com`) |

> `LINE_CHANNEL_SECRET` เป็นของ **Messaging API channel** คนละตัวกับ `LINE_LOGIN_CHANNEL_SECRET`
> ของ LINE Login

## ขั้นตอนติดตั้ง

1. **รัน schema** — `supabase/schema.sql` (เพิ่มตาราง `line_nurture_log` + คอลัมน์ opt-out บน `line_identities`)
2. **ตั้ง env** ข้างบนใน Vercel แล้ว redeploy
3. **ตั้ง webhook ใน LINE OA console** (Messaging API channel):
   - Webhook URL: `https://firstaid.morroo.com/api/line/webhook`
   - เปิด **Use webhook** = ON
   - กด **Verify** เพื่อทดสอบ
4. **cron** ทำงานอัตโนมัติจาก `vercel.json` (ไม่ต้องตั้งเพิ่ม)

## ทดสอบ

```bash
# ยิง cron ด้วยมือ (ต้องมี CRON_SECRET ตรงกัน)
curl -H "Authorization: Bearer $CRON_SECRET" https://firstaid.morroo.com/api/nurture/run
# → {"ok":true,"candidates":N,"sent":M}
```

- มีแถวใหม่ใน `line_nurture_log` หลังส่งสำเร็จ; เรียกซ้ำในวันเดียวกัน **ไม่ส่งซ้ำ**
- ทดสอบ opt-out: พิมพ์ "หยุด" ในแชต OA → `line_identities.nurture_opted_out = true` → รอบถัดไปข้ามคนนี้

## ปรับแต่ง (ใน `api/nurture/run.js`)

- `TOTAL_LESSONS` — ต้อง sync กับจำนวนบทใน `src/courses/firstaid/lessons.js` (ปัจจุบัน 24)
- `ABANDONED_AFTER_DAYS` (3) / `ABANDONED_COOLDOWN_DAYS` (7) / `MAX_PER_RUN` (200)

## PDPA

ใช้ implied consent (ล็อกอิน LINE + แอดเพื่อน = ยินยอม) ทุกข้อความมี footer ให้พิมพ์ "หยุด"
เพื่อยกเลิกได้ตลอดเวลา — ระบบเคารพการ opt-out ทันที
