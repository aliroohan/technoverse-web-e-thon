import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { LogIn, ShieldCheck } from 'lucide-react'
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
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setPending(true)
    try {
      const user = await apiRequest<SessionUser>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      queryClient.setQueryData(['me'], user)
      await navigate({ to: homeFor(user.role) })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="login">
      <section className="login-hero">
        <p className="meta-chip meta"><ShieldCheck size={15} /> Secure examination desk</p>
        <h1>Holdfast</h1>
        <p className="lede">Server-owned clock. Failure-resilient sitting.</p>
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
          <Button type="submit" disabled={pending}>
            <LogIn size={16} /> {pending ? 'Signing in…' : 'Enter'}
          </Button>
        </form>
      </section>
    </div>
  )
}
