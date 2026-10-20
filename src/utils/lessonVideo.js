import { supabase, isSupabaseConfigured } from '../config/supabaseClient'
import { parseYouTubeId } from './mediaUpload'

// คลิปประจำบทที่แอดมินตั้งไว้ใน DB (ตาราง lesson_videos) — คืน null ถ้าไม่มี/ต่อไม่ได้
// รูปแบบเดียวกับ `lesson.video` ใน lessons.js: { youtube, orientation, quiz }
export async function fetchLessonVideo(lessonId) {
  if (!isSupabaseConfigured || !lessonId) return null
  try {
    const { data, error } = await supabase
      .from('lesson_videos')
      .select('youtube, orientation, quiz')
      .eq('lesson_id', lessonId)
      .maybeSingle()
    if (error || !data?.youtube || !Array.isArray(data.quiz) || data.quiz.length === 0) return null
    return data
  } catch {
    return null
  }
}

// แถวทั้งหมด ใช้แสดงสถานะในหน้า admin → Map<lessonId, row>
export async function fetchAllLessonVideos() {
  if (!isSupabaseConfigured) return new Map()
  const { data } = await supabase.from('lesson_videos').select('lesson_id, youtube, orientation, quiz')
  return new Map((data || []).map((r) => [r.lesson_id, r]))
}

export async function saveLessonVideo(lessonId, video) {
  const { error } = await supabase.from('lesson_videos').upsert(
    {
      lesson_id: lessonId,
      youtube: video.youtube,
      orientation: video.orientation,
      quiz: video.quiz,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'lesson_id' },
  )
  if (error) throw error
}

export async function deleteLessonVideo(lessonId) {
  const { error } = await supabase.from('lesson_videos').delete().eq('lesson_id', lessonId)
  if (error) throw error
}

// ตรวจก่อนบันทึก — คืนข้อความ error ภาษาไทย หรือ '' ถ้าผ่าน
export function validateLessonVideo({ youtube, quiz }) {
  if (!parseYouTubeId(youtube)) return 'ลิงก์/รหัส YouTube ไม่ถูกต้อง'
  if (!quiz.length) return 'ต้องมี mini quiz อย่างน้อย 1 ข้อ'
  for (const [i, q] of quiz.entries()) {
    const n = i + 1
    if (!q.question.trim()) return `ข้อ ${n}: ยังไม่ได้ใส่คำถาม`
    if (q.choices.length < 2) return `ข้อ ${n}: ต้องมีตัวเลือกอย่างน้อย 2 ตัว`
    if (q.choices.some((c) => !c.text.trim())) return `ข้อ ${n}: มีตัวเลือกที่ว่างอยู่`
    if (!q.choices.some((c) => c.id === q.correctId)) return `ข้อ ${n}: ยังไม่ได้เลือกข้อที่ถูก`
  }
  return ''
}
