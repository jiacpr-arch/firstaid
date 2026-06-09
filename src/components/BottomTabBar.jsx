import { NavLink, useLocation } from 'react-router-dom'
import { Home, BookOpen, Map, Activity, Phone } from 'lucide-react'

const ITEMS = [
  { to: '/', label: 'หน้าหลัก', icon: Home, exact: true },
  { to: '/learn', label: 'เรียน', icon: BookOpen },
  { to: '/algorithms', label: 'Algorithm', icon: Map },
  { to: '/simulation', label: 'ฝึก', icon: Activity },
  { to: '/call', label: '1669', icon: Phone, danger: true },
]

export default function BottomTabBar() {
  const location = useLocation()
  return (
    <nav className="bottom-bar" aria-label="แถบเมนูหลัก">
      {ITEMS.map(({ to, label, icon: Icon, exact, danger }) => {
        const active = exact ? location.pathname === to : location.pathname.startsWith(to)
        return (
          <NavLink
            key={to}
            to={to}
            className={`bottom-bar-item ${active ? 'active' : ''}`}
            style={danger && !active ? { color: 'var(--color-danger)' } : undefined}
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
