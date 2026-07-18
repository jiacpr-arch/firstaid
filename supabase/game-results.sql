-- ผลเกม FIRST AID HERO (โหมดเกมโบนัส /game)
-- ใช้แล้วกับโปรเจกต์ jia-unified เมื่อ ก.ค. 2569 — เก็บไฟล์ไว้เป็น record/rerun ได้
--
-- เขียนผ่าน api/game/submit.js (service role) เท่านั้น — RLS เปิดไว้โดยไม่มี policy
-- (client ไม่มีสิทธิ์อ่าน/เขียนตรง) อ่านผ่าน api/game/leaderboard.js เพื่อทำอันดับผู้เล่น
create table if not exists public.game_results (
  uuid uuid primary key,
  learner_id uuid not null,
  display_name text,
  scenario_id text not null,
  difficulty text not null default 'normal',
  won boolean not null default false,
  grade text,
  score integer not null default 0,
  wrong integer,
  duration_seconds integer,
  finished_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.game_results enable row level security;

create index if not exists game_results_score_idx on public.game_results (won, score desc);
create index if not exists game_results_learner_idx on public.game_results (learner_id);
