import { useCallback, useEffect, useState } from 'react'
import { useLearnerStore } from '../stores/learnerStore'
import { authHeader } from '../utils/authHeader'
import { isSupabaseConfigured } from '../config/supabaseClient'

// คลาสรวม CPR + ปฐมพยาบาล: นักเรียนต้องเรียน CPR & AED ออนไลน์ด้วย — เรียนในเว็บนี้ที่ /cpr
// (src/pages/CprCourse.jsx) ความคืบหน้าที่เคยเรียนบน cpr.morroo.com ด้วยเบอร์เดียวกันก็นับให้
// hook นี้ดึงสถานะ CPR ของตัวเองจาก api/cohorts/my-cpr.js ให้แบนเนอร์คลาสกับ Post-test ใช้บังคับลำดับ
//
// status:
//   'none'    — ไม่ได้อยู่ในคลาสรวม CPR (ไม่ต้องบังคับ)
//   'loading' — กำลังเช็ค
//   'todo'    — คลาสรวม CPR และยังเรียน CPR ไม่จบ → ล็อก Post-test
//   'done'    — เรียน CPR จบแล้ว
//   'unknown' — เช็คไม่ได้ (ออฟไลน์/เซิร์ฟเวอร์ล่ม) → ไม่ล็อก กันนักเรียนติดเพราะระบบเรา
const TTL_MS = 60_000
let cache = null // { key, at, value }
let inflight = null

async function fetchStatus(learnerId, code) {
  const resp = await fetch('/api/cohorts/my-cpr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ code, learnerId }),
  })
  if (!resp.ok) throw new Error(`my-cpr ${resp.status}`)
  const body = await resp.json()
  if (!body.includesCpr) return { status: 'none', promoCode: null, cpr: null }
  return {
    status: body.cpr?.completed ? 'done' : 'todo',
    promoCode: body.cprPromoCode || null,
    startsOn: body.startsOn || null, // วันอบรมจริง (cohorts.starts_on) ให้แบนเนอร์เตือนทำ Post-test ก่อนวันนั้น
    cpr: body.cpr || null,
  }
}

// คอร์ส CPR ของคลาสรวมอยู่ในเว็บนี้แล้ว (เดิมต้องข้ามไป cpr.morroo.com/?promo= แล้วกรอกชื่อ/เบอร์/โค้ดใหม่ —
// นักเรียนงงที่ต้องข้ามไปข้ามมา) — คนทั่วไปก็เรียนที่นี่ได้ (หมวด 5 ปลดล็อกแบบหมวดอื่น)
export const CPR_COURSE_PATH = '/cpr'

export function useClassCpr() {
  const learner = useLearnerStore((s) => s.learner)
  const updateLearner = useLearnerStore((s) => s.updateLearner)
  const learnerId = learner?.id
  const code = learner?.cohortCode
  const key = learnerId && code && isSupabaseConfigured ? `${learnerId}:${code}` : null
  // จำไว้ในเครื่องว่าคลาสนี้เป็นคลาสรวม CPR/เรียนจบแล้ว — เช็คไม่ได้ (ออฟไลน์) ก็ยังใช้ค่านี้
  const known = learner?.cprStatusCode === code ? learner?.cprStatus || null : null
  // โค้ด CPR ของคลาส = JIA-FA-<รหัสคลาส> เสมอ (api/_lib/classes.js cprPromoRow) — ระหว่างเช็คหรือเช็คไม่ได้
  // (เช่นเพิ่งล็อกอินแล้ว learner ในเครื่องยังไม่มี cprPromoCode) ใช้ค่านี้ ไม่งั้นแถบ CPR ไม่ขึ้น
  const knownPromo = learner?.cprPromoCode || (code && known !== 'none' ? `JIA-FA-${code}` : null)

  // result: { key, value } ของการเช็คล่าสุด — ผูกกับ key กันค่าค้างจากคลาส/คนก่อน
  const [result, setResult] = useState(() => (cache && cache.key === key ? cache : null))
  const [checking, setChecking] = useState(false)

  const run = useCallback((force) => {
    if (!key) return
    if (!force && cache?.key === key && Date.now() - cache.at < TTL_MS) {
      setResult(cache)
      return
    }
    if (!inflight || inflight.key !== key || force) {
      inflight = { key, promise: fetchStatus(learnerId, code) }
    }
    const mine = inflight
    setChecking(true)
    mine.promise
      .then((value) => {
        cache = { key, at: Date.now(), value }
        setResult(cache)
        updateLearner({ cprStatus: value.status, cprStatusCode: code, cprPromoCode: value.promoCode })
      })
      .catch(() => {
        // เช็คไม่ได้: เคยรู้ว่าเรียนจบ/ไม่ใช่คลาส CPR ใช้ค่านั้น ไม่งั้น 'unknown' (ไม่ล็อก)
        setResult({ key, at: 0, value: { status: known === 'none' || known === 'done' ? known : 'unknown', promoCode: knownPromo, cpr: null } })
      })
      .finally(() => {
        setChecking(false)
        if (inflight === mine) inflight = null
      })
  }, [key, learnerId, code, known, knownPromo, updateLearner])

  useEffect(() => {
    if (!key) return undefined
    // เริ่มเช็คแบบ async (ไม่ setState ตรง ๆ ใน effect)
    const t = setTimeout(() => run(false), 0)
    // กลับมาที่แท็บนี้ → เช็คใหม่ให้เลย
    const onVisible = () => { if (document.visibilityState === 'visible') run(true) }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(t)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [key, run])

  const refresh = useCallback(() => run(true), [run])

  if (!key) return { status: 'none', promoCode: null, cpr: null, checking: false, refresh }
  const value = result?.key === key ? result.value : null
  if (!value) return { status: 'loading', promoCode: knownPromo, cpr: null, checking: true, refresh }
  return { ...value, checking, refresh }
}
