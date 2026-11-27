import { Link, Outlet, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Loader } from '../components/ui'
import {
  BookOpen,
  ClipboardList,
  FileText,
  Layers,
  LogOut,
  Menu,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from 'lucide-react'
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
      <span className="sidebar-icon" aria-hidden="true">
        {icon}
      </span>
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
  if (me.isPending) {
    return (
      <main className="main stack">
        <Loader full label="Loading workspace" />
      </main>
    )
  }
  if (me.isError || !user) {
    return (
      <main className="main stack">
        <p className="banner error" role="alert">
          {me.error instanceof Error ? me.error.message : 'Could not load your session.'}
        </p>
        <div className="row">
          <Button type="button" onClick={() => void me.refetch()}>Retry</Button>
          <Link className="btn-ghost" to="/login">Sign in</Link>
        </div>
      </main>
    )
  }

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
    try {
      await apiRequest('/auth/logout', { method: 'POST' })
    } catch {
      // ignore network errors on logout
    }
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
          <Menu size={15} strokeWidth={2} aria-hidden="true" />
        </button>

        <Link to={homeFor(user.role)} className="sidebar-head" onClick={closeMobile}>
          <span className="sidebar-seal" aria-hidden="true">
            <ShieldCheck size={20} strokeWidth={1.75} />
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
              <SidebarItem
                to="/admin/users"
                label="People"
                icon={<Users size={18} strokeWidth={1.7} />}
                onNavigate={closeMobile}
              />
              <SidebarItem
                to="/admin/logs"
                label="Student log"
                icon={<ClipboardList size={18} strokeWidth={1.7} />}
                onNavigate={closeMobile}
              />
            </>
          )}
          {user.role === 'examiner' && (
            <>
              <SidebarItem
                to="/examiner/exams"
                label="Examinations"
                icon={<BookOpen size={18} strokeWidth={1.7} />}
                onNavigate={closeMobile}
              />
              <SidebarItem
                to="/examiner/questions"
                label="Question bank"
                icon={<Layers size={18} strokeWidth={1.7} />}
                onNavigate={closeMobile}
              />
              <SidebarItem
                to="/examiner/candidates"
                label="Candidates"
                icon={<UserCheck size={18} strokeWidth={1.7} />}
                onNavigate={closeMobile}
              />
            </>
          )}
          {user.role === 'candidate' && (
            <SidebarItem
              to="/candidate"
              label="My examinations"
              icon={<FileText size={18} strokeWidth={1.7} />}
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
            <span className="sidebar-icon" aria-hidden="true">
              <LogOut size={17} strokeWidth={1.75} />
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
            className="btn-ghost btn-icon"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMobileOpen((prev) => !prev)}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </header>

        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
