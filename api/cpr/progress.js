import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { applyCors } from '../_lib/cors.js'
import { authFromToken, reconcileLearner, isLearnerIdBound } from '../_lib/authLearner.js'
import { rateLimited } from '../_lib/rateLimit.js'
import { resolveCprAccess } from '../_lib/cprAccess.js'
import { CPR_COMPLETED_STATUS } from '../_lib/cprCourse.js'
import { COUPON_DISCOUNT, COUPON_STAFF, genCouponCode, cleanPhone, hasPaidCprEntitlement, salesRow } from '../_lib/cprReward.js'

// ความคืบหน้าคอร์ส CPR & AED (หน้า /cpr) ของผู้เรียนที่ซื้อหมวด CPR / ทั้งคอร์ส — บทไหนผ่านแล้ว
// (นักเรียนคลาสรวมใช้ api/cohorts/my-cpr.js ซึ่งจับคู่ด้วยเบอร์และนับที่เคยเรียนบน cpr.morroo.com ด้วย)
// POST { learnerId, code? } → { access: 'class'|'paid'|null, scores, completed, coupon }
// POST { learnerId, action: 'reward', phone?, name? } → { coupon, salesQueued }
//   หลังสอบปลายภาค CPR ผ่าน (คนที่ซื้อเอง): ออกคูปอง ฿100 คอร์ส On-site + เข้าคิวติดตามขาย — ดู api/_lib/cprReward.js
export default async function handler(req, res) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  if (rateLimited(req, res, { key: 'cpr-progress', limit: 30, windowMs: 60_000 })) return
  const admin = getSupabaseAdmin()
  if (!admin) { res.status(500).json({ error: 'Supabase not configured' }); return }

  const body = req.body || {}
  const auth = await authFromToken(admin, req)
  const { learnerId, forbidden } = reconcileLearner(body.learnerId, auth?.learnerId || null)
  if (forbidden) { res.status(403).json({ error: 'learnerId does not match session' }); return }
  if (!learnerId) { res.status(400).json({ error: 'Missing learnerId' }); return }
  if (!auth?.learnerId && await isLearnerIdBound(admin, learnerId)) { res.status(401).json({ error: 'login_required' }); return }

  try {
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
    const access = await resolveCprAccess(admin, { code, learnerId, tokenLearnerId: auth?.learnerId })
    if (body.action === 'reward') { await reward(admin, res, { access, body, learnerId: auth?.learnerId }); return }
    if (!access) { res.status(200).json({ access: null, scores: {}, completed: false }); return }
    if (access.kind === 'class') { res.status(200).json({ access: 'class', scores: {}, completed: false }); return }
    const { data, error } = await admin
      .from('online_students')
      .select('chapter_scores, completed_at, status, coupon_code')
      .eq('company', access.tag)
      .limit(1)
    if (error) throw error
    const row = data?.[0]
    const scores = Object.fromEntries(Object.entries(row?.chapter_scores || {}).filter(([, v]) => Number(v) > 0))
    res.status(200).json({
      access: 'paid', scores,
      completed: !!row?.completed_at || row?.status === CPR_COMPLETED_STATUS,
      coupon: row?.coupon_code || null,
    })
  } catch (err) {
    console.error('cpr progress failed', err)
    res.status(500).json({ error: 'โหลดความคืบหน้าไม่สำเร็จ' })
  }
}

async function reward(admin, res, { access, body, learnerId }) {
  // เฉพาะคนที่ซื้อเอง (คลาสรวม CPR = pre-course ไม่มีคูปอง) และต้องล็อกอิน (สิทธิ์ซื้อผูกกับบัญชี)
  if (!learnerId || access?.kind !== 'paid') { res.status(200).json({ coupon: null, eligible: false }); return }

  const { data: rows, error } = await admin
    .from('online_students')
    .select('id, name, phone, completed_at, final_score, coupon_code')
    .eq('company', access.tag)
    .limit(1)
  if (error) throw error
  const row = rows?.[0]
  if (!row?.completed_at) { res.status(200).json({ coupon: null, eligible: false, reason: 'not_completed' }); return }

  // เรียนฟรีไม่ได้คูปอง: ต้องมีสิทธิ์หมวด 5 / ทั้งคอร์ส จากโค้ดที่ขาย (ราคา > 0)
  const { data: ents, error: eErr } = await admin
    .from('lesson_entitlements')
    .select('chapter, source, order_ref')
    .eq('learner_id', learnerId)
    .in('chapter', [0, 5])
  if (eErr) throw eErr
  const refs = (ents || []).map((e) => e.order_ref).filter(Boolean)
  let vouchers = []
  if (refs.length) {
    const { data: v, error: vErr } = await admin.from('vouchers').select('code, price_thb').in('code', refs)
    if (vErr) throw vErr
    vouchers = v || []
  }
  if (!hasPaidCprEntitlement(ents || [], vouchers)) { res.status(200).json({ coupon: null, eligible: false, reason: 'not_paid' }); return }

  // ทีมขายต้องมีเบอร์โทรติดต่อกลับ — ไม่มีในระบบให้ผู้เรียนกรอก
  const phone = cleanPhone(row.phone) || cleanPhone(body.phone)
  if (!phone) { res.status(200).json({ coupon: null, eligible: true, needPhone: true }); return }
  const name = (row.name && row.name !== 'ผู้เรียน firstaid' ? row.name : String(body.name || '').trim().slice(0, 120)) || row.name

  let coupon = row.coupon_code || ''
  if (!coupon) {
    for (let i = 0; i < 8 && !coupon; i += 1) {
      const c = genCouponCode()
      const { error: pErr } = await admin.from('promo_codes')
        .insert({ code: c, type: 'online', discount: COUPON_DISCOUNT, staff_name: COUPON_STAFF, used: 0 })
      if (!pErr) coupon = c
      else if (pErr.code !== '23505') throw pErr
    }
    if (!coupon) throw new Error('coupon generation failed')
  }
  const { error: uErr } = await admin.from('online_students')
    .update({ coupon_code: coupon, phone, name }).eq('id', row.id)
  if (uErr) throw uErr

  // คิวติดตามขาย: ครั้งเดียวต่อคูปอง
  const { data: existing, error: sErr } = await admin.from('sales_tracking').select('id').eq('coupon_code', coupon).limit(1)
  if (sErr) throw sErr
  if (!existing?.length) {
    const { error: iErr } = await admin.from('sales_tracking')
      .insert(salesRow({ name, phone, score: row.final_score, coupon }))
    if (iErr) throw iErr
  }
  res.status(200).json({ coupon, eligible: true, salesQueued: true })
}
