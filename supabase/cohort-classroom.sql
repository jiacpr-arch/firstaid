-- ระบบห้องเรียน (คลาส) — นักเรียน join ด้วยรหัสคลาส + dashboard ครูดูความคืบหน้า
--
-- ไม่มีตาราง/คอลัมน์ใหม่ — ใช้ cohorts/enrollments/practical_sessions/attendance เดิม
-- เพิ่มเฉพาะ index บน learner_id เพื่อให้ api/cohorts/summary.js query แบบ
-- .in('learner_id', ids) ได้เร็วเมื่อข้อมูล progress โตขึ้น
-- เขียน enrollments ผ่าน api/cohorts/join.js (service role) เท่านั้น — RLS เปิดไว้
-- โดยไม่มี policy (client อ่าน/เขียนตรงไม่ได้) ตาม convention เดิมของ schema.sql
create index if not exists idx_enrollments_learner on enrollments(learner_id);
create index if not exists idx_lesson_progress_learner on lesson_progress(learner_id);
create index if not exists idx_quiz_attempts_learner on quiz_attempts(learner_id);
create index if not exists idx_exam_attempts_learner on exam_attempts(learner_id);
create index if not exists idx_sim_runs_learner on simulation_runs(learner_id);
