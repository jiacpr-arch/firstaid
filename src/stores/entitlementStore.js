import { create } from 'zustand'
import { useLearnerStore } from './learnerStore'
import { beginEntitlementLookup, finishEntitlementLookup, setEntitlementLookupReady } from '../lib/entitlementMarketingBoundary.js'
import { revokeTrainingMarketing } from '../lib/trainingMarketing.js'

// Which chapters (0 = whole-course bundle, 1-4 = single chapter) the learner can open.
// Never read from local Dexie — entitlements only exist server-side (api/entitlements):
// purchases need a login; class unlock (คลาสรวม CPR) also works for this device's local learner.
//
// status: 'idle' | 'loading' | 'ok' | 'error'
//   หน้าบทเรียนแสดงหน้าซื้อหมวดเฉพาะเมื่อ status === 'ok' และ key ตรงกับ session + ผู้เรียนปัจจุบัน
//   (ผลค้างจากรอบก่อน/รอบที่ล้มเหลว เคยทำให้ผู้เรียนคลาสรวมเจอหน้าซื้อ ฿99 เป็นบางครั้ง)
let seq = 0

// ผลชุดนี้เป็นของใคร: token ที่ใช้ (ว่าง = ไม่ล็อกอิน) + ผู้เรียนในเครื่อง
export function entitlementKey(session, learnerId) {
  return `${session?.access_token || ''}|${learnerId || ''}`
}

async function fetchChapters(token, learnerId) {
  const res = await fetch('/api/entitlements', {
    method: 'POST', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(learnerId ? { learnerId } : {}),
  })
  if (!res.ok) throw new Error(`entitlements ${res.status}`)
  const data = await res.json()
  // An incomplete/malformed response cannot prove an anonymous document is
  // free of ownership data. Preserve the existing error/retry learning UI.
  if (!Array.isArray(data?.chapters) || !data.chapters.every(chapter => Number.isSafeInteger(chapter) && chapter >= 0)
    || typeof data.cpr !== 'boolean') throw new Error('invalid entitlements response')
  // cpr: หมวด 5 เปิดจากการซื้อเท่านั้น (chapter 0 ใน chapters อาจมาจากคลาสที่เปิดทุกบท ซึ่งไม่รวม CPR)
  return { chapters: new Set(data.chapters || []), cpr: data.cpr === true }
}

export const useEntitlementStore = create((set) => ({
  chapters: new Set(),
  cpr: false, // ซื้อหมวด CPR (5) หรือทั้งคอร์สเองแล้ว — ใช้แทน isChapterUnlocked(5, chapters)
  loaded: false,
  loading: false,
  status: 'idle',
  key: null,
  refresh: async (session) => {
    const mine = ++seq
    const token = session?.access_token || null
    const learnerId = useLearnerStore.getState().learner?.id || null
    const key = entitlementKey(session, learnerId)
    if (!token && !learnerId) {
      setEntitlementLookupReady(window, true)
      set({ chapters: new Set(), cpr: false, loaded: true, loading: false, status: 'ok', key })
      return
    }
    set({ loading: true, status: 'loading' })
    let result = null
    for (let attempt = 0; attempt < 2 && !result; attempt += 1) {
      if (mine !== seq) { set({}); return }
      if (!beginEntitlementLookup(window, () => {
        revokeTrainingMarketing(window, document)
        window.location.replace(window.location.href)
      })) return
      try {
        result = await fetchChapters(token, learnerId)
      } catch {
        if (attempt === 0) await new Promise((r) => setTimeout(r, 800))
      } finally {
        finishEntitlementLookup(window)
      }
    }
    if (mine !== seq) { set({}); return } // Wake the privacy gate after an older request settles; never publish its result.
    setEntitlementLookupReady(window, !!result && result.chapters.size === 0 && !result.cpr)
    if (result) set({ chapters: result.chapters, cpr: result.cpr, loaded: true, loading: false, status: 'ok', key })
    else set({ loaded: true, loading: false, status: 'error' }) // ออฟไลน์/เซิร์ฟเวอร์ล่ม — อย่าตัดสินว่าล็อก
  },
}))
