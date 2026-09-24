import { supabase, isSupabaseConfigured } from '../config/supabaseClient'
import { useLearnerStore } from '../stores/learnerStore'
import { flushSync } from '../db/sync'
import { hubLogoutUrl } from './hubAuth'

// ออกจากระบบบนเครื่องนี้ (ปุ่ม "ออกจากระบบ" ใน AccountCard):
// 1. ส่งความก้าวหน้าที่ยังค้างขึ้นบัญชีก่อน (รอไม่เกิน 4 วิ — ออฟไลน์ก็ออกได้ แถวที่ค้างยังอยู่ใน Dexie
//    ใต้ learner id เดิม และถูกส่งขึ้นเมื่อบัญชีนี้ login กลับมาบนเครื่องนี้)
// 2. ปิด session Supabase ของเว็บนี้แบบ scope local — เครื่องอื่นของผู้เรียนไม่หลุด
// 3. ล้างผู้เรียนในเครื่อง → เปิดมาใหม่จะได้ผู้เรียนนิรนามคนใหม่ (useEnsureLearner) ไม่ใช่ของคนเดิม
//    ถ้าไม่ล้าง คนถัดไปที่ login บัญชีตัวเองจะถูก rekey ความก้าวหน้าของคนก่อนเข้าบัญชีตัวเอง
//    (linkLearnerToAuth) — ความก้าวหน้าของบัญชีกลับมาครบเมื่อ login ใหม่ (pullSync ด้วย learner id จริง)
// 4. ไปหน้า class.jiacpr.com/sso/logout ปิด session ของ Hub ด้วย แล้ว Hub พากลับมาหน้าเดิม
export async function logoutEverywhere({ returnPath } = {}) {
  const { learner, clear } = useLearnerStore.getState()
  if (learner?.id) {
    await Promise.race([
      flushSync(learner.id).catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 4000)),
    ])
  }
  if (isSupabaseConfigured) {
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch {
      /* session is dropped locally even when the network call fails */
    }
  }
  clear()
  window.location.assign(hubLogoutUrl(returnPath ?? `${window.location.pathname}${window.location.search}`))
}
