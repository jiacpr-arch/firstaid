import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import QRCode from 'qrcode'
import { ArrowLeft, RefreshCw, Download, Users, X } from 'lucide-react'
import { adminFetch } from '../utils/adminFetch'
import { lessons } from '../courses/firstaid/lessons'
import { scenarios } from '../courses/firstaid/scenarios'

// Dashboard ครูผู้สอน: ความคืบหน้าทั้งคลาส (บทเรียน/ควิซ/สอบ/สถานการณ์/เกม/ฐานปฏิบัติ)
// อ่านผ่าน api/cohorts/summary.js (requireAdmin) เพราะตาราง progress เป็น
// service-role only — client อ่านตรงจาก Supabase ไม่ได้

const REFRESH_MS = 30_000

function examCell(exam) {
  if (!exam) return '—'
  return `${exam.score}% ${exam.passed ? '✅' : '✗'}`
}

function exportCsv(learners, sessions, filename) {
  const header = [
    'ชื่อ', 'เบอร์โทร', 'เข้าร่วมเมื่อ', `บทเรียน (จาก ${lessons.length})`, 'ควิซผ่าน',
    'Pre-test', 'Post-test', 'สถานการณ์ผ่าน', 'เกม (คะแนน)',
    ...sessions.map((s) => s.title),
  ]
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = [
    header.map(q).join(','),
    ...learners.map((l) => [
      q(l.name || l.learnerId), q(l.phone || ''),
      q(l.joinedAt ? new Date(l.joinedAt).toLocaleDateString('th-TH') : ''),
      l.lessonsRead, l.quizzesPassed,
      q(l.preTest ? `${l.preTest.score}%` : ''), q(l.postTest ? `${l.postTest.score}%${l.postTest.passed ? ' ผ่าน' : ''}` : ''),
      l.scenariosPassed, l.gameBest ? l.gameBest.score : '',
      ...sessions.map((s) => q(l.attendance?.[s.id] || '')),
    ].join(',')),
  ]
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const ATT_BADGE = {
  approved: ['badge badge-success', 'ผ่าน'],
  pending: ['badge', 'รอ'],
  rejected: ['badge badge-danger', 'ไม่ผ่าน'],
}

export default function AdminCohortDetail() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [qrDataUrl, setQrDataUrl] = useState(null)

  const fetchSummary = useCallback(async () => {
    const resp = await adminFetch(`/api/cohorts/summary?cohortId=${encodeURIComponent(id)}`)
    const body = await resp.json().catch(() => ({}))
    return { ok: resp.ok, body }
  }, [id])

  const load = useCallback(() => (
    fetchSummary()
      .then(({ ok, body }) => {
        if (!ok) { setError(body.error || 'โหลดข้อมูลไม่สำเร็จ'); return }
        setError('')
        setData(body)
      })
      .catch(() => setError('โหลดข้อมูลไม่สำเร็จ — ตรวจการเชื่อมต่อ'))
      .finally(() => setLoading(false))
  ), [fetchSummary])

  useEffect(() => {
    let cancelled = false
    fetchSummary()
      .then(({ ok, body }) => {
        if (cancelled) return
        if (!ok) { setError(body.error || 'โหลดข้อมูลไม่สำเร็จ'); return }
        setError('')
        setData(body)
      })
      .catch(() => { if (!cancelled) setError('โหลดข้อมูลไม่สำเร็จ — ตรวจการเชื่อมต่อ') })
      .finally(() => { if (!cancelled) setLoading(false) })
    const t = setInterval(load, REFRESH_MS)
    return () => { cancelled = true; clearInterval(t) }
  }, [fetchSummary, load])

  const joinUrl = useMemo(() => {
    if (!data?.cohort?.code) return ''
    const base = import.meta.env.VITE_PUBLIC_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '')
    // openExternalBrowser=1 — ถ้าสแกนใน LINE ให้เด้งออก browser จริง (in-app browser แชร์ storage ไม่ได้)
    return `${base}/join/${data.cohort.code}?openExternalBrowser=1`
  }, [data?.cohort?.code])

  useEffect(() => {
    if (!joinUrl) return
    QRCode.toDataURL(joinUrl, { width: 320, margin: 1 }).then(setQrDataUrl).catch(() => {})
  }, [joinUrl])

  const learners = data?.learners || []
  const sessions = data?.sessions || []

  // เอาออกจากคลาส = ลบแค่ enrollment (ความคืบหน้าการเรียนไม่หาย) — ใช้เคลียร์คน
  // join ผิดคลาส หรือแถวซ้ำจากเครื่องเก่าก่อนล็อกอิน LINE
  const removeLearner = async (l) => {
    if (!confirm(`เอา "${l.name || l.learnerId}" ออกจากคลาสนี้?`)) return
    const resp = await adminFetch('/api/cohorts/remove-learner', {
      method: 'POST',
      body: JSON.stringify({ cohortId: id, learnerId: l.learnerId }),
    }).catch(() => null)
    if (!resp?.ok) { alert('เอาออกไม่สำเร็จ — ลองใหม่อีกครั้ง'); return }
    load()
  }

  return (
    <div className="page-container" style={{ maxWidth: 900 }}>
      <Link to="/admin/cohorts" className="btn btn-ghost" style={{ paddingLeft: 0 }}>
        <ArrowLeft size={16} /> กลุ่มผู้เรียน
      </Link>

      {data?.cohort && (
        <>
          <div style={{ marginTop: 4 }}>
            <div className="text-caption">ห้องเรียน</div>
            <div className="text-title">{data.cohort.name}</div>
          </div>

          <div className="card" style={{ marginTop: 12, textAlign: 'center' }}>
            <div className="text-body-strong">รหัสเข้าร่วมคลาส</div>
            <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: 6, color: 'var(--color-brand)' }}>
              {data.cohort.code}
            </div>
            {qrDataUrl && <img src={qrDataUrl} alt="QR เข้าร่วมคลาส" style={{ width: 200, margin: '12px auto 0' }} />}
            <div className="text-caption" style={{ marginTop: 6 }}>
              ให้ผู้เรียนสแกน QR จาก<b>มือถือของตัวเอง</b> หรือเปิด <code>/join</code> แล้วกรอกรหัส
            </div>
          </div>
        </>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 8 }}>
        <div className="text-body-strong" style={{ flex: 1 }}>
          <Users size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          ผู้เรียน {learners.length} คน{data?.capped ? ' (แสดง 200 คนแรก)' : ''}
        </div>
        <button type="button" className="btn btn-secondary" style={{ fontSize: 13 }} onClick={load}>
          <RefreshCw size={14} /> รีเฟรช
        </button>
        {learners.length > 0 && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: 13 }}
            onClick={() => exportCsv(learners, sessions, `cohort-${data?.cohort?.code || id}.csv`)}
          >
            <Download size={14} /> CSV
          </button>
        )}
      </div>

      {error && <div className="callout callout-danger">{error}</div>}
      {loading && <div className="card text-caption">กำลังโหลด…</div>}
      {!loading && !error && learners.length === 0 && (
        <div className="card">
          <div className="text-body-strong">ยังไม่มีผู้เรียนเข้าร่วม</div>
          <div className="text-caption">แชร์ QR หรือรหัสด้านบนให้ผู้เรียนกดเข้าร่วมจากเครื่องตัวเอง</div>
        </div>
      )}

      {learners.length > 0 && (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 720 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '10px 12px' }}>ชื่อ</th>
                <th style={{ padding: '10px 8px' }}>บทเรียน</th>
                <th style={{ padding: '10px 8px' }}>ควิซ</th>
                <th style={{ padding: '10px 8px' }}>Pre</th>
                <th style={{ padding: '10px 8px' }}>Post</th>
                <th style={{ padding: '10px 8px' }}>จำลอง</th>
                <th style={{ padding: '10px 8px' }}>เกม</th>
                {sessions.map((s) => (
                  <th key={s.id} style={{ padding: '10px 8px' }}>{s.title}</th>
                ))}
                <th style={{ padding: '10px 8px' }} aria-label="จัดการ" />
              </tr>
            </thead>
            <tbody>
              {learners.map((l) => (
                <tr key={l.learnerId} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <div className="text-body-strong">{l.name || '(ไม่ระบุชื่อ)'}</div>
                    <div className="text-caption">{l.phone || '—'}</div>
                  </td>
                  <td style={{ padding: '10px 8px' }}>{l.lessonsRead}/{lessons.length}</td>
                  <td style={{ padding: '10px 8px' }}>{l.quizzesPassed}</td>
                  <td style={{ padding: '10px 8px' }}>{examCell(l.preTest)}</td>
                  <td style={{ padding: '10px 8px' }}>{examCell(l.postTest)}</td>
                  <td style={{ padding: '10px 8px' }}>{l.scenariosPassed}/{scenarios.length}</td>
                  <td style={{ padding: '10px 8px' }}>
                    {l.gameBest ? `${l.gameBest.score}${l.gameBest.grade ? ` (${l.gameBest.grade})` : ''}` : '—'}
                  </td>
                  {sessions.map((s) => {
                    const [cls, label] = ATT_BADGE[l.attendance?.[s.id]] || [null, '—']
                    return (
                      <td key={s.id} style={{ padding: '10px 8px' }}>
                        {cls ? <span className={cls}>{label}</span> : label}
                      </td>
                    )
                  })}
                  <td style={{ padding: '10px 8px' }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: 6 }}
                      title="เอาออกจากคลาส"
                      onClick={() => removeLearner(l)}
                    >
                      <X size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-caption" style={{ marginTop: 10 }}>
        อัปเดตอัตโนมัติทุก 30 วินาที — ความคืบหน้าจากเครื่องผู้เรียนใช้เวลา sync ~1 นาที ·
        ผู้เรียนที่ไม่ล็อกอิน LINE ให้ยึดเบอร์โทรเป็นหลักในการระบุตัวตน
      </div>
    </div>
  )
}
