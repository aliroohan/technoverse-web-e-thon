import { Link, Outlet, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { apiRequest } from '../lib/api-client'
import { homeFor, fetchMe } from '../lib/session'

const STORAGE_KEY = 'holdfast-sidebar-collapsed'

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function BrandMark() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2.5L4.5 5.8v5.7c0 5 3.2 8.9 7.5 10 4.3-1.1 7.5-5 7.5-10V5.8L12 2.5z" />
      <path d="M9 8.5v7" />
      <path d="M15 8.5v7" />
      <path d="M9 12h6" />
    </svg>
  )
}

function SidebarToggleIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="4" y1="7" x2="20" y2="7" />
      <line className="sidebar-menu-mid" x1="4" y1="12" x2="16" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  )
}

function NavIcon({ kind }: { kind: 'users' | 'log' | 'exams' | 'bank' | 'candidates' | 'sitting' | 'signout' }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.65,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (kind) {
    case 'users':
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="3.5" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16.5 3.5a3.5 3.5 0 0 1 0 6.8" />
        </svg>
      )
    case 'log':
      return (
        <svg {...common}>
          <rect x="4" y="3" width="16" height="18" rx="2.5" />
          <path d="M8 8h8" />
          <path d="M8 12h8" />
          <path d="M8 16h5" />
        </svg>
      )
    case 'exams':
      return (
        <svg {...common}>
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
          <path d="M8.5 7h7" />
          <path d="M8.5 11h5" />
        </svg>
      )
    case 'bank':
      return (
        <svg {...common}>
          <polygon points="12 2.5 2.5 7.5 12 12.5 21.5 7.5 12 2.5" />
          <polyline points="2.5 16.5 12 21.5 21.5 16.5" />
          <polyline points="2.5 12 12 17 21.5 12" />
        </svg>
      )
    case 'candidates':
      return (
        <svg {...common}>
          <path d="M15.5 21v-2a4 4 0 0 0-4-4H5.5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="3.5" />
          <polyline points="16.5 11.5 18.5 13.5 22.5 9.5" />
        </svg>
      )
    case 'sitting':
      return (
        <svg {...common}>
          <path d="M14 2H6.5A2.5 2.5 0 0 0 4 4.5v15A2.5 2.5 0 0 0 6.5 22h11a2.5 2.5 0 0 0 2.5-2.5V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="13" y2="17" />
        </svg>
      )
    case 'signout':
      return (
        <svg {...common}>
          <path d="M9 21H5.5A2.5 2.5 0 0 1 3 18.5v-13A2.5 2.5 0 0 1 5.5 3H9" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      )
  }
}

function SidebarItem({
  to,
  label,
  icon,
  onNavigate,
}: {
  to: '/admin/users' | '/admin/logs' | '/examiner/exams' | '/examiner/questions' | '/examiner/candidates' | '/candidate'
  label: string
  icon: ReactNode
  onNavigate: () => void
}) {
  return (
    <Link
      to={to}
      className="sidebar-link"
      activeProps={{ className: 'sidebar-link active' }}
      data-tooltip={label}
      aria-label={label}
      onClick={onNavigate}
    >
      <span className="sidebar-icon">{icon}</span>
      <span className="sidebar-label">{label}</span>
    </Link>
  )
}

export function DashboardLayout() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const me = useQuery({ queryKey: ['me'], queryFn: fetchMe })
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })
  const [mobileOpen, setMobileOpen] = useState(false)

  const user = me.data
  if (!user) return null

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        // ignore storage restrictions
      }
      return next
    })
  }

  const closeMobile = () => setMobileOpen(false)

  const logout = async () => {
    await apiRequest('/auth/logout', { method: 'POST' })
    queryClient.setQueryData(['me'], null)
    await navigate({ to: '/login' })
  }

  return (
    <div className="shell">
      <button
        type="button"
        aria-label="Close navigation menu"
        className={`sidebar-backdrop${mobileOpen ? ' open' : ''}`}
        onClick={closeMobile}
      />

      <aside
        aria-label="Workspace sidebar"
        className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}
      >
        <button
          type="button"
          className="sidebar-toggle"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={toggleCollapsed}
        >
          <SidebarToggleIcon />
        </button>

        <Link to={homeFor(user.role)} className="sidebar-head" onClick={closeMobile}>
          <span className="sidebar-seal" aria-hidden="true">
            <BrandMark />
          </span>
          <span className="sidebar-brand-text">
            <span className="wordmark">Holdfast</span>
            <span className="sidebar-role">{user.role} desk</span>
          </span>
        </Link>

        <div className="sidebar-section">Navigation</div>

        <nav className="sidebar-nav" aria-label="Primary">
          {user.role === 'admin' && (
            <>
              <SidebarItem to="/admin/users" label="People" icon={<NavIcon kind="users" />} onNavigate={closeMobile} />
              <SidebarItem to="/admin/logs" label="Student log" icon={<NavIcon kind="log" />} onNavigate={closeMobile} />
            </>
          )}
          {user.role === 'examiner' && (
            <>
              <SidebarItem
                to="/examiner/exams"
                label="Examinations"
                icon={<NavIcon kind="exams" />}
                onNavigate={closeMobile}
              />
              <SidebarItem
                to="/examiner/questions"
                label="Question bank"
                icon={<NavIcon kind="bank" />}
                onNavigate={closeMobile}
              />
              <SidebarItem
                to="/examiner/candidates"
                label="Candidates"
                icon={<NavIcon kind="candidates" />}
                onNavigate={closeMobile}
              />
            </>
          )}
          {user.role === 'candidate' && (
            <SidebarItem
              to="/candidate"
              label="My examinations"
              icon={<NavIcon kind="sitting" />}
              onNavigate={closeMobile}
            />
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="sidebar-avatar" aria-hidden="true">
              {initialsOf(user.name)}
            </span>
            <div className="sidebar-user-meta">
              <span className="sidebar-user-name">{user.name}</span>
              <span className="sidebar-user-email">{user.email}</span>
            </div>
          </div>

          <button
            className="sidebar-signout"
            type="button"
            data-tooltip="Sign out"
            aria-label="Sign out"
            onClick={() => void logout()}
          >
            <span className="sidebar-icon">
              <NavIcon kind="signout" />
            </span>
            <span className="sidebar-label">Sign out</span>
          </button>
        </div>
      </aside>

      <div className="shell-content">
        <header className="mobile-bar">
          <Link to={homeFor(user.role)} className="wordmark">
            Holdfast
          </Link>
          <button
            type="button"
            className="btn-ghost btn-sm"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMobileOpen((prev) => !prev)}
          >
            {mobileOpen ? 'Close' : 'Menu'}
          </button>
        </header>

        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
