import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Upload, Copy, Check, Image as ImageIcon, Film } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../config/supabaseClient'
import { uploadMedia } from '../utils/mediaUpload'

const BUCKET = 'lesson-media'

// สร้างโค้ด step สำหรับวางใน lessons.js
function snippetFor(kind, url) {
  if (kind === 'image') {
    return `{ type: 'image', src: '${url}',\n  alt: 'คำอธิบายรูป', caption: 'ข้อความใต้รูป' },`
  }
  return `{ type: 'video', src: '${url}',\n  caption: 'คำอธิบายวิดีโอ' },`
}

const publicUrl = (path) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

// ดึงรายการไฟล์ที่อัปไว้แล้ว (ไม่แตะ state — ให้ผู้เรียกนำไป setState เอง)
async function fetchMedia() {
  if (!isSupabaseConfigured) return []
  const all = []
  for (const folder of ['images', 'videos']) {
    const { data } = await supabase.storage.from(BUCKET).list(folder, {
      limit: 100, sortBy: { column: 'created_at', order: 'desc' },
    })
    for (const f of data || []) {
      if (f.name.startsWith('.')) continue
      const path = `${folder}/${f.name}`
      all.push({ name: f.name, url: publicUrl(path), kind: folder === 'images' ? 'image' : 'video' })
    }
  }
  return all
}

export default function AdminMedia() {
  const [items, setItems] = useState([]) // { name, url, kind }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    fetchMedia().then((data) => { if (!cancelled) setItems(data) })
    return () => { cancelled = true }
  }, [])

  const upload = async (fileList) => {
    if (!isSupabaseConfigured) return
    setError('')
    setBusy(true)
    const uploaded = []
    for (const file of Array.from(fileList)) {
      try {
        const { url, kind, name } = await uploadMedia(file)
        uploaded.push({ name, url, kind })
      } catch (e) {
        setError(e.message)
      }
    }
    setBusy(false)
    if (uploaded.length) setItems((prev) => [...uploaded, ...prev])
    if (inputRef.current) inputRef.current.value = ''
  }

  const copy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied((c) => (c === key ? '' : c)), 1500)
    } catch {
      setError('คัดลอกไม่สำเร็จ — กดค้างที่ข้อความเพื่อคัดลอกเอง')
    }
  }

  return (
    <div className="page-container">
      <Link to="/admin" className="btn btn-ghost" style={{ paddingLeft: 0 }}>
        <ArrowLeft size={16} /> หน้าควบคุม
      </Link>
      <div style={{ marginTop: 4 }}>
        <div className="text-caption">จัดการ</div>
        <div className="text-title">อัปโหลดสื่อบทเรียน</div>
      </div>

      {!isSupabaseConfigured && (
        <div className="callout callout-info" style={{ marginTop: 12 }}>
          ยังไม่ได้เชื่อมต่อ Supabase — ตั้งค่า VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ก่อน
        </div>
      )}

      <div className="card" style={{ marginTop: 12 }}>
        <label className="label">เลือกรูปหรือวิดีโอ (เลือกหลายไฟล์ได้)</label>
        <input
          ref={inputRef}
          className="input"
          type="file"
          accept="image/*,video/*"
          multiple
          disabled={!isSupabaseConfigured || busy}
          onChange={(e) => e.target.files?.length && upload(e.target.files)}
        />
        <div className="text-caption" style={{ marginTop: 8 }}>
          อัปขึ้น Supabase Storage แล้วได้ URL ไปวางใน step ของบทเรียน (lessons.js)
        </div>
        {busy && <div className="text-caption" style={{ marginTop: 8 }}><Upload size={14} /> กำลังอัปโหลด…</div>}
        {error && <div className="callout callout-danger" style={{ marginTop: 10 }}>{error}</div>}
      </div>

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((it) => {
          const snippet = snippetFor(it.kind, it.url)
          return (
            <div key={it.url} className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {it.kind === 'image'
                  ? <img src={it.url} alt={it.name} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--color-border)' }} />
                  : <div style={{ width: 56, height: 56, borderRadius: 8, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Film size={22} color="#fff" /></div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="text-body-strong" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {it.kind === 'image' ? <ImageIcon size={14} /> : <Film size={14} />} {it.name}
                  </div>
                  <div className="text-caption" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.url}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => copy(it.url, it.url + ':url')}>
                  {copied === it.url + ':url' ? <Check size={14} /> : <Copy size={14} />} คัดลอก URL
                </button>
                <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={() => copy(snippet, it.url + ':snip')}>
                  {copied === it.url + ':snip' ? <Check size={14} /> : <Copy size={14} />} คัดลอกโค้ด step
                </button>
              </div>
            </div>
          )
        })}
        {isSupabaseConfigured && !items.length && !busy && (
          <div className="text-caption" style={{ textAlign: 'center', padding: 12 }}>ยังไม่มีไฟล์ที่อัปโหลด</div>
        )}
      </div>
    </div>
  )
}
