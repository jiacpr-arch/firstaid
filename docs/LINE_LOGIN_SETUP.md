# ตั้งค่า LINE Login (สมัคร/ล็อกอินผู้เรียน + auto-add @jiacpr)

ฟีเจอร์นี้บังคับให้ผู้เรียนล็อกอินด้วย LINE หลังเรียนจบบทแรก สร้างบัญชีจริงผ่าน Supabase Auth
และเพิ่มเพื่อน OA `@jiacpr` ให้อัตโนมัติ จนกว่าจะตั้งค่าด้านล่างครบ ระบบจะยังไม่ทำงานเต็มรูป
(ถ้าไม่ตั้ง `VITE_LINE_LOGIN_CHANNEL_ID` แอปจะ fallback เป็นด่าน honor-system เดิม)

## 1) LINE Developers Console (https://developers.line.biz)

1. ใช้ Provider เดิม (หรือสร้างใหม่)
2. สร้าง **LINE Login channel** — *คนละตัว* กับ Messaging API OA ที่ใช้แจ้งเตือน admin
   - จด **Channel ID** → ใส่เป็น `VITE_LINE_LOGIN_CHANNEL_ID`
   - จด **Channel secret** → ใส่เป็น `LINE_LOGIN_CHANNEL_SECRET`
3. ในแท็บ **Linked LINE Official Account** → ผูก OA **@jiacpr**
4. เปิด **Add friend option** → ตั้งเป็น **On (aggressive)**
   (ทำให้ `bot_prompt=aggressive` เพิ่มเพื่อนอัตโนมัติตอนล็อกอิน)
5. **Callback URL** (ต้องตรงเป๊ะ ไม่มี wildcard) ใส่ทุก origin ที่ใช้:
   - `https://firstaid.morroo.com/auth/line/callback` (production)
   - `http://localhost:5173/auth/line/callback` (ทดสอบ local)
   - URL ของ Vercel preview ที่จะใช้ทดสอบ (ใส่ทีละอันตามต้องการ)
6. (ภายหลัง ถ้าต้องการ email จริงของผู้ใช้) แท็บ **OpenID Connect** → ขอ **Email address permission**
   (ต้องส่ง review). จนกว่าจะอนุมัติ ระบบใช้ email สังเคราะห์ `line_<userId>@line.firstaid.local`
   — ไม่ต้องเปิดก็ใช้งานได้

## 2) Supabase

- เปิด **Email** auth provider (Authentication → Providers) — จำเป็นสำหรับ magiclink
  *ไม่ต้องตั้ง SMTP* เพราะระบบไม่ได้ส่งอีเมลจริง (ใช้ token_hash โดยตรง)
- รัน `supabase/schema.sql` เพื่อสร้างตาราง `line_identities`

## 3) Vercel (Project Settings → Environment Variables)

| ตัวแปร | ฝั่ง | หมายเหตุ |
|---|---|---|
| `VITE_LINE_LOGIN_CHANNEL_ID` | public | Channel ID ของ LINE Login channel |
| `LINE_LOGIN_CHANNEL_SECRET` | server | Channel secret (ห้าม public) |

ของเดิมที่ต้องมีอยู่แล้ว: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

## 4) ทดสอบ

ใช้ `vercel dev` (ต้องใช้เพื่อรัน `api/auth/line.js` — `npm run dev` เพียว ๆ ไม่ serve โฟลเดอร์ `api/`)

1. เปิดครั้งแรก → ถูกพาไป `/learn/duty` (บทแรก)
2. เรียนจบบทแรก → เด้งหน้า **"เข้าสู่ระบบด้วย LINE"**
3. กดปุ่ม → หน้า consent ของ LINE จะมีขั้น **เพิ่มเพื่อน @jiacpr** → ยินยอม
4. กลับมาที่ `/auth/line/callback` → ได้ session, OA มีเพื่อนใหม่, เด้งเข้า `/learn` พร้อมแถบเมนูล่าง
5. รีโหลด → ผู้ที่ล็อกอินแล้วเข้าหน้าปกติเลย (ไม่ถูกพากลับบทแรก)
6. ปุ่มโทร **1669** กดได้เสมอแม้ยังไม่ล็อกอิน

## หมายเหตุ / ข้อควรระวัง

- **PWA ใน LINE in-app browser:** ใช้ full-window redirect แล้ว ถ้าเจอ state-mismatch บ่อยใน IAB
  ให้ย้าย state/nonce ไปเก็บใน cookie (ดูคอมเมนต์ใน `src/utils/lineAuth.js`)
- **ความก้าวหน้าผู้เรียน** ผูกกับ `learner.id` (UUID) เหมือนเดิม — การล็อกอินแค่ "ผูก" บัญชีเข้ากับ id นี้
  ผ่านตาราง `line_identities` จึงไม่ต้องย้ายข้อมูลเดิม
