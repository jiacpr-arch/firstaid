// Validation + จัดอันดับสำหรับผลเกม FIRST AID HERO — แยกเป็น pure functions ให้เทสต์ได้

const DIFFICULTIES = new Set(['easy', 'normal', 'hard'])
const GRADES = new Set(['S', 'A', 'B', 'C'])
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// scenario id ของเกมทั้งหมดขึ้นต้น fa- (ดู src/courses/firstaid/game/) — กัน payload มั่ว
const SCENARIO_RE = /^fa-[a-z0-9-]{1,40}$/

function intIn(value, min, max) {
  const n = Number(value)
  return Number.isInteger(n) && n >= min && n <= max ? n : null
}

// ตรวจ + ทำความสะอาด payload หนึ่งผลเกม — คืน { row } พร้อม insert หรือ { error }
export function validateGameResult(body, learnerId) {
  if (!UUID_RE.test(body?.uuid || '')) return { error: 'invalid uuid' }
  if (!UUID_RE.test(learnerId || '')) return { error: 'invalid learnerId' }
  if (!SCENARIO_RE.test(body?.scenarioId || '')) return { error: 'invalid scenarioId' }
  const difficulty = DIFFICULTIES.has(body?.difficulty) ? body.difficulty : 'normal'
  const grade = GRADES.has(body?.grade) ? body.grade : null
  const score = intIn(body?.score, 0, 1000)
  if (score === null) return { error: 'invalid score' }
  const name = String(body?.displayName ?? '')
    .replace(/\p{Cc}+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)
  return {
    row: {
      uuid: body.uuid.toLowerCase(),
      learner_id: learnerId,
      display_name: name || null,
      scenario_id: body.scenarioId,
      difficulty,
      won: body?.won === true,
      grade,
      score,
      wrong: intIn(body?.wrong, 0, 99),
      duration_seconds: intIn(body?.durationSeconds, 0, 21600),
      finished_at: typeof body?.finishedAt === 'string' && !Number.isNaN(Date.parse(body.finishedAt))
        ? body.finishedAt
        : new Date().toISOString(),
    },
  }
}

// จัดอันดับ: รับแถวที่ชนะแล้วเรียงคะแนนมากไปน้อย — เก็บคะแนนดีสุดต่อผู้เล่น 1 แถว
// (arcade board: คนเดียวกันไม่ยึดหลายอันดับ) แล้วตัด top N
export function rankLeaderboard(rows, { limit = 20, youLearnerId = null } = {}) {
  const seen = new Set()
  const out = []
  for (const r of rows) {
    if (seen.has(r.learner_id)) continue
    seen.add(r.learner_id)
    out.push({
      rank: out.length + 1,
      name: r.display_name || 'ผู้เล่นนิรนาม',
      score: r.score,
      scenarioId: r.scenario_id,
      difficulty: r.difficulty,
      grade: r.grade,
      you: !!youLearnerId && r.learner_id === youLearnerId,
    })
    if (out.length >= limit) break
  }
  return out
}
