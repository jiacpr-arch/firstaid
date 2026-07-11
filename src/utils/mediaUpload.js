import { supabase } from '../config/supabaseClient'
import { adminFetch } from './adminFetch'

export const BUCKET = 'lesson-media'

// ชื่อไฟล์ปลอดภัย: ตัวเล็ก อักขระพิเศษ → '-' กันชนกันด้วย timestamp
export function safeName(name) {
  const dot = name.lastIndexOf('.')
  const base = (dot > 0 ? name.slice(0, dot) : name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const ext = (dot > 0 ? name.slice(dot + 1) : '').toLowerCase().replace(/[^a-z0-9]/g, '')
  return `${Date.now()}-${base || 'file'}${ext ? '.' + ext : ''}`
}

export function kindOf(file) {
  if (file.type?.startsWith('image/')) return 'image'
  if (file.type?.startsWith('video/')) return 'video'
  return file.name?.match(/\.(png|jpe?g|webp|gif|svg)$/i) ? 'image'
    : file.name?.match(/\.(mp4|webm|mov|m4v)$/i) ? 'video' : 'other'
}

export function publicUrl(path) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

// อัปไฟล์ขึ้น Storage แล้วคืน { url, kind, name } — โยน Error ถ้าไม่ใช่รูป/วิดีโอ หรืออัปไม่ผ่าน
// ขอ signed upload URL จาก API (requireAdmin) ก่อน แล้วอัปตรงขึ้น Storage —
// bucket ปิด RLS ฝั่งเขียนแล้ว จึงอัปด้วย anon key ตรงๆ ไม่ได้อีก
export async function uploadMedia(file) {
  const kind = kindOf(file)
  if (kind === 'other') throw new Error(`ไฟล์ "${file.name}" ไม่ใช่รูปหรือวิดีโอ`)
  const path = `${kind === 'image' ? 'images' : 'videos'}/${safeName(file.name)}`
  const signRes = await adminFetch('/api/media/admin', {
    method: 'POST',
    body: JSON.stringify({ action: 'sign-upload', path }),
  })
  const signed = await signRes.json().catch(() => ({}))
  if (!signRes.ok) throw new Error(signed.error || 'ขอสิทธิ์อัปโหลดไม่สำเร็จ (ต้องล็อกอินแอดมิน)')
  const { error } = await supabase.storage.from(BUCKET).uploadToSignedUrl(path, signed.token, file, {
    contentType: file.type || undefined,
  })
  if (error) throw error
  return { url: publicUrl(path), kind, name: path.split('/').pop() }
}

// เขียน/ลบแถว lesson_media ผ่าน API แอดมิน (ตารางปิด RLS ฝั่งเขียนแล้ว)
export async function insertLessonMedia(row) {
  const res = await adminFetch('/api/media/admin', {
    method: 'POST',
    body: JSON.stringify({ action: 'insert', row }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'บันทึกสื่อไม่สำเร็จ (ต้องล็อกอินแอดมิน)')
  return data.row
}

export async function deleteLessonMedia(id) {
  const res = await adminFetch('/api/media/admin', {
    method: 'POST',
    body: JSON.stringify({ action: 'delete', id }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'ลบสื่อไม่สำเร็จ (ต้องล็อกอินแอดมิน)')
}

// ดึงรหัสวิดีโอจากลิงก์ YouTube (รองรับหลายรูปแบบ) หรือถ้าใส่รหัสมาตรงๆ ก็คืนรหัสนั้น
export function parseYouTubeId(input) {
  if (!input) return ''
  const s = input.trim()
  const m = s.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{11})/)
  if (m) return m[1]
  if (/^[\w-]{11}$/.test(s)) return s
  return ''
}
