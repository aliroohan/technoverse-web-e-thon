import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Banner, Button, Field, TextInput } from '../components/ui'
import { ApiError, apiRequest } from '../lib/api-client'
import { homeFor } from '../lib/session'
import type { SessionUser } from '../types/domain'

export function LoginPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    try {
      const user = await apiRequest<SessionUser>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      queryClient.setQueryData(['me'], user)
      await navigate({ to: homeFor(user.role) })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in')
    }
  }

  return (
    <div className="login">
      <section className="login-hero">
        <p className="meta">Secure examination desk</p>
        <h1>Holdfast</h1>
        <p className="lede">The clock belongs to the server. A dropped connection does not buy time, and it does not lose the last accepted answer.</p>
      </section>
      <section className="login-panel">
        <form className="stack" onSubmit={(event) => void submit(event)}>
          <h2>Sign in</h2>
          {error && <Banner tone="error">{error}</Banner>}
          <Field label="Email">
            <TextInput type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </Field>
          <Field label="Password">
            <TextInput type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </Field>
          <Button type="submit">Enter</Button>
          <p className="meta">Demo accounts are listed in the project README. There is no public registration.</p>
        </form>
      </section>
    </div>
  )
}
