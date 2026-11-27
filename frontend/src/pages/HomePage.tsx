import { useHealth } from '../hooks/useHealth'
import { formatUptime } from '../utils/format'

export function HomePage() {
  const healthQuery = useHealth(true)

  return (
    <section className="page">
      <h1>Frontend scaffold</h1>
      <p>TanStack Query + TanStack Router are wired to the backend health endpoint.</p>

      <div className="card">
        {healthQuery.isPending && <p>Checking API…</p>}
        {healthQuery.isError && (
          <p className="error">API unreachable: {healthQuery.error.message}</p>
        )}
        {healthQuery.isSuccess && (
          <ul>
            <li>Status: {healthQuery.data.status}</li>
            <li>Uptime: {formatUptime(healthQuery.data.uptime)}</li>
            <li>Environment: {healthQuery.data.environment ?? 'unknown'}</li>
            <li>Timestamp: {healthQuery.data.timestamp}</li>
          </ul>
        )}
      </div>
    </section>
  )
}