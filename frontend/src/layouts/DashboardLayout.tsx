import { Link, Outlet, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '../lib/api-client'
import { homeFor, fetchMe } from '../lib/session'

export function DashboardLayout() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const me = useQuery({ queryKey: ['me'], queryFn: fetchMe })
  const user = me.data
  if (!user) return null

  const logout = async () => {
    await apiRequest('/auth/logout', { method: 'POST' })
    queryClient.setQueryData(['me'], null)
    await navigate({ to: '/login' })
  }

  return (
    <div className="shell">
      <header className="topbar">
        <Link to={homeFor(user.role)} className="wordmark">
          Holdfast
        </Link>
        <nav className="nav" aria-label="Primary">
          {user.role === 'admin' && (
            <>
              <Link to="/admin/users" activeProps={{ className: 'active' }}>
                People
              </Link>
              <Link to="/admin/logs" activeProps={{ className: 'active' }}>
                Student log
              </Link>
            </>
          )}
          {user.role === 'examiner' && (
            <>
              <Link to="/examiner/exams" activeProps={{ className: 'active' }}>
                Examinations
              </Link>
              <Link to="/examiner/questions" activeProps={{ className: 'active' }}>
                Question bank
              </Link>
              <Link to="/examiner/candidates" activeProps={{ className: 'active' }}>
                Candidates
              </Link>
            </>
          )}
          {user.role === 'candidate' && (
            <Link to="/candidate" activeProps={{ className: 'active' }}>
              My examinations
            </Link>
          )}
          <span className="meta">{user.name}</span>
          <button className="btn-ghost" type="button" onClick={() => void logout()}>
            Sign out
          </button>
        </nav>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
