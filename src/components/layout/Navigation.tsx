import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Mesh', icon: '◈' },
  { to: '/chat', label: 'PTT', icon: '🎙' },
  { to: '/contacts', label: 'Contactos', icon: '👥' },
  { to: '/camera', label: 'Cámara', icon: '📷' },
  { to: '/settings', label: 'Ajustes', icon: '⚙' }
]

export function Navigation() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur border-t border-slate-800 pb-[var(--safe-area-inset-bottom)]">
      <div className="flex justify-around items-center h-16">
        {navItems.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-colors ${
                isActive ? 'text-mesh-400' : 'text-slate-500 hover:text-slate-300'
              }`
            }
          >
            <span className="text-lg">{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
