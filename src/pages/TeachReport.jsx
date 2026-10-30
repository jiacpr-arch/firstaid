import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { useClassStore } from '../stores/classStore'
import { adminFetch } from '../utils/adminFetch'
import { buildCohortReport } from '../../api/_lib/cohortReport.js'
import { READINESS } from '../../api/_lib/readiness.js'
import { lessons } from '../courses/firstaid/lessons'
import { markReportPrinted } from '../utils/cohortReportLog'
import Seo from '../components/Seo'

// รายงานประจำรุ่น: รวมผลทั้งคลาสในหน้าเดียว แล้วพิมพ์/บันทึกเป็น PDF ผ่าน window.print()
// สีในแผ่นรายงานตายตัวขาว-ดำ (ไม่อิง theme) เพื่อให้กระดาษออกมาเหมือนกันทุกเครื่อง
const getJson = async (url) => {
  const resp = await adminFetch(url)
  const body = await resp.json().catch(() => ({}))
  return resp.ok ? body : null
}

const dateTh = (iso) => (iso ? new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '-')
const p = (v) => (v == null ? '-' : `${v}%`)
const exam = (e) => (e ? `${e.score}% ${e.passed ? '(ผ่าน)' : '(ไม่ผ่าน)'}` : '-')

const PRINT_CSS = `
.fa-report { background:#fff; color:#111; font-size:13px; line-height:1.5; padding:16px; border-radius:8px; }
.fa-report h1 { font-size:20px; margin:0; }
.fa-report h2 { font-size:15px; margin:18px 0 6px; color:#1d4ed8; }
.fa-report table { width:100%; border-collapse:collapse; margin-top:4px; }
.fa-report th, .fa-report td { border:1px solid #cbd5e1; padding:4px 6px; text-align:left; vertical-align:top; }
.fa-report th { background:#eff6ff; }
.fa-report .kv td:first-child { width:42%; font-weight:700; background:#f8fafc; }
.fa-report .c { text-align:center; }
.fa-report .ok { color:#15803d; font-weight:700; }
.fa-report .warn { color:#b45309; font-weight:700; }
.fa-report .sign { margin-top:36px; text-align:right; line-height:2.2; }
@media print {
  @page { size: A4; margin: 12mm; }
  body * { visibility: hidden; }
  .fa-report, .fa-report * { visibility: visible; }
  .fa-report { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
  .fa-report tr { break-inside: avoid; }
}
`

export default function TeachReport() {
  const { classId, sessionId, className, classCode } = useClassStore()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!classId) return undefined
    let cancelled = false
    Promise.all([
      getJson(`/api/cohorts/summary?cohortId=${encodeURIComponent(classId)}`),
      sessionId ? getJson(`/api/attendance/board?sessionId=${encodeURIComponent(sessionId)}`) : null,
      getJson(`/api/classes/certificates?cohortId=${encodeURIComponent(classId)}`),
    ]).then(([summary, board, certs]) => {
      if (cancelled) return
      if (!summary) { setError('โหลดข้อมูลคลาสไม่สำเร็จ'); return }
      setData({ summary, board, certs })
    }).catch(() => { if (!cancelled) setError('โหลดข้อมูลไม่สำเร็จ — ตรวจการเชื่อมต่อ') })
    return () => { cancelled = true }
  }, [classId, sessionId])

  const report = useMemo(() => (data ? buildCohortReport({
    learners: data.summary.learners || [],
    totalLessons: lessons.length,
    board: data.board,
    certs: data.certs,
  }) : null), [data])

  const print = () => {
    markReportPrinted(classId)
    window.print()
  }

  const back = (
    <Link to="/admin/teach" className="btn btn-ghost" style={{ paddingLeft: 0 }}>
      <ArrowLeft size={16} /> กลับหน้าผู้สอน
    </Link>
  )

  if (!classId) {
    return <div className="page-container">{back}<div className="callout callout-danger">ยังไม่ได้เลือกคลาส</div></div>
  }

  const o = report?.overview
  return (
    <div className="page-container">
      <Seo title="รายงานประจำรุ่น | Jia Training Center" noindex path="/admin/teach/report" />
      <style>{PRINT_CSS}</style>
      {back}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 10px' }}>
        <div className="text-caption" style={{ flex: 1 }}>ตรวจข้อมูลแล้วกดพิมพ์ — เลือก “บันทึกเป็น PDF” เพื่อเก็บไฟล์</div>
        <button type="button" className="btn btn-primary" disabled={!report} onClick={print}>
          <Printer size={16} /> พิมพ์ / บันทึก PDF
        </button>
      </div>
      {error && <div className="callout callout-danger">{error}</div>}
      {!report && !error && <div className="text-caption">กำลังโหลด…</div>}

      {report && (
        <div className="fa-report" data-testid="cohort-report">
          <h1>รายงานประจำรุ่น</h1>
          <div>หลักสูตรปฐมพยาบาล (FirstAid) — Jia Training Center</div>

          <table className="kv" style={{ marginTop: 10 }}>
            <tbody>
              <tr><td>รุ่น / คลาส</td><td>{className || '-'}{classCode ? ` (รหัส ${classCode})` : ''}</td></tr>
              <tr><td>ช่วงวันที่มีกิจกรรม</td><td>{report.period ? `${dateTh(report.period.from)} – ${dateTh(report.period.to)}` : '-'}</td></tr>
              <tr><td>จำนวนผู้เรียน</td><td>{report.total} คน</td></tr>
              <tr><td>ออกรายงานเมื่อ</td><td>{new Date().toLocaleString('th-TH')}</td></tr>
            </tbody>
          </table>

          <h2>1. สรุปภาพรวม</h2>
          <table className="kv">
            <tbody>
              <tr><td>อ่านบทเรียนครบ {report.totalLessons} บท</td><td>{o.lessonsComplete}/{report.total} คน</td></tr>
              <tr><td>Pre-test</td><td>{o.pre.taken ? `สอบ ${o.pre.taken} คน · ผ่าน ${o.pre.passed} (${p(o.pre.passRate)}) · เฉลี่ย ${p(o.pre.avg)} · ต่ำสุด ${p(o.pre.min)} · สูงสุด ${p(o.pre.max)}` : 'ยังไม่มีผู้สอบ'}</td></tr>
              <tr><td>Post-test</td><td>{o.post.taken ? `สอบ ${o.post.taken} คน · ผ่าน ${o.post.passed} (${p(o.post.passRate)}) · เฉลี่ย ${p(o.post.avg)} · ต่ำสุด ${p(o.post.min)} · สูงสุด ${p(o.post.max)}` : 'ยังไม่มีผู้สอบ'}</td></tr>
              {o.avgImprovement != null && <tr><td>พัฒนาการ Pre → Post</td><td>เฉลี่ย {o.avgImprovement > 0 ? '+' : ''}{o.avgImprovement} คะแนน · ดีขึ้น {o.improvedCount} คน</td></tr>}
              <tr><td>พร้อมเข้าอบรม (Post-test ผ่าน)</td><td>{o.ready}/{report.total} คน</td></tr>
              {report.hasPractical && <tr><td>มาวันอบรมภาคปฏิบัติ</td><td>{o.attended}/{report.total} คน</td></tr>}
              {o.practicalComplete != null && <tr><td>ภาคปฏิบัติครบ (ทุกฐาน + สอบผ่าน)</td><td>{o.practicalComplete}/{report.total} คน</td></tr>}
              {report.hasCerts && <tr><td>ได้ใบประกาศ ทฤษฎี / ปฏิบัติ</td><td>{o.theoryCerts} / {o.practicalCerts} คน</td></tr>}
              <tr><td>ผ่านครบทุกเงื่อนไข</td><td>{o.complete}/{report.total} คน</td></tr>
            </tbody>
          </table>

          <h2>2. ภาคปฏิบัติ (สถานีฝึก/สอบ)</h2>
          {report.hasPractical ? (
            <table>
              <thead><tr><th>ฐาน</th><th className="c">ประเภท</th><th className="c">มาแล้ว</th><th className="c">ผ่าน</th><th className="c">ไม่ผ่าน</th><th className="c">รอผล</th></tr></thead>
              <tbody>
                {report.stationStats.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td><td className="c">{s.kind === 'exam' ? 'สอบ' : 'ฝึก'}</td><td className="c">{s.came}/{report.total}</td>
                    <td className="c">{s.kind === 'exam' ? s.passed : '-'}</td><td className="c">{s.kind === 'exam' ? s.failed : '-'}</td><td className="c">{s.kind === 'exam' ? s.awaiting : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div>ยังไม่ได้ตั้งสถานีฝึก/สอบในรุ่นนี้</div>}

          <h2>3. ผลรายบุคคล</h2>
          <table>
            <thead>
              <tr>
                <th className="c">#</th><th>ชื่อ-สกุล</th><th className="c">บทเรียน</th><th className="c">Pre</th><th className="c">Post</th>
                {report.hasPractical && <th className="c">ฐาน</th>}
                {report.hasCerts && <th className="c">ใบประกาศ</th>}
                <th className="c">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {report.students.map((s, i) => (
                <tr key={s.learnerId}>
                  <td className="c">{i + 1}</td>
                  <td>{s.name || '(ไม่ระบุชื่อ)'}{s.group ? ` · ${s.group}` : ''}</td>
                  <td className="c">{s.lessonsRead}/{report.totalLessons}</td>
                  <td className="c">{exam(s.pre)}</td>
                  <td className="c">{exam(s.post)}</td>
                  {report.hasPractical && <td className="c">{s.attended ? `${s.stationsDone}/${report.stationStats.length}` : 'ไม่มา'}</td>}
                  {report.hasCerts && <td className="c">{s.theoryCert ? 'ท' : '-'} / {s.practicalCert ? 'ป' : '-'}</td>}
                  <td className={`c ${s.complete ? 'ok' : 'warn'}`}>{s.complete ? 'ครบ' : READINESS[s.readiness].label}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {report.students.some((s) => !s.complete) && (
            <>
              <h2>4. ผู้เรียนที่ยังไม่ครบ — สิ่งที่ต้องติดตาม</h2>
              <table>
                <thead><tr><th>ชื่อ-สกุล</th><th>เบอร์โทร</th><th>ยังขาด</th></tr></thead>
                <tbody>
                  {report.students.filter((s) => !s.complete).map((s) => (
                    <tr key={s.learnerId}><td>{s.name || '(ไม่ระบุชื่อ)'}</td><td>{s.phone || '-'}</td><td>{s.missing.join(' · ')}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div className="sign">
            ลงชื่อ ........................................................ ผู้สอน<br />
            ( ........................................................ )<br />
            วันที่ ............ / ............ / ............
          </div>
        </div>
      )}
    </div>
  )
}
