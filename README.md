# ปฐมพยาบาลเบื้องต้น (firstaid)

หลักสูตรปฐมพยาบาลเบื้องต้นสำหรับประชาชน — PWA แบบ offline-first

> สำหรับเรียนออนไลน์ก่อนเข้ามาเรียนจริง พร้อมกับระบบเรียนหน้างานและออกใบ certificate ได้เลย

## Features

- **บทเรียน 24 บท (4 หมวด)** + Pre-test / Post-test (ผ่าน ≥ 80%)
- **หมวด 5: CPR & AED ออนไลน์** (`/cpr`) — วิดีโอ 6 บท + ข้อสอบปลายภาค เนื้อหาชุดเดียวกับ cpr.morroo.com
  ตรวจที่ edge function `grade-quiz` (jia-online) ผ่านแล้วได้ใบประกาศ CPR จากระบบกลาง JIA
  — คลาสรวม CPR + ปฐมพยาบาลเรียนฟรี, คนทั่วไปปลดล็อกหมวด 5 (฿149) หรือทั้งคอร์ส
- **Algorithm 17 หัวข้อ** — flowchart กดทีละขั้น (CPR, AED, สำลัก, เลือดออก, แผลไหม้, กระดูกหัก, เป็นลม, ชัก, จมน้ำ, งูกัด, ลมแดด ฯลฯ)
- **Simulation 40 ฉาก** — ฝึกตัดสินใจจากสถานการณ์จำลอง
- **ใบประกาศ 2 ใบ**:
  - **ทฤษฎี** — ออกอัตโนมัติเมื่อผ่าน Post-test
  - **ปฏิบัติ** — ออกหลังเช็คชื่อภาคปฏิบัติและครูผู้สอนอนุมัติในระบบ
- **ระบบเช็คชื่อ** — ครูสร้าง session, แสดง QR + รหัส 6 หลัก, ผู้เรียนสแกน/กรอกรหัส, ครูกดอนุมัติในระบบ
- **PWA** — ติดตั้งบนหน้าจอบ้าน, ใช้งานออฟไลน์ได้
- **ปุ่ม "โทร 1669"** ลอยอยู่ทุกหน้า

## Stack

- React 19 + Vite 7 + Tailwind 4 + React Router v7
- Zustand (state) + Dexie (offline IndexedDB)
- Supabase (Auth + Postgres) สำหรับฝั่งครูผู้สอนและการซิงค์
- Vercel serverless functions ใต้ `/api/*`
- PWA via `vite-plugin-pwa` + Workbox

## Setup

```bash
npm install
cp .env.example .env
# กรอก VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
npm run dev
```

แอปทำงานได้แม้ไม่มี Supabase — เฉพาะส่วน admin/cohort/attendance ต้องการ Supabase

## Supabase

รัน `supabase/schema.sql` ในโปรเจค Supabase ใหม่ จะได้ตาราง:
`cohorts`, `enrollments`, `lesson_progress`, `quiz_attempts`, `exam_attempts`,
`simulation_runs`, `practical_sessions`, `attendance`, `certificates`

ไฟล์ SQL อื่นใน `supabase/` เป็น migration เพิ่มเติม (apply ด้วย Supabase MCP) — เช่น `cpr-chapter.sql`
ขยายหมวดของ `vouchers`/`lesson_entitlements` เป็น 0–5 (applied แล้ว)

สร้างผู้ใช้ครูใน Supabase Auth → Users → Add user (email + password) เพื่อเข้า `/admin/login`

## Routes

| Path | Page |
|------|------|
| `/` | Home |
| `/learn`, `/learn/:lessonId` | Lessons |
| `/cpr`, `/cpr/:moduleId` | หมวด 5 CPR & AED (บท 1–6 + ปลายภาค id 7) |
| `/cpr/guide` | คู่มือนักเรียนเรียน CPR + รับใบประกาศ (ไม่ต้องล็อกอิน) |
| `/pre-test`, `/post-test` | Exams |
| `/algorithms`, `/algorithms/:topic` | Algorithm flowcharts |
| `/simulation`, `/simulation/:id` | Decision-tree scenarios |
| `/certificate` | ใบประกาศ 2 ใบ (PDF download) |
| `/checkin`, `/checkin/scan`, `/checkin/:code` | เช็คชื่อภาคปฏิบัติ |
| `/call` | โทร 1669 + tips |
| `/admin/login`, `/admin`, `/admin/cohorts`, `/admin/sessions`, `/admin/sessions/:id`, `/admin/certificates` | Instructor area |
| `/admin/guide` | คู่มือผู้สอน (รวมคลาสรวม CPR และการขายหมวด CPR) |
| `/admin/vouchers` | สร้างโค้ดปลดล็อกรายหมวด (0 = ทั้งคอร์ส, 1–4, 5 = CPR) |

## Deploy

Vercel → connect GitHub repo → set env vars → deploy
Suggested domain: `firstaid.morroo.com`

## Scripts

```bash
npm run dev      # local dev server
npm run build    # production build
npm run lint
npm run test     # API tests via node:test
```
