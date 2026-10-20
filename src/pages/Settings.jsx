import { Link } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'
import { useSettingsStore } from '../stores/settingsStore'
import { HouseAdList } from '../components/HouseAdBanner'
import Seo from '../components/Seo'
import AccountCard from '../components/AccountCard'

export default function Settings() {
  const theme = useSettingsStore((s) => s.theme)
  const setTheme = useSettingsStore((s) => s.setTheme)

  return (
    <div className="page-container">
      <Seo title="ตั้งค่า | Jia Training Center" noindex path="/settings" />
      <div style={{ marginTop: 8 }}>
        <div className="text-caption">ตั้งค่า</div>
        <div className="text-title">บัญชี</div>
      </div>
      <AccountCard showSignedOut style={{ marginTop: 12 }} />

      <div className="text-title" style={{ marginTop: 20 }}>การแสดงผล</div>
      <div className="card" style={{ marginTop: 12 }}>
        <label className="label">ธีม</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {['light', 'dark', 'system'].map((t) => (
            <button
              key={t}
              type="button"
              className={`btn ${theme === t ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1 }}
              onClick={() => setTheme(t)}
            >
              {t === 'light' ? 'สว่าง' : t === 'dark' ? 'มืด' : 'ตามระบบ'}
            </button>
          ))}
        </div>
      </div>

      <Link to="/teach" className="card card-hover" style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
        <GraduationCap size={22} />
        <span style={{ flex: 1 }}>
          <span className="text-body-strong">สำหรับผู้สอน</span>
          <span className="text-caption" style={{ display: 'block' }}>สร้างคลาส ติดตามนักเรียน เช็คชื่อภาคปฏิบัติ</span>
        </span>
      </Link>

      <HouseAdList />
    </div>
  )
}
