import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, RefreshCw, CheckCircle2, Circle, AlertTriangle } from 'lucide-react'
import { adminFetch } from '../utils/adminFetch'
import { classFetch } from '../utils/instructorFetch'
import { lessons } from '../courses/firstaid/lessons'
import { scenarios } from '../courses/firstaid/scenarios'
import { computeGaps } from '../../api/_lib/learnerDetail.js'
import { READINESS, classifyReadiness } from '../../api/_lib/readiness.js'

// รายละเอียดต่อนักเรียน (เปิดจากตารางในหน้าคลาส): เรียนออนไลน์ถึงไหน สอบผ่านหรือยัง
// ฐานปฏิบัติครบไหม ใบเซอร์ออกหรือยัง — อ่านผ่าน api/cohorts/learner.js (requireAdmin)

const dt = (iso) => (iso
  ? new Date(iso).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '—')

function Bar({ value, total }) {
  const pct = total ? Math.round((value / total) * 100) : 0
  return (
    <div style={{ height: 8, borderRadius: 4, background: 'var(--color-border, #e5e7eb)', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--color-brand)' }} />
    </div>
  )
}

function Stat({ label, value, total }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span className="text-body">{label}</span>
        <span className="text-body-strong">{value}/{total}</span>
      </div>
      <Bar value={value} total={total} />
    </div>
  )
}

function ExamRow({ label, attempts }) {
  const best = attempts.length ? attempts.reduce((a, b) => (b.score > a.score ? b : a)) : null
  return (
    <div style={{ padding: '8px 0', borderTop: '1px solid var(--color-border, #e5e7eb)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span className="text-body-strong">{label}</span>
        {best
          ? <span className={best.passed ? 'badge badge-success' : 'badge badge-danger'}>ดีที่สุด {best.score}% {best.passed ? 'ผ่าน' : 'ยังไม่ผ่าน'}</span>
          : <span className="text-caption">ยังไม่ได้สอบ</span>}
      </div>
      {attempts.length > 1 && (
        <div className="text-caption" style={{ marginTop: 2 }}>
          {attempts.length} ครั้ง: {attempts.map((a) => `${a.score}%`).join(' → ')} (ล่าสุดก่อน)
        </div>
      )}
    </div>
  )
}

export default function AdminLearnerDetail({ teach = null }) {
  const params = useParams()
  // teach = เปิดจากหน้าผู้สอน (/teach) ด้วยรหัสผู้สอน: { cohortId, instructorCode }
  const id = teach?.cohortId ?? params.id
  const learnerId = params.learnerId
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchDetail = useCallback(async () => {
    const q = `cohortId=${encodeURIComponent(id)}&learnerId=${encodeURIComponent(learnerId)}`
    const url = `/api/cohorts/learner?${q}`
    const resp = teach ? await classFetch(teach.instructorCode, url) : await adminFetch(url)
    const body = await resp.json().catch(() => ({}))
    return { ok: resp.ok, body }
  }, [id, learnerId, teach])

  const load = useCallback(() => {
    setLoading(true)
    return fetchDetail()
      .then(({ ok, body }) => {
        if (!ok) { setError(body.error || 'โหลดข้อมูลไม่สำเร็จ'); return }
        setError('')
        setData(body)
      })
      .catch(() => setError('โหลดข้อมูลไม่สำเร็จ — ตรวจการเชื่อมต่อ'))
      .finally(() => setLoading(false))
  }, [fetchDetail])

  useEffect(() => {
    let cancelled = false
    fetchDetail()
      .then(({ ok, body }) => {
        if (cancelled) return
        if (!ok) { setError(body.error || 'โหลดข้อมูลไม่สำเร็จ'); return }
        setData(body)
      })
      .catch(() => { if (!cancelled) setError('โหลดข้อมูลไม่สำเร็จ — ตรวจการเชื่อมต่อ') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [fetchDetail])

  const gaps = useMemo(
    () => (data ? computeGaps(data, { lessonIds: lessons.map((l) => l.id), scenarioIds: scenarios.map((s) => s.id) }) : null),
    [data],
  )

  const back = (
    <Link to={teach ? '/teach' : `/admin/cohorts/${id}`} className="btn btn-ghost" style={{ paddingLeft: 0 }}>
      <ArrowLeft size={16} /> {teach ? 'กลับหน้าผู้สอน' : 'กลับหน้าคลาส'}
    </Link>
  )

  if (error) return <div className="page-container">{back}<div className="callout callout-danger" style={{ marginTop: 12 }}>{error}</div></div>
  if (loading && !data) return <div className="page-container">{back}<div className="card text-caption">กำลังโหลด…</div></div>
  if (!data) return <div className="page-container">{back}</div>

  const read = new Set(data.lessons.readIds)
  const quiz = new Set(data.lessons.quizPassedIds)
  const passedScen = new Set(data.scenariosPassedIds)
  const allGaps = gaps.lessonsUnread.length + gaps.quizzesNotPassed.length + gaps.scenariosNotPassed.length
    + gaps.stationsMissing.length + gaps.examStationsNotPassed.length
    + (gaps.preTestMissing ? 1 : 0) + (gaps.postTestMissing ? 1 : 0)
  const { learner, certificates } = data
  const bestPost = data.exams.post.length ? data.exams.post.reduce((a, b) => (b.score > a.score ? b : a)) : null
  const readiness = classifyReadiness(
    {
      lessonsRead: read.size,
      quizzesPassed: quiz.size,
      preTest: data.exams.pre.length ? { score: 0, passed: false } : null,
      postTest: bestPost ? { score: bestPost.score, passed: data.exams.post.some((e) => e.passed) } : null,
      scenariosPassed: passedScen.size,
      gameBest: data.game,
    },
    { totalLessons: lessons.length },
  )
  const readinessMeta = READINESS[readiness.status]

  return (
    <div className="page-container">
      {back}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 4 }}>
        <div style={{ flex: 1 }}>
          <div className="text-caption">{data.cohort?.name}</div>
          <div className="text-title">{learner.name || '(ไม่ระบุชื่อ)'}</div>
          <div className="text-caption">
            {learner.phone || '—'} · เข้าร่วม {dt(learner.joinedAt)} · ใช้งานล่าสุด {dt(learner.lastActivity)}
          </div>
        </div>
        <button type="button" className="btn btn-ghost" onClick={load} aria-label="รีเฟรช"><RefreshCw size={16} /></button>
      </div>

      <div className="card" style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className={readinessMeta.tone === 'success' ? 'badge badge-success' : readinessMeta.tone === 'warning' ? 'badge badge-warning' : 'badge'}>
          ความพร้อมเข้าอบรม: {readinessMeta.label}
        </span>
        <span className={certificates.theory ? 'badge badge-success' : 'badge'}>
          ใบเซอร์ทฤษฎี: {certificates.theory ? `ออกแล้ว (${certificates.theory.code})` : 'ยังไม่ออก'}
        </span>
        <span className={certificates.practical ? 'badge badge-success' : 'badge'}>
          ใบเซอร์ภาคปฏิบัติ: {certificates.practical ? `ออกแล้ว (${certificates.practical.code})` : 'ยังไม่ออก'}
        </span>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="text-body-strong">ภาพรวมการเรียน</div>
        <Stat label="บทเรียนที่อ่านแล้ว" value={read.size} total={lessons.length} />
        <Stat label="ควิซที่ผ่าน" value={quiz.size} total={lessons.length} />
        <Stat label="สถานการณ์จำลองที่ผ่าน" value={passedScen.size} total={scenarios.length} />
        {data.game && (
          <div className="text-caption" style={{ marginTop: 10 }}>
            เกมคะแนนดีที่สุด {data.game.score}{data.game.grade ? ` (${data.game.grade})` : ''}{data.game.won ? ' · ชนะ' : ''}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="text-body-strong" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {allGaps === 0 ? <CheckCircle2 size={16} color="#347053" /> : <AlertTriangle size={16} color="#b45309" />}
          {allGaps === 0 ? 'ครบทุกอย่างแล้ว' : 'ยังขาดอะไรบ้าง'}
        </div>
        <ul className="text-body" style={{ margin: '6px 0 0 18px', padding: 0 }}>
          {gaps.preTestMissing && <li>ยังไม่ได้ทำ Pre-test</li>}
          {gaps.lessonsUnread.length > 0 && <li>ยังไม่ได้อ่าน {gaps.lessonsUnread.length} บทเรียน</li>}
          {gaps.quizzesNotPassed.length > 0 && <li>อ่านแล้วแต่ควิซยังไม่ผ่าน {gaps.quizzesNotPassed.length} บท</li>}
          {gaps.scenariosNotPassed.length > 0 && <li>สถานการณ์จำลองยังไม่ผ่าน {gaps.scenariosNotPassed.length} จาก {scenarios.length}</li>}
          {gaps.postTestMissing && <li>ยังไม่ได้ทำ Post-test</li>}
          {gaps.stationsMissing.map((s) => <li key={`m-${s.sessionId}-${s.name}`}>ยังไม่ได้เช็คชื่อฐาน “{s.name}”</li>)}
          {gaps.examStationsNotPassed.map((s) => <li key={`e-${s.sessionId}-${s.name}`}>ฐานสอบ “{s.name}” ยังไม่ผ่าน</li>)}
        </ul>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="text-body-strong">ผลสอบออนไลน์</div>
        <ExamRow label="Pre-test" attempts={data.exams.pre} />
        <ExamRow label="Post-test" attempts={data.exams.post} />
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="text-body-strong">ภาคปฏิบัติ</div>
        {data.sessions.length === 0 && <div className="text-caption" style={{ marginTop: 4 }}>คลาสนี้ยังไม่มีรอบอบรม</div>}
        {data.sessions.map((s) => (
          <div key={s.id} style={{ padding: '8px 0', borderTop: '1px solid var(--color-border, #e5e7eb)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              {teach
                ? <span className="text-body-strong">{s.title}</span>
                : <Link to={`/admin/sessions/${s.id}`} className="text-body-strong">{s.title}</Link>}
              <span className="text-caption">
                {s.attendance ? `เช็คชื่อ ${dt(s.attendance.checkedInAt)}` : 'ยังไม่ได้เช็คชื่อ'}
              </span>
            </div>
            {s.stations.map((st) => {
              const done = !!st.checkedInAt
              return (
                <div key={st.id} className="text-body" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  {done ? <CheckCircle2 size={15} color="#347053" /> : <Circle size={15} color="#9ca3af" />}
                  <span style={{ flex: 1 }}>{st.name}</span>
                  {st.kind === 'exam' && done && (
                    <span className={st.passed === true ? 'badge badge-success' : st.passed === false ? 'badge badge-danger' : 'badge'}>
                      {st.passed === true ? 'ผ่าน' : st.passed === false ? 'ไม่ผ่าน' : 'รอผล'}{st.score != null ? ` · ${st.score}` : ''}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 12, marginBottom: 24 }}>
        <div className="text-body-strong">รายบทเรียน</div>
        {lessons.map((l) => (
          <div key={l.id} className="text-body" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderTop: '1px solid var(--color-border, #e5e7eb)' }}>
            {read.has(l.id) ? <CheckCircle2 size={15} color="#347053" /> : <Circle size={15} color="#9ca3af" />}
            <span style={{ flex: 1 }}>{l.title}</span>
            {read.has(l.id) && (
              <span className={quiz.has(l.id) ? 'badge badge-success' : 'badge'}>ควิซ {quiz.has(l.id) ? 'ผ่าน' : 'ยังไม่ผ่าน'}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
