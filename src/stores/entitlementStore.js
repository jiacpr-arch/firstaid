import { create } from 'zustand'

// Which chapters (0 = whole-course bundle, 1-4 = single chapter) the logged-in
// learner has purchased. Unlike progressStore this is never read from local
// Dexie — entitlements only exist server-side against the durable learner_id,
// so an anonymous (not-logged-in) learner always resolves to an empty set here.
//
// status: 'idle' | 'loading' | 'ok' | 'error'
//   หน้าบทเรียนแสดงหน้าซื้อหมวดเฉพาะเมื่อ status === 'ok' (โหลดรอบล่าสุดสำเร็จจริง)
//   — เดิมใช้ loaded ซึ่งเป็น true ค้างจากรอบก่อน/รอบที่ล้มเหลว ทำให้ผู้เรียนในคลาสที่เปิดทุกหมวด
//   เจอหน้าซื้อ ฿99 เป็นบางครั้ง (ระหว่างรอโหลดใหม่ หรือเมื่อเรียก API ไม่สำเร็จ)
let seq = 0

async function fetchChapters(token) {
  const res = await fetch('/api/entitlements', { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`entitlements ${res.status}`)
  const data = await res.json()
  return new Set(data.chapters || [])
}

export const useEntitlementStore = create((set) => ({
  chapters: new Set(),
  loaded: false,
  loading: false,
  status: 'idle',
  token: null, // access token ที่ใช้โหลดผลชุดนี้ — หน้าบทเรียนเช็คว่าตรงกับ session ปัจจุบัน
  refresh: async (session) => {
    const mine = ++seq
    const token = session?.access_token
    if (!token) {
      set({ chapters: new Set(), loaded: true, loading: false, status: 'ok', token: null })
      return
    }
    set({ loading: true, status: 'loading' })
    let chapters = null
    for (let attempt = 0; attempt < 2 && !chapters; attempt += 1) {
      try {
        chapters = await fetchChapters(token)
      } catch {
        if (attempt === 0) await new Promise((r) => setTimeout(r, 800))
      }
    }
    if (mine !== seq) return // มีการโหลดรอบใหม่กว่าแล้ว — ทิ้งผลรอบเก่า กันค่าเก่าทับค่าใหม่
    if (chapters) set({ chapters, loaded: true, loading: false, status: 'ok', token })
    else set({ loaded: true, loading: false, status: 'error' }) // ออฟไลน์/เซิร์ฟเวอร์ล่ม — อย่าตัดสินว่าล็อก
  },
}))
