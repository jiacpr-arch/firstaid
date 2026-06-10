import { supabase, isSupabaseConfigured } from '../config/supabaseClient'

// แปลงแถวจากตาราง lesson_media เป็น step ที่ LessonStep เรนเดอร์ได้
export function mediaRowToStep(row) {
  if (row.kind === 'image') {
    return { type: 'image', src: row.url, alt: row.alt || '', caption: row.caption || '' }
  }
  // video
  if (row.youtube) return { type: 'video', youtube: row.youtube, caption: row.caption || '' }
  return { type: 'video', src: row.url, caption: row.caption || '' }
}

// รวม step คงที่ (จาก lessons.js) กับสื่อที่ผูกไว้ใน DB
// after_step: แทรกหลังขั้นที่ N (1-based); 0 = ก่อนขั้นแรก; null/เกินจำนวนขั้น = ต่อท้ายบท
export function mergeSteps(staticSteps, rows) {
  if (!rows?.length) return staticSteps
  const byAfter = new Map() // afterIndex -> [step]
  const atEnd = []
  for (const row of rows) {
    const step = mediaRowToStep(row)
    const after = row.after_step
    if (after == null || after >= staticSteps.length) {
      atEnd.push(step)
    } else {
      const k = Math.max(0, after)
      if (!byAfter.has(k)) byAfter.set(k, [])
      byAfter.get(k).push(step)
    }
  }
  const out = []
  if (byAfter.has(0)) out.push(...byAfter.get(0))
  staticSteps.forEach((s, i) => {
    out.push(s)
    const stepNum = i + 1
    if (byAfter.has(stepNum)) out.push(...byAfter.get(stepNum))
  })
  out.push(...atEnd)
  return out
}

// ดึงสื่อที่ผูกกับบทเรียนหนึ่ง (เรียงตามตำแหน่งแล้วเวลา)
export async function fetchLessonMedia(lessonId) {
  if (!isSupabaseConfigured || !lessonId) return []
  const { data, error } = await supabase
    .from('lesson_media')
    .select('*')
    .eq('lesson_id', lessonId)
    .order('after_step', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
  if (error) return []
  return data || []
}
