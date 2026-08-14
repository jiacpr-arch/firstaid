// ระบบจองกลาง class.morroo.com (repo JIA-CLASS, edge function bcpr-api) — คนละ
// Supabase โปรเจกต์กับของ firstaid จึง hardcode ที่นี่ได้ตาม pattern ของ houseAds
// สัญญา API + ทะเบียน utm_source: docs/WIDGET-API.md ใน repo JIA-CLASS

const HUB_API = 'https://tpoiyykbgsgnrdwzgzvn.supabase.co/functions/v1/bcpr-api'
// anon key สาธารณะของโปรเจกต์ jia-unified — ตัวเดียวกับที่ฝังอยู่ใน booking.html ของ class.morroo.com
const HUB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwb2l5eWtiZ3NnbnJkd3pnenZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NTUwMDIsImV4cCI6MjA5MDIzMTAwMn0.c7Ow_20mpmcDqDdMQ5qnsDV6-RKAO-7-eM1y-EsEXdA'
const BOOKING_PAGE = 'https://class.morroo.com/booking.html'
const FETCH_TIMEOUT_MS = 4000

// คอร์สฝั่งบุคคลทั่วไปที่เว็บนี้ชวนไปเรียนต่อภาคปฏิบัติ
export const CONSUMER_COURSE_KEY = 'B-CPR'
export const UTM_SOURCE = 'firstaid'

let cache = null // Promise — ยิงครั้งเดียวต่อการโหลดแอป

// รอบเรียนที่เปิดจองออนไลน์ทุกคอร์ส เรียงวันใกล้สุดก่อน — คืน null เมื่อล้มเหลว (ห้าม throw)
export function fetchUpcoming() {
  if (!cache) {
    cache = (async () => {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
      try {
        const res = await fetch(HUB_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${HUB_ANON}`,
            apikey: HUB_ANON,
          },
          body: JSON.stringify({ action: 'list_upcoming' }),
          signal: ctrl.signal,
        })
        const data = await res.json()
        return data && data.ok && Array.isArray(data.classes) ? data.classes : null
      } catch {
        return null
      } finally {
        clearTimeout(timer)
      }
    })()
  }
  return cache
}

export function bookingUrl(courseKey = CONSUMER_COURSE_KEY, classId = '', utm = UTM_SOURCE) {
  const q = new URLSearchParams({ course: courseKey, utm_source: utm })
  if (classId) q.set('class_id', classId)
  return `${BOOKING_PAGE}?${q.toString()}`
}

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

// 2026-08-22 → "22 ส.ค. 69"
export function thShortDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''))
  if (!m) return String(iso ?? '')
  return `${Number(m[3])} ${TH_MONTHS[Number(m[2]) - 1]} ${(Number(m[1]) + 543) % 100}`
}
