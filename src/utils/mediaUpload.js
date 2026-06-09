import { supabase } from '../config/supabaseClient'

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
export async function uploadMedia(file) {
  const kind = kindOf(file)
  if (kind === 'other') throw new Error(`ไฟล์ "${file.name}" ไม่ใช่รูปหรือวิดีโอ`)
  const path = `${kind === 'image' ? 'images' : 'videos'}/${safeName(file.name)}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '31536000', upsert: false, contentType: file.type || undefined,
  })
  if (error) throw error
  return { url: publicUrl(path), kind, name: path.split('/').pop() }
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
