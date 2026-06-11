import { useSettingsStore } from '../stores/settingsStore'
import { HouseAdList } from '../components/HouseAdBanner'

export default function Settings() {
  const theme = useSettingsStore((s) => s.theme)
  const setTheme = useSettingsStore((s) => s.setTheme)

  return (
    <div className="page-container">
      <div style={{ marginTop: 8 }}>
        <div className="text-caption">ตั้งค่า</div>
        <div className="text-title">การแสดงผล</div>
      </div>
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

      <HouseAdList />
    </div>
  )
}
