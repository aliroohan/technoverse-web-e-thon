import { Link } from '@tanstack/react-router'

export function NotFoundPage() {
  return (
    <section className="page">
      <h1>404</h1>
      <p>This page does not exist.</p>
      <Link to="/">Back home</Link>
    </section>
  )
}