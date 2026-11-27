import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Shield, UserCheck, UserPlus, Users, UserX, X } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Banner, Button, Field, Select, TextInput } from '../components/ui'
import { apiRequest } from '../lib/api-client'
import type { Role } from '../types/domain'

type UserRow = { id: string; name: string; email: string; role: Role; active: boolean }

export function AdminUsersPage() {
  const queryClient = useQueryClient()
  const users = useQuery({ queryKey: ['users'], queryFn: () => apiRequest<UserRow[]>('/users') })
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'' | Role>('')
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'candidate' as Role })
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  const create = useMutation({
    mutationFn: () => apiRequest('/users', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: async () => {
      setForm({ name: '', email: '', password: '', role: 'candidate' })
      setShowCreate(false)
      setNotice({ tone: 'ok', text: 'Account created.' })
      await queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: Error) => setNotice({ tone: 'error', text: error.message }),
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
    onError: (error: Error) => setNotice({ tone: 'error', text: error.message }),
  })

  const filtered = useMemo(() => {
    const list = users.data ?? []
    const term = search.trim().toLowerCase()
    return list.filter((user) => {
      if (roleFilter && user.role !== roleFilter) return false
      if (term && !user.name.toLowerCase().includes(term) && !user.email.toLowerCase().includes(term)) {
        return false
      }
      return true
    })
  }, [users.data, search, roleFilter])

  const counts = useMemo(() => {
    const list = users.data ?? []
    return {
      total: list.length,
      admin: list.filter((u) => u.role === 'admin').length,
      examiner: list.filter((u) => u.role === 'examiner').length,
      candidate: list.filter((u) => u.role === 'candidate').length,
    }
  }, [users.data])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    create.mutate()
  }

  return (
    <section className="stack">
      <div className="admin-header">
        <div>
          <h1 className="page-title">People</h1>
          <div className="meta-row">
            <span className="meta-chip"><Users size={14} /> {counts.total}</span>
            <span className="meta-chip"><Shield size={14} /> {counts.admin} admin</span>
            <span className="meta-chip">{counts.examiner} examiner</span>
            <span className="meta-chip">{counts.candidate} candidates</span>
          </div>
        </div>
        <Button
          type="button"
          variant={showCreate ? 'ghost' : 'solid'}
          onClick={() => {
            setShowCreate((prev) => !prev)
            setNotice(null)
          }}
        >
          {showCreate ? <X size={16} /> : <UserPlus size={16} />}
          {showCreate ? 'Close' : 'Create account'}
        </Button>
      </div>

      {notice && <Banner tone={notice.tone}>{notice.text}</Banner>}

      {showCreate && (
        <form className="panel stack compact-form" onSubmit={submit}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>New account</h2>
            <Button
              type="button"
              variant="ghost"
              className="btn-icon"
              aria-label="Close form"
              onClick={() => setShowCreate(false)}
            >
              <X size={16} />
            </Button>
          </div>
          <div className="compact-grid">
            <Field label="Full name">
              <TextInput
                placeholder="e.g. Zara Ahmed"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
              />
            </Field>
            <Field label="Email">
              <TextInput
                type="email"
                placeholder="zara@holdfast.test"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                required
              />
            </Field>
            <Field label="Password (min 8)">
              <TextInput
                type="text"
                minLength={8}
                placeholder="Temporary password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                required
              />
            </Field>
            <Field label="Role">
              <Select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Role })}>
                <option value="candidate">candidate</option>
                <option value="examiner">examiner</option>
                <option value="admin">admin</option>
              </Select>
            </Field>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: '0.25rem' }}>
            <Button type="button" variant="ghost" className="btn-sm" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="submit" className="btn-sm" disabled={create.isPending}>
              <UserPlus size={15} />
              {create.isPending ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </form>
      )}

      <div className="row">
        <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
          <Search
            size={15}
            aria-hidden="true"
            style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-soft)', pointerEvents: 'none' }}
          />
          <TextInput
            className="compact-input"
            style={{ paddingLeft: '2.1rem' }}
            aria-label="Search people"
            placeholder="Search name or email…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select
          aria-label="Filter by role"
          className="inline-select"
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value as '' | Role)}
        >
          <option value="">All roles</option>
          <option value="admin">admin</option>
          <option value="examiner">examiner</option>
          <option value="candidate">candidate</option>
        </Select>
      </div>

      {users.isPending && <p className="meta">Loading…</p>}
      {users.error && <Banner tone="error">{users.error.message}</Banner>}

      {users.data && filtered.length === 0 ? (
        <Banner>No matching accounts.</Banner>
      ) : (
        <div className="panel" style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Person</th>
                <th>Status</th>
                <th>Role</th>
                <th style={{ textAlign: 'right' }}>Access</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.name}</strong>
                    <div className="meta">{user.email}</div>
                  </td>
                  <td>
                    <span className={user.active ? 'pill ok' : 'pill danger'}>
                      {user.active ? 'active' : 'inactive'}
                    </span>
                  </td>
                  <td>
                    <Select
                      aria-label={`Role for ${user.name}`}
                      className="inline-select"
                      value={user.role}
                      onChange={(event) => update.mutate({ id: user.id, role: event.target.value as Role })}
                    >
                      <option value="admin">admin</option>
                      <option value="examiner">examiner</option>
                      <option value="candidate">candidate</option>
                    </Select>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Button
                      type="button"
                      variant="ghost"
                      className="btn-icon"
                      aria-label={user.active ? `Deactivate ${user.name}` : `Activate ${user.name}`}
                      title={user.active ? 'Deactivate' : 'Activate'}
                      onClick={() => update.mutate({ id: user.id, active: !user.active })}
                    >
                      {user.active ? <UserX size={16} /> : <UserCheck size={16} />}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
