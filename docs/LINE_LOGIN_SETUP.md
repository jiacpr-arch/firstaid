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

## 5) ทางเลือกสำรอง: เข้าสู่ระบบด้วยบัญชี JIA กลาง (Hub SSO, ไม่มี LINE) — 23 กันยายน 2569

ด่านล็อกอินหลังบทแรก (`LineLoginGate.jsx`) **ปิดไม่ได้** — เดิมมีแค่ทาง LINE ทางเดียว คนไม่มี/ไม่อยาก
ใช้ LINE จะเรียนต่อไม่ได้เลย ตอนนี้มีปุ่มที่สอง **"ไม่มี LINE? เข้าสู่ระบบด้วยบัญชี JIA"** ส่ง browser
ไปที่หน้า `/sso` ของ Hub (`class.jiacpr.com`, repo `jia-learning-hub`) — ดูภาพรวมทั้งระบบที่
`jia-learning-hub`, `docs/unified-identity.md`

- `src/utils/hubAuth.js` (คู่กับ `src/utils/lineAuth.js`): PKCE (S256) — `state`/`code_verifier` เก็บ
  ทั้ง sessionStorage และ cookie เหมือนของ LINE
- `src/pages/HubCallback.jsx` (route `/auth/hub/callback`): แลก `code` ที่ `/api/auth/hub` แล้ว
  `supabase.auth.verifyOtp()` เหมือน `LineCallback.jsx`
- `api/auth/hub.js`: เรียก `public.jia_sso('consume')` **ตรง** (ไม่ผ่าน Edge Function `sso-auth`ของ
  Hub) เพราะ firstaid อยู่ Supabase โปรเจกต์เดียวกับ Hub — service role ของ firstaid เองก็ทำแทนได้
  ทุกอย่างที่ `sso-auth` ทำ (consume code + mint magiclink) แล้วยังได้ `userId` กลับมาตรงๆ ด้วย (ซึ่ง
  response ของ `sso-auth` เองไม่คืนให้) จากนั้นเรียก `public.jia_firstaid_hub_adopt` เพื่อได้
  `learner_id` ตัวจริง (คนละบัญชีจะ merge ไม่ได้ ถ้าชนกับ `learnerId` ของคนอื่นจะถูกปฏิเสธ)
- `api/_lib/authLearner.js`: `learnerIdFromToken`/ตัวเช็ค "learnerId นี้ผูกกับบัญชีจริงหรือยัง" (ใช้ใน
  `api/certificates/issue-theory.js`) ตอนนี้เช็คทั้ง `line_identities` และ (ตัวใหม่)
  `public.jia_firstaid_hub_learner` (สำหรับบัญชีที่ adopt แบบไม่มี LINE) — ตัวหลังเป็น best-effort
  (เรียกไม่ได้ก็แค่ถือว่ายังไม่ผูก ไม่บล็อกล็อกอินอื่น)

**ต้องตั้งค่าก่อนใช้งานจริง (ฝั่ง Hub, `jia-learning-hub`):**
1. Apply migration ทั้งชุด unified-identity (ดูเช็คลิสต์ใน `docs/unified-identity.md` ของ repo นั้น)
2. เพิ่มแถว `sso_clients` ให้ firstaid:
   ```sql
   insert into learning_hub.sso_clients(client_id,name,kind,redirect_uris,allowed_courses) values
    ('firstaid','FirstAid Morroo','supabase',array[
     'https://firstaid.morroo.com/auth/hub/callback',
     'http://localhost:5173/auth/hub/callback'],array['firstaid']);
   ```
   (`allowed_courses` = คอร์สที่ firstaid ส่งผลสอบเข้า "ผลสอบกลาง" ของ Hub ได้ — ดูหัวข้อ 6)
   (`kind='supabase'` ไม่ต้องมี secret — เชื่อด้วย `client_id`+`redirect_uri` ตรงเป๊ะเท่านั้น เพราะ
   `api/auth/hub.js` เรียก RPC ตรงด้วย service role ของ firstaid เอง ไม่ผ่าน CORS จาก browser)

**ทดสอบ:** เปิดในเบราว์เซอร์ปกติ (ไม่ใช่ LINE) → เรียนจบบทแรก → กด "ไม่มี LINE? เข้าสู่ระบบด้วยบัญชี
JIA" → เด้งไปหน้า `/sso` ของ Hub → login (LINE หรืออีเมลที่ Hub) → กรอกชื่อถ้ายังไม่มี → กลับมาที่
`/auth/hub/callback` → ได้ session จริง → เรียนต่อ/ออกใบเซอร์ได้ปกติ; ล็อกอินซ้ำจากเครื่องอื่นด้วย
บัญชี Hub เดิม → ต้องได้ `learner_id` เดิม (progress/ใบเซอร์เดิม) ไม่ใช่ผู้เรียนคนใหม่

## 6) ผลสอบเข้า "ผลสอบกลาง" ของ Hub — 24 กันยายน 2569

ผลสอบ pre/post ที่ server ตรวจแล้ว ส่งเข้า `learning_hub.exam_results` ของ Hub ผ่าน `public.jia_results('record')`
ด้วย service role ของ firstaid เอง (DB เดียวกัน) — `api/_lib/hubResults.js`:
- **เฉพาะผู้เรียนที่ login อยู่** (bearer token → บัญชี + learner ที่ผูกกันจริง) ผลของผู้เรียนนิรนามไม่ถูกส่ง
- ส่งจาก `api/sync/push.js` (ทุก attempt ที่ sync ขึ้นมา — ตรวจใหม่ที่ server แล้ว) และ `api/certificates/issue-theory.js`
  (attempt ที่ใช้ออกใบ theory) — `attemptRef` = uuid ของ `exam_attempts` จึงส่งซ้ำได้ผลเดิม
- Hub คิดคะแนน/ผ่าน-ไม่ผ่านเองจาก correct/total (เกณฑ์คอร์ส `firstaid` ของ Hub) — Hub ล่ม/ปฏิเสธ แค่ log ไม่กระทบ sync/ใบเซอร์
- ต้องมีแถว `sso_clients` `firstaid` ที่ `allowed_courses` มี `firstaid` (ข้อ 2 ของหัวข้อ 5) และ apply
  `20261016100000_exam_results.sql` ของ Hub ก่อน ผลถึงจะเข้า

**แก้ช่องโหว่ไปพร้อมกัน:** `api/sync/push.js` เดิมให้ผู้เรียกที่ไม่มี token sync ข้อมูลเข้า `learnerId` ของใครก็ได้ รวมถึง
learner ที่ผูกกับบัญชีจริงแล้ว (Hub อ่าน `exam_attempts`/`lesson_progress` ของ learner นั้นเป็นหลักฐานความพร้อม) — ตอนนี้
ปฏิเสธ (403) เหมือน `issue-theory` แล้ว; เครื่องที่ logout อยู่ไม่เสียข้อมูล (แถวค้างในเครื่องแล้วส่งพร้อม token หลัง login)

## 7) ใบประกาศออนไลน์กลาง JIA บนหน้าใบประกาศ — 24 กันยายน 2569

การ์ดใบประกาศภาคทฤษฎีแสดง "ใบประกาศออนไลน์กลาง JIA" **เพิ่ม** จากใบของแอปนี้ (ใบ FA- เดิมไม่เปลี่ยน ตามที่ตัดสินใจ) —
`src/components/HubCertificateCard.jsx` เรียก `public.jia_person_certificates('mine')` ด้วย Supabase session ของแอปนี้ (DB เดียวกับ Hub):
- มีใบแล้ว → เลขที่ `JIA-FIRSTAID-ONL-…` + วันหมดอายุ + ลิงก์ตรวจสอบ `https://class.jiacpr.com/portal?verify=<token>`
- ผลสอบหลังเรียน (ที่ส่งเข้า Hub ตามหัวข้อ 6) ผ่านและได้รับรองแล้วแต่ยังไม่มีใบ → ปุ่ม "ขอรับใบประกาศกลาง"
- ยังไม่ login / ยังไม่มีผลที่รับรอง / Hub ยังไม่ apply migration → ไม่แสดงอะไร
ใบกลางออกเมื่อผลสอบได้รับรองที่ Hub (อัตโนมัติถ้าเปิด `auto_accept` ของคอร์ส `firstaid` หรือเจ้าหน้าที่กดรับรอง)
