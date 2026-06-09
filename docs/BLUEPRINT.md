# Blueprint — Blended Learning LMS for Compliance Training

> Template สำหรับสร้างแพลตฟอร์มอบรมแบบไฮบริด (ทฤษฎีออนไลน์ + ปฏิบัติหน้างาน) ที่ออก digital certificate ได้
>
> **ที่มา:** ถอดแบบจากระบบ firstaid (ปฐมพยาบาลเบื้องต้น) — เปลี่ยน content แล้วใช้กับหลักสูตรอื่นได้ทันที

---

## 1. Problem this blueprint solves

หลักสูตรที่ **มีกฎหมาย/มาตรฐานบังคับให้พนักงานต้องผ่านการอบรมเป็นระยะ** เช่น:

| หลักสูตร | กฎหมาย/มาตรฐานที่บังคับ |
|---------|------------------------|
| ปฐมพยาบาล | กฎกระทรวง พ.ศ. 2549 — สถานประกอบการ ≥ 30 คน |
| ดับเพลิงเบื้องต้น | กฎกระทรวง พ.ศ. 2555 — 40% ของพนักงาน |
| ความปลอดภัย จป. | พ.ร.บ. ความปลอดภัย พ.ศ. 2554 |
| สุขาภิบาลอาหาร | พ.ร.บ. การสาธารณสุข |
| ขับรถยก (Forklift) | กฎกระทรวง พ.ศ. 2564 |
| HAZMAT / สารเคมี | OSHA-equivalent ของไทย |
| ACLS / BLS / AED | สมาคมแพทย์โรคหัวใจ |

**ปัญหาเดิม:** อบรมหน้างานอย่างเดียว → คนยุ่ง ขาดบ่อย ใบประกาศหาย ตามตัวคนผ่านยาก

**Solution pattern:** ทฤษฎีออนไลน์เรียนเมื่อไหร่ก็ได้ → ผ่าน post-test → มาฝึกปฏิบัติหน้างานครึ่งวันเท่านั้น → ครูเช็คชื่อ → ออกใบประกาศดิจิทัล

---

## 2. Core entities

```
┌──────────┐          ┌──────────┐          ┌─────────────┐
│ Learner  │─enroll──>│  Cohort  │<──own────│ Instructor  │
└──────────┘          └──────────┘          └─────────────┘
     │                     │                       │
     │ progress            │                       │ create
     ▼                     ▼                       ▼
┌──────────┐          ┌──────────┐         ┌──────────────┐
│  Lesson  │          │ Practical│<────────│   Session    │
│ Progress │          │  Cert    │         │  (QR + code) │
└──────────┘          └──────────┘         └──────────────┘
     │                     ▲                       │
     │                     │                       │ check in
     ▼                     │                       ▼
┌──────────┐          ┌──────────┐         ┌──────────────┐
│ Quiz/    │─pass───>│ Theory   │         │  Attendance  │
│ Exam     │          │  Cert    │<──approve──────┤
└──────────┘          └──────────┘                 │
                                                    │
                                                    └─ instructor
```

**6 entities หลัก** (เปลี่ยน content โดยไม่แตะ schema ก็พอแล้ว):

1. **Learner** — ผู้เรียน (anonymous + offline-first, sync with Supabase optional)
2. **Cohort** — รุ่น/กลุ่ม (สังกัดครูคนหนึ่ง มีรหัสรุ่น)
3. **Instructor** — ครูผู้สอน (Supabase Auth user)
4. **Lesson / Quiz / Exam** — บทเรียน + คำถาม (JSON data)
5. **Session** — กิจกรรมหน้างาน (มี QR + รหัส 6 หลัก เปิด/ปิดได้)
6. **Certificate** — ใบประกาศ 2 แบบ: `theory` + `practical`

---

## 3. User roles & flows

### Learner flow
```
Home → Pre-test → Lessons (1..N) → Post-test (≥ 80%)
  → Theory Certificate (auto)
  → ไปเรียน practical หน้างาน
  → สแกน QR / กรอกรหัส session
  → รอครูอนุมัติ
  → Practical Certificate
```

### Instructor flow
```
/admin/login → สร้าง Cohort
  → สร้าง Session (เลือก cohort, ใส่ location)
  → แสดงจอ QR + รหัส 6 หลัก
  → ดู attendance list real-time
  → กดอนุมัติทีละคน / batch
  → ผู้เรียนได้ practical cert
```

---

## 4. Tech stack (ขั้นต่ำ)

| ชั้น | เครื่องมือ | เหตุผล |
|-----|----------|--------|
| **Frontend** | React 19 + Vite + Tailwind | ทำเร็ว, SPA, mobile-first |
| **Routing** | React Router v7 | standard SPA |
| **State** | Zustand | เบา (1KB), ไม่ต้อง provider |
| **Offline DB** | Dexie (IndexedDB) | learner ใช้งานได้แม้ไม่มีเน็ต |
| **PWA** | vite-plugin-pwa + Workbox | ติดตั้งบนหน้าจอบ้านได้ |
| **PDF** | jsPDF + qrcode | ออกใบประกาศโดยไม่ต้องส่ง server |
| **QR scan** | html5-qrcode | ผู้เรียนสแกน session |
| **Auth + DB** | Supabase (Postgres + Auth + RLS) | เฉพาะฝั่งครู — learner ไม่ต้อง login |
| **API** | Vercel serverless functions | endpoint สั้นๆ /api/* |
| **Hosting** | Vercel | auto-deploy จาก git, free tier พอ |
| **CI** | GitHub Actions | lint + test + build |

**ทำไมถึงเลือกแบบนี้:** ทุกชั้นมี free tier + zero ops คนเดียวดูแลได้ + ผู้เรียนใช้งานได้แม้ไม่มี internet

---

## 5. Repository structure (reusable)

```
<your-course>/
├── .github/workflows/ci.yml         # lint+test+build บน PR
├── api/                             # Vercel serverless
│   ├── _lib/
│   │   ├── certCode.js              # gen รหัสใบประกาศ
│   │   ├── requireAdmin.js          # auth guard
│   │   └── supabaseAdmin.js
│   ├── attendance/                  # session, check-in, approve
│   └── certificates/                # issue + verify
├── docs/source/                     # คู่มือ/เอกสารต้นฉบับ (.docx, .pdf)
├── scripts/seed-demo.js             # สร้าง instructor + cohort ทดลอง
├── src/
│   ├── components/                  # ปุ่มฉุกเฉิน, ProgressBar, QR ฯลฯ
│   ├── courses/<course-id>/         # ⭐ content swap จุดเดียว
│   │   ├── lessons.js               # บทเรียน + steps + quiz
│   │   ├── algorithms.js            # flowchart ตัดสินใจ
│   │   ├── scenarios.js             # ฝึก simulation
│   │   └── exams.js                 # pre/post test
│   ├── pages/                       # หน้าหลัก (Learn, Algorithm, Sim, Admin)
│   ├── stores/                      # learnerStore, progressStore
│   └── hooks/
├── supabase/schema.sql              # 9 tables + RLS policies
├── vercel.json                      # rewrites for SPA
└── package.json
```

**ที่ swap เปลี่ยน domain:**
1. แก้ `src/courses/<course-id>/*.js` 4 ไฟล์ — content ทั้งหมดอยู่ที่นี่
2. แก้ icons + branding ใน `src/App.css`, `src/pages/Home.jsx`
3. ไม่ต้องแตะ schema, API, auth, certificates

---

## 6. Database schema (Supabase / Postgres)

ตารางหลัก 9 ตาราง ใช้ได้กับทุกหลักสูตร (ไม่ต้องแก้):

```sql
cohorts (id, instructor_id, name, code, created_at)
enrollments (cohort_id, learner_id, name, phone, joined_at)
lesson_progress (learner_id, lesson_id, read_at)
quiz_attempts (uuid, learner_id, lesson_id, score, passed, finished_at)
exam_attempts (uuid, learner_id, kind ['pre'|'post'], score, passed)
simulation_runs (uuid, learner_id, scenario_id, score, passed)
practical_sessions (id, cohort_id, instructor_id, qr_token, starts_at, closed_at)
attendance (session_id, learner_id, status ['pending'|'approved'|'rejected'])
certificates (id, learner_id, kind ['theory'|'practical'], code, issued_at)
```

**RLS policies** กำหนดให้:
- ครูเห็นเฉพาะ cohort/session ของตัวเอง
- ใบประกาศต้อง verify ผ่าน service-role API (กันปลอม)

---

## 7. Content shape (สิ่งที่ต้องเตรียมต่อหลักสูตร)

| ไฟล์ | structure | ตัวอย่าง |
|------|-----------|---------|
| `lessons.js` | array of `{ id, chapter, order, title, summary, minutes, steps: [...] }` | step type: `read` / `callout` / `quiz` |
| `algorithms.js` | array of `{ id, title, color, steps: [...] }` | step type: `check` / `action` / `call` / `goto` พร้อม branching `yesNextId` / `noNextId` |
| `scenarios.js` | array of `{ id, title, steps: [{ prompt, choices: [{correct, feedback, nextStepId}] }] }` | สถานการณ์จำลอง |
| `exams.js` | คลังคำถาม + selector สำหรับ pre/post test | ผ่าน ≥ 80% |

**Rule of thumb สำหรับ content design:**
- 1 lesson = 3-10 นาที + quiz ท้ายบท (microlearning)
- 1 chapter = 4-7 lessons
- ทั้งหลักสูตร = 3-5 chapters (1-3 ชม. รวม)
- Algorithm = flowchart ตัดสินใจ 4-12 nodes
- Scenario = 3-5 decision steps พร้อม feedback ทุก choice

---

## 8. How to adapt for another domain (8 steps)

```bash
# 1. Fork
git clone https://github.com/jiacpr-arch/firstaid <new-course>
cd <new-course>

# 2. Update package.json name + README

# 3. Replace content (the only required change)
#    - src/courses/firstaid/lessons.js     → src/courses/<id>/lessons.js
#    - src/courses/firstaid/algorithms.js  → ...
#    - src/courses/firstaid/scenarios.js   → ...
#    - src/courses/firstaid/exams.js       → ...

# 4. Update imports (single search-replace)
grep -rl "courses/firstaid" src | xargs sed -i 's|courses/firstaid|courses/<id>|g'

# 5. Re-brand
#    - src/pages/Home.jsx (title, hero text)
#    - src/components/CallEmergencyButton.jsx (เปลี่ยนเบอร์ถ้าไม่ใช่ 1669)
#    - public/manifest.json (PWA name + icons)

# 6. Setup Supabase project ใหม่ → รัน supabase/schema.sql

# 7. Deploy to Vercel → ใส่ env vars

# 8. npm run seed:demo
```

---

## 9. Variations / extensions

| ความต้องการเพิ่ม | จุดที่แตะ |
|-----------------|----------|
| **คะแนนรวมหลายหลักสูตร** | เพิ่มตาราง `course_progress`, dashboard ใหม่ |
| **Multi-instructor / branch office** | เพิ่ม `organizations` + foreign key |
| **e-Signature ในใบประกาศ** | jsPDF + canvas signature |
| **เก็บภาพถ่ายคนเรียน** | Supabase Storage |
| **Notification ก่อนใบประกาศหมดอายุ** | cron + email/SMS |
| **เก็บค่าเรียน (paid)** | Stripe + webhook → unlock cohort |
| **Video lessons** | hosting แยก (Mux/YouTube) — embed ใน step |
| **AI assistant ตอบคำถาม** | RAG บน content + Claude API |

---

## 10. Non-goals (สิ่งที่จงใจไม่ทำในแบบนี้)

- ❌ ไม่ทำ native mobile app — PWA พอ ติดตั้งบน home screen ได้
- ❌ ไม่ทำ video conferencing — ไม่จำเป็นสำหรับ async learning
- ❌ ไม่ทำ social/forum — ลด moderation burden
- ❌ ไม่ทำ ranking/leaderboard — เน้น mastery ไม่ใช่แข่งขัน
- ❌ ไม่บังคับ learner login — ลด friction (ระบุตัวตนตอนเช็คชื่อหน้างานพอ)

---

## 11. Estimated effort to fork for new domain

| งาน | คนเดียว | ทีม 2-3 คน |
|-----|--------|-----------|
| Content authoring (1 หลักสูตร, 20-30 บท) | 3-5 วัน | 1-2 วัน |
| Re-brand + adjust UI | 4 ชม. | 2 ชม. |
| Test + deploy | 4 ชม. | 2 ชม. |
| **รวม** | **~1 สัปดาห์** | **~2-3 วัน** |

---

## 12. References

- Source repo: `jiacpr-arch/firstaid`
- เนื้อหาต้นฉบับ: คู่มือการปฐมพยาบาลเบื้องต้น โดย หมอเจี่ย (Jia1669.com)
- Tech docs: README.md (root), supabase/schema.sql
