import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'
import { ArrowLeft, Check, Copy, LogOut, QrCode, RefreshCw, ScanLine } from 'lucide-react'
import ClassOverview from '../components/teach/ClassOverview'
import Seo from '../components/Seo'
import { setInstructorCode } from '../utils/instructorFetch'

// หน้าผู้สอนภายนอก (/class): ใส่รหัสผู้สอน 8 ตัวของคลาส แล้วดูความพร้อมของนักเรียนทั้งคลาส
// ไม่มีบัญชีแอดมิน — สิทธิ์มาจากรหัส (api/cohorts/summary.js ทางเข้า X-Instructor-Code) อ่านอย่างเดียว
// รหัสเก็บใน sessionStorage (ปิดแท็บแล้วต้องใส่ใหม่) — ลิงก์ ?code= จากแอดมินกรอกให้แล้วลบออกจาก URL
const KEY = 'fa.classInstructorCode'
const REFRESH_MS = 60_000
const readCode = () => { try { return sessionStorage.getItem(KEY) || '' } catch { return '' } }
const saveCode = (c) => { try { if (c) sessionStorage.setItem(KEY, c); else sessionStorage.removeItem(KEY) } catch { /* ignore */ } }

function takeCodeFromUrl() {
  try {
    const url = new URL(window.location.href)
    const c = url.searchParams.get('code')
    if (!c) return ''
    url.searchParams.delete('code')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
    return c.trim().toUpperCase()
  } catch { return '' }
}

export default function InstructorClass() {
  const [code, setCode] = useState(() => takeCodeFromUrl() || readCode())
  const [input, setInput] = useState('')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [qr, setQr] = useState('')
  const [copied, setCopied] = useState(false)

  // ดึงข้อมูลเฉย ๆ (ไม่แตะ state) แล้วให้ apply ตัดสิน — แบบเดียวกับหน้า /admin/teach
  const fetchSummary = useCallback(async (c) => {
    const resp = await fetch('/api/cohorts/summary', { headers: { 'X-Instructor-Code': c }, cache: 'no-store' })
    const body = await resp.json().catch(() => ({}))
    return { ok: resp.ok, status: resp.status, body, code: c }
  }, [])

  const apply = useCallback(({ ok, status, body, code: c }) => {
    if (ok) {
      saveCode(c)
      setError('')
      setData(body)
      // ให้ปุ่ม "สแกนเช็คชื่อ" เข้าได้ทันทีโดยไม่ต้องใส่รหัสซ้ำ (InstructorScan อ่านจาก sessionStorage เดียวกัน)
      if (body.sessionId) setInstructorCode(body.sessionId, c)
      return
    }
    setData(null)
    if (status === 403 || status === 404) { saveCode(''); setCode('') }
    setError(status === 429 ? 'ลองบ่อยเกินไป รอสักครู่แล้วลองใหม่' : (body.error || 'โหลดข้อมูลคลาสไม่สำเร็จ ลองใหม่อีกครั้ง'))
  }, [])

  const offline = 'เชื่อมต่อไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'

  useEffect(() => {
    if (!code) return undefined
    let cancelled = false
    const run = () => fetchSummary(code)
      .then((r) => { if (!cancelled) apply(r) })
      .catch(() => { if (!cancelled) setError(offline) })
    run()
    const t = setInterval(run, REFRESH_MS)
    return () => { cancelled = true; clearInterval(t) }
  }, [code, fetchSummary, apply])

  const reload = (c = code) => {
    setLoading(true)
    fetchSummary(c).then(apply).catch(() => setError(offline)).finally(() => setLoading(false))
  }
  const opening = !!code && !data && !error

  const classCode = data?.cohort?.code || ''
  const joinUrl = classCode ? `${window.location.origin}/join/${classCode}?openExternalBrowser=1` : ''
  useEffect(() => {
    if (!joinUrl) return
    QRCode.toDataURL(joinUrl, { width: 480, margin: 1 }).then(setQr).catch(() => {})
  }, [joinUrl])

  const submit = (e) => {
    e.preventDefault()
    const c = input.trim().toUpperCase().replace(/[\s-]/g, '')
    if (c.length !== 8) { setError('รหัสผู้สอนมี 8 ตัว (ตัวอักษรและตัวเลข)'); return }
    setInput('')
    setError('')
    if (c === code) reload(c)
    else setCode(c)
  }
  const signOut = () => { saveCode(''); setCode(''); setData(null); setQr('') }
  const copyJoin = async () => {
    try { await navigator.clipboard.writeText(joinUrl); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  return (
    <div className="page-container" data-testid="instructor-class-page">
      <Seo title="หน้าผู้สอน | FirstAid Morroo" path="/class" description="ผู้สอนดูความพร้อมของนักเรียนทั้งคลาสด้วยรหัสผู้สอน" noindex />
      <Link to="/instructors" className="text-caption" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <ArrowLeft size={16} /> สำหรับผู้สอน
      </Link>
      <div className="text-eyebrow" style={{ marginTop: 8 }}>หน้าผู้สอน</div>

      {!data && (
        <>
          <h1 className="text-display">ดูผลนักเรียนในคลาส</h1>
          <p className="text-caption" style={{ marginTop: 4 }}>
            ใส่รหัสผู้สอน 8 ตัวที่ได้รับจากทีม JIA ทาง LINE ไม่ต้องสมัครสมาชิก
          </p>
          <form onSubmit={submit} className="card" style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label htmlFor="instructor-code" className="text-body-strong">รหัสผู้สอน</label>
            <input id="instructor-code" className="input" value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="เช่น ABCD2345" autoComplete="off" autoCapitalize="characters" maxLength={12}
              style={{ fontSize: 20, letterSpacing: 3, textTransform: 'uppercase' }} data-testid="instructor-code-input" />
            <button type="submit" className="btn btn-primary btn-block" disabled={opening || loading || !input.trim()} data-testid="instructor-code-submit">
              {opening || loading ? 'กำลังเปิดคลาส…' : 'เปิดคลาส'}
            </button>
          </form>
          {opening && <div className="text-caption" style={{ marginTop: 10 }}>กำลังโหลดข้อมูลคลาส…</div>}
          {error && <div className="callout callout-danger" style={{ marginTop: 10 }} data-testid="instructor-class-error">{error}</div>}
          <p className="text-caption" style={{ marginTop: 12 }}>
            ยังไม่มีคลาส? <Link to="/instructors" style={{ fontWeight: 700 }}>ดูแพ็กเกจและขอเปิดคลาส</Link>
          </p>
        </>
      )}

      {data && (
        <>
          <h1 className="text-display" data-testid="instructor-class-name">{data.cohort?.name}</h1>
          <p className="text-caption" style={{ marginTop: 4 }}>
            นักเรียนในคลาส {data.learners?.length || 0} คน{data.capped ? ' (แสดง 200 คนแรก)' : ''} · อัปเดตอัตโนมัติทุก 1 นาที
          </p>

          <div className="card" style={{ marginTop: 12, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            {qr && <img src={qr} alt={`QR เข้าคลาส ${classCode}`} width="132" height="132" style={{ borderRadius: 8, flexShrink: 0 }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="text-body-strong" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><QrCode size={16} /> ให้นักเรียนสแกนเข้าคลาส</div>
              <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 4, marginTop: 4 }} data-testid="instructor-class-code">{classCode}</div>
              <div className="text-caption">หรือเข้าที่ firstaid.morroo.com/join แล้วใส่รหัสนี้</div>
              <button type="button" className="btn btn-secondary" style={{ fontSize: 13, marginTop: 8 }} onClick={copyJoin}>
                {copied ? <Check size={14} /> : <Copy size={14} />} คัดลอกลิงก์เข้าคลาส
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {data.sessionId && (
              <Link to={`/scan/${data.sessionId}`} className="btn btn-primary" style={{ fontSize: 14 }} data-testid="instructor-class-scan">
                <ScanLine size={16} /> สแกนเช็คชื่อวันอบรม
              </Link>
            )}
            <button type="button" className="btn btn-secondary" style={{ fontSize: 14 }} disabled={loading} onClick={() => reload()}>
              <RefreshCw size={16} /> {loading ? 'กำลังโหลด…' : 'โหลดใหม่'}
            </button>
            <button type="button" className="btn btn-ghost" style={{ fontSize: 14, marginLeft: 'auto' }} onClick={signOut}>
              <LogOut size={16} /> ออกจากคลาส
            </button>
          </div>
          {error && <div className="callout callout-danger" style={{ marginTop: 10 }}>{error}</div>}

          <ClassOverview learners={data.learners || []} classId={data.cohort?.id} classCode={classCode}
            includesCpr={!!data.cohort?.includesCpr} readOnly />

          <p className="text-caption" style={{ marginTop: 14 }}>
            เห็นเบอร์นักเรียนแค่ 4 ตัวท้าย · ต้องการรายงานประจำรุ่นหรือแก้ชื่อนักเรียน ทัก LINE @jiacpr
          </p>
        </>
      )}
    </div>
  )
}
