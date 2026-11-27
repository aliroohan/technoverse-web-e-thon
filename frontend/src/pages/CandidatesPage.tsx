import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { AlertCircle, BookOpen, CheckCircle2, ChevronRight, FileText, Search, Upload, UserPlus, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CandidateForm, CandidateImport, type CandidateImportResult } from '../components/CandidateTools'
import { Banner, Button, Select, TextInput } from '../components/ui'
import { apiRequest } from '../lib/api-client'

type ExaminerStudentRow = {
  id: string
  name: string
  email: string
  active: boolean
  enrolledCount: number
  attendedCount: number
  uncheckedCount: number
  latestActivityAt: string | null
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function CandidatesPage() {
  const queryClient = useQueryClient()
  const people = useQuery({
    queryKey: ['examiner-students'],
    queryFn: () => apiRequest<ExaminerStudentRow[]>('/candidates/students'),
  })
  const [panel, setPanel] = useState<'closed' | 'create' | 'import'>('closed')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'attended' | 'unchecked'>('all')
  const [notice, setNotice] = useState('')

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['examiner-students'] })
    await queryClient.invalidateQueries({ queryKey: ['candidates'] })
  }

  const filtered = useMemo(() => {
    const list = people.data ?? []
    const term = search.trim().toLowerCase()
    return list.filter((person) => {
      if (filter === 'attended' && person.attendedCount === 0) return false
      if (filter === 'unchecked' && person.uncheckedCount === 0) return false
      if (term && !person.name.toLowerCase().includes(term) && !person.email.toLowerCase().includes(term)) {
        return false
      }
      return true
    })
  }, [people.data, search, filter])

  const totals = useMemo(() => {
    const list = people.data ?? []
    return {
      students: list.length,
      attended: list.filter((s) => s.attendedCount > 0).length,
      unchecked: list.reduce((sum, s) => sum + s.uncheckedCount, 0),
    }
  }, [people.data])

  return (
    <section className="stack">
      <div className="admin-header">
        <div>
          <h1 className="page-title">Candidates</h1>
          <div className="meta-row">
            <span className="meta-chip" title="Total candidates"><Users size={14} /> {totals.students}</span>
            <span className="meta-chip" title="Attended papers"><FileText size={14} /> {totals.attended}</span>
            {totals.unchecked > 0 && (
              <span className="pill warn meta-chip" title="Unchecked papers">
                <AlertCircle size={13} /> {totals.unchecked}
              </span>
            )}
          </div>
        </div>
        {panel === 'closed' && (
          <div className="row">
            <Button
              type="button"
              variant="ghost"
              className="btn-icon"
              aria-label="Import CSV"
              title="Import CSV"
              onClick={() => { setPanel('import'); setNotice('') }}
            >
              <Upload size={16} />
            </Button>
            <Button
              type="button"
              aria-label="Add candidate"
              onClick={() => { setPanel('create'); setNotice('') }}
            >
              <UserPlus size={15} /> Add
            </Button>
          </div>
        )}
      </div>

      {notice && <Banner>{notice}</Banner>}

      {panel === 'create' && (
        <div className="panel stack compact-form">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>New candidate</h2>
            <Button type="button" variant="ghost" className="btn-icon" aria-label="Close" title="Close" onClick={() => setPanel('closed')}>
              <X size={16} />
            </Button>
          </div>
          <CandidateForm
            onCreated={async (person) => {
              setNotice(`${person.name} added. ${person.passwordNote}`)
              setPanel('closed')
              await refresh()
            }}
          />
        </div>
      )}

      {panel === 'import' && (
        <div className="panel stack compact-form">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Import CSV</h2>
            <Button type="button" variant="ghost" className="btn-icon" aria-label="Close" title="Close" onClick={() => setPanel('closed')}>
              <X size={16} />
            </Button>
          </div>
          <CandidateImport
            onCancel={() => setPanel('closed')}
            onAdded={async (result: CandidateImportResult) => {
              const problems = result.errors.map((error) => `Row ${error.row}: ${error.message}`).join(' ')
              setNotice(`${result.passwordNote} Added ${result.created}. ${problems}`.trim())
              setPanel('closed')
              await refresh()
            }}
          />
        </div>
      )}

      <div className="row">
        <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
          <Search
            size={15}
            aria-hidden="true"
            style={{ position: 'absolute', left: '0.72rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-soft)', pointerEvents: 'none' }}
          />
          <TextInput
            className="compact-input"
            style={{ paddingLeft: '2.1rem' }}
            aria-label="Search students"
            placeholder="Search…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select
          aria-label="Filter students"
          className="inline-select"
          value={filter}
          onChange={(event) => setFilter(event.target.value as 'all' | 'attended' | 'unchecked')}
        >
          <option value="all">All</option>
          <option value="attended">Attended</option>
          <option value="unchecked">Unchecked</option>
        </Select>
      </div>

      {people.isPending && <p className="meta">Loading…</p>}
      {people.error && <Banner tone="error">{people.error.message}</Banner>}

      {people.data && filtered.length === 0 ? (
        <Banner>No students found.</Banner>
      ) : (
        <ul className="list">
          {filtered.map((person) => (
            <li className="card" key={person.id}>
              <Link
                to="/examiner/candidates/$candidateId"
                params={{ candidateId: person.id }}
                style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
              >
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div className="row" style={{ gap: '0.8rem' }}>
                    <span className="student-avatar" aria-hidden="true">
                      {initialsOf(person.name)}
                    </span>
                    <div>
                      <strong style={{ fontSize: '1.02rem' }}>{person.name}</strong>
                      <div className="meta">{person.email}</div>
                    </div>
                  </div>
                  <div className="row" style={{ gap: '0.75rem' }}>
                    <span className="meta-chip meta" title={`${person.enrolledCount} enrolled`}>
                      <BookOpen size={14} /> {person.enrolledCount}
                    </span>
                    <span className="meta-chip meta" title={`${person.attendedCount} attended`}>
                      <FileText size={14} /> {person.attendedCount}
                    </span>
                    {person.uncheckedCount > 0 ? (
                      <span className="pill warn meta-chip" title={`${person.uncheckedCount} unchecked`}>
                        <AlertCircle size={13} /> {person.uncheckedCount}
                      </span>
                    ) : person.attendedCount > 0 ? (
                      <span className="pill ok meta-chip" title="Checked" aria-label="Checked">
                        <CheckCircle2 size={13} />
                      </span>
                    ) : null}
                    <ChevronRight size={17} style={{ color: 'var(--ink-soft)' }} aria-hidden="true" />
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
