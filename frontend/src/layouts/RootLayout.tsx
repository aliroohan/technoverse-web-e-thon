import { Link, Outlet } from '@tanstack/react-router'

export function RootLayout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">
          Web-e-Thon
        </Link>
        <nav className="app-nav">
          <Link to="/" activeProps={{ className: 'active' }}>
            Home
          </Link>
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}