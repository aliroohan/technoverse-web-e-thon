import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Banner, Button, Field, Select, TextInput } from '../components/ui'
import { apiRequest } from '../lib/api-client'
import type { Role } from '../types/domain'

type UserRow = { id: string; name: string; email: string; role: Role; active: boolean }

export function AdminUsersPage() {
  const queryClient = useQueryClient()
  const users = useQuery({ queryKey: ['users'], queryFn: () => apiRequest<UserRow[]>('/users') })
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'candidate' as Role })
  const [message, setMessage] = useState('')

  const create = useMutation({
    mutationFn: () => apiRequest('/users', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: async () => {
      setForm({ name: '', email: '', password: '', role: 'candidate' })
      setMessage('Account created.')
      await queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: Error) => setMessage(error.message),
  })

  const update = useMutation({
    mutationFn: (input: { id: string; role?: Role; active?: boolean }) =>
      apiRequest(`/users/${input.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: input.role, active: input.active }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    create.mutate()
  }

  return (
    <div className="grid two">
      <section>
        <h1 className="page-title">People</h1>
        <p className="lede">Administrators create accounts and assign roles. Deactivated people cannot sign in.</p>
        {message && <Banner>{message}</Banner>}
        <ul className="list">
          {users.data?.map((user) => (
            <li className="card" key={user.id}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <strong>{user.name}</strong>
                  <div className="meta">{user.email}</div>
                </div>
                <span className="pill">{user.active ? user.role : 'inactive'}</span>
              </div>
              <div className="row" style={{ marginTop: '0.7rem' }}>
                <Select
                  aria-label={`Role for ${user.name}`}
                  value={user.role}
                  onChange={(event) => update.mutate({ id: user.id, role: event.target.value as Role })}
                >
                  <option value="admin">admin</option>
                  <option value="examiner">examiner</option>
                  <option value="candidate">candidate</option>
                </Select>
                <Button type="button" variant="ghost" onClick={() => update.mutate({ id: user.id, active: !user.active })}>
                  {user.active ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <form className="panel stack" onSubmit={submit}>
        <h2>New account</h2>
        <Field label="Name">
          <TextInput value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </Field>
        <Field label="Email">
          <TextInput type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
        </Field>
        <Field label="Temporary password">
          <TextInput type="text" minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
        </Field>
        <Field label="Role">
          <Select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Role })}>
            <option value="candidate">candidate</option>
            <option value="examiner">examiner</option>
            <option value="admin">admin</option>
          </Select>
        </Field>
        <Button type="submit">Create account</Button>
      </form>
    </div>
  )
}
