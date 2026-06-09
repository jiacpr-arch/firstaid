# ปฐมพยาบาลเบื้องต้น (firstaid)

หลักสูตรปฐมพยาบาลเบื้องต้นสำหรับประชาชน — PWA แบบ offline-first

> สำหรับเรียนออนไลน์ก่อนเข้ามาเรียนจริง พร้อมกับระบบเรียนหน้างานและออกใบ certificate ได้เลย

## Features

- **บทเรียน 10 บท** + Pre-test / Post-test (ผ่าน ≥ 80%)
- **Algorithm 11 หัวข้อ** — flowchart กดทีละขั้น (CPR, AED, สำลัก, เลือดออก, แผลไหม้, กระดูกหัก, เป็นลม, ชัก, จมน้ำ, งูกัด, ลมแดด)
- **Simulation 5 ฉาก** — ฝึกตัดสินใจจากสถานการณ์จำลอง
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

สร้างผู้ใช้ครูใน Supabase Auth → Users → Add user (email + password) เพื่อเข้า `/admin/login`

## Routes

| Path | Page |
|------|------|
| `/` | Home |
| `/learn`, `/learn/:lessonId` | Lessons |
| `/pre-test`, `/post-test` | Exams |
| `/algorithms`, `/algorithms/:topic` | Algorithm flowcharts |
| `/simulation`, `/simulation/:id` | Decision-tree scenarios |
| `/certificate` | ใบประกาศ 2 ใบ (PDF download) |
| `/checkin`, `/checkin/scan`, `/checkin/:code` | เช็คชื่อภาคปฏิบัติ |
| `/call` | โทร 1669 + tips |
| `/admin/login`, `/admin`, `/admin/cohorts`, `/admin/sessions`, `/admin/sessions/:id`, `/admin/certificates` | Instructor area |

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
