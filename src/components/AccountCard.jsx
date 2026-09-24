import { useState } from 'react'
import { LogIn, LogOut, MessageCircle, UserCheck, UserRound } from 'lucide-react'
import { isSupabaseConfigured } from '../config/supabaseClient'
import { useAuthSession } from '../hooks/useAuthSession'
import { useLearnerStore } from '../stores/learnerStore'
import { startLineLogin, isLineLoginConfigured } from '../utils/lineAuth'
import { startHubLogin } from '../utils/hubAuth'
import { logoutEverywhere } from '../utils/accountLogout'

// กล่องบัญชีของผู้เรียน — login แล้ว: ชื่อ + ช่องทางที่ใช้ login + ปุ่ม "ออกจากระบบ" (ออกทั้งเว็บนี้และ
// บัญชี JIA ที่ class.jiacpr.com ดู utils/accountLogout.js) · ยังไม่ login: ปุ่ม LINE / บัญชี JIA
// แสดงเฉพาะเมื่อ showSignedOut (หน้าตั้งค่า) — หน้าบทเรียนมีด่าน login หลังบทแรกอยู่แล้ว (LineLoginGate)
export default function AccountCard({ showSignedOut = false, style }) {
  const { session, loading } = useAuthSession()
  const learner = useLearnerStore((s) => s.learner)
  const [leaving, setLeaving] = useState(false)
  if (!isSupabaseConfigured || loading) return null

  if (!session) {
    if (!showSignedOut) return null
    return (
      <div className="card" style={style} data-testid="account-card" data-state="signed-out">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: 'var(--color-brand-soft)',
            color: 'var(--color-brand-dark)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <LogIn size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="text-body-strong">บัญชีของฉัน</div>
            <div className="text-caption" style={{ marginTop: 2 }}>
              เข้าสู่ระบบเพื่อบันทึกความก้าวหน้า เรียนต่อได้ทุกเครื่อง และรับใบประกาศ
            </div>
          </div>
        </div>
        {isLineLoginConfigured && (
          <button
            type="button"
            onClick={() => startLineLogin(learner?.id)}
            className="btn btn-block"
            style={{ marginTop: 12, background: '#06C755', color: '#fff', fontWeight: 700 }}
          >
            <MessageCircle size={18} /> เข้าสู่ระบบด้วย LINE
          </button>
        )}
        <button
          type="button"
          onClick={() => startHubLogin(learner?.id)}
          className="btn btn-secondary btn-block"
          style={{ marginTop: 8 }}
        >
          <UserRound size={18} /> เข้าสู่ระบบด้วยบัญชี JIA
        </button>
      </div>
    )
  }

  const name = (learner?.name || '').trim() || 'ผู้เรียน'
  const via = learner?.lineUserId ? 'LINE' : 'บัญชี JIA'
  const onLogout = () => {
    setLeaving(true)
    logoutEverywhere().catch(() => setLeaving(false))
  }
  return (
    <div
      className="card"
      style={{ borderColor: 'var(--color-brand-soft)', ...style }}
      data-testid="account-card"
      data-state="signed-in"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: 'var(--color-brand-soft)',
          color: 'var(--color-brand-dark)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <UserCheck size={18} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="text-caption">เข้าสู่ระบบแล้ว ({via})</div>
          <div className="text-body-strong" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          disabled={leaving}
          className="btn btn-secondary"
          style={{ padding: '8px 12px', fontSize: 14, flexShrink: 0 }}
        >
          <LogOut size={16} /> {leaving ? 'กำลังออก…' : 'ออกจากระบบ'}
        </button>
      </div>
    </div>
  )
}
