import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  Activity,
  ArrowRight,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  FileEdit,
  Plus,
  Scale,
  Search,
  Shuffle,
} from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Banner, Button, Dialog, Field, Loader, Select, TextInput, Area } from '../components/ui'
import { apiRequest } from '../lib/api-client'
import { formatWhen, toDateTimeLocal } from '../lib/format'
import type { ExamSummary } from '../types/domain'

const freshForm = () => {
  const start = new Date()
  const end = new Date(Date.now() + 4 * 60 * 60 * 1000)
  return {
    title: '',
    instructions: '',
    windowStart: toDateTimeLocal(start),
    windowEnd: toDateTimeLocal(end),
    durationMinutes: 30,
    totalMarks: 20,
  }
}

const lifecycleTone = (lifecycle: ExamSummary['lifecycle']) => {
  if (lifecycle === 'ongoing') return 'pill ok meta-chip'
  if (lifecycle === 'published') return 'pill warn meta-chip'
  return 'pill meta-chip'
}

export function ExamListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const exams = useQuery({ queryKey: ['exams'], queryFn: () => apiRequest<ExamSummary[]>('/exams') })
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [lifecycleFilter, setLifecycleFilter] = useState<'' | ExamSummary['lifecycle']>('')
  const [form, setForm] = useState(freshForm)

  const create = useMutation({
    mutationFn: () =>
      apiRequest<ExamSummary>('/exams', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          windowStart: new Date(form.windowStart).toISOString(),
          windowEnd: new Date(form.windowEnd).toISOString(),
          settings: {
            fairPaper: true,
            randomizeQuestions: true,
            randomizeChoices: true,
            questionCount: 6,
            difficultyBudget: 10,
            tolerance: 2,
          },
        }),
      }),
    onSuccess: async (exam) => {
      setOpen(false)
      setForm(freshForm())
      await queryClient.invalidateQueries({ queryKey: ['exams'] })
      await navigate({ to: '/examiner/exams/$examId', params: { examId: exam.id } })
    },
  })

  const stats = useMemo(() => {
    const list = exams.data ?? []
    return {
      total: list.length,
      ongoing: list.filter((e) => e.lifecycle === 'ongoing').length,
      published: list.filter((e) => e.lifecycle === 'published').length,
      draft: list.filter((e) => e.lifecycle === 'draft').length,
    }
  }, [exams.data])

  const filtered = useMemo(() => {
    const list = exams.data ?? []
    const term = search.trim().toLowerCase()
    return list.filter((exam) => {
      if (lifecycleFilter && exam.lifecycle !== lifecycleFilter) return false
      if (term && !exam.title.toLowerCase().includes(term)) return false
      return true
    })
  }, [exams.data, search, lifecycleFilter])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    create.mutate()
  }

  return (
    <section className="stack">
      <div className="admin-header">
        <div>
          <h1 className="page-title">Examinations</h1>
        </div>
        <Button type="button" onClick={() => setOpen(true)}>
          <Plus size={16} /> New exam
        </Button>
      </div>

      <div className="stat-strip">
        <div className="stat-tile">
          <div>
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total papers</div>
          </div>
          <span className="stat-icon" aria-hidden="true"><BookOpen size={18} /></span>
        </div>
        <div className={stats.ongoing > 0 ? 'stat-tile ok' : 'stat-tile'}>
          <div>
            <div className="stat-value">{stats.ongoing}</div>
            <div className="stat-label">Ongoing</div>
          </div>
          <span className="stat-icon" aria-hidden="true"><Activity size={18} /></span>
        </div>
        <div className={stats.published > 0 ? 'stat-tile warn' : 'stat-tile'}>
          <div>
            <div className="stat-value">{stats.published}</div>
            <div className="stat-label">Scheduled</div>
          </div>
          <span className="stat-icon" aria-hidden="true"><Calendar size={18} /></span>
        </div>
        <div className="stat-tile">
          <div>
            <div className="stat-value">{stats.draft}</div>
            <div className="stat-label">Drafts</div>
          </div>
          <span className="stat-icon" aria-hidden="true"><FileEdit size={18} /></span>
        </div>
      </div>

      <div className="row">
        <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
          <Search
            size={15}
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '0.72rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--ink-soft)',
              pointerEvents: 'none',
            }}
          />
          <TextInput
            className="compact-input"
            style={{ paddingLeft: '2.1rem' }}
            aria-label="Search examinations"
            placeholder="Search examinations…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select
          aria-label="Filter by status"
          className="inline-select"
          value={lifecycleFilter}
          onChange={(event) => setLifecycleFilter(event.target.value as '' | ExamSummary['lifecycle'])}
        >
          <option value="">All statuses</option>
          <option value="ongoing">ongoing</option>
          <option value="published">scheduled</option>
          <option value="draft">draft</option>
          <option value="completed">completed</option>
        </Select>
      </div>

      {exams.isPending && <Loader label="Loading examinations" />}
      {exams.error && <Banner tone="error">{exams.error.message}</Banner>}

      {exams.data && filtered.length === 0 ? (
        <Banner>No examinations match your filter.</Banner>
      ) : (
        <ul className="desk-grid">
          {filtered.map((exam) => (
            <li className="exam-card" key={exam.id}>
              <div className="stack" style={{ gap: '0.55rem' }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span className={lifecycleTone(exam.lifecycle)}>
                    {exam.lifecycle === 'ongoing' && <span className="live-dot" aria-hidden="true" />}
                    {exam.lifecycle}
                  </span>
                  {exam.resultsPublished && (
                    <span className="pill ok meta-chip" title="Results published">
                      <CheckCircle2 size={12} /> published
                    </span>
                  )}
                </div>
                <h2 style={{ margin: 0, fontFamily: 'var(--serif)', fontWeight: 540, fontSize: '1.3rem', lineHeight: 1.2 }}>
                  {exam.title}
                </h2>
              </div>

              <div className="exam-card-tray">
                <div className="meta-row">
                  <span className="meta-chip">
                    <Calendar size={13} /> {formatWhen(exam.windowStart)} – {formatWhen(exam.windowEnd)}
                  </span>
                </div>
                <div className="meta-row">
                  <span className="meta-chip" title="Duration">
                    <Clock size={13} /> {exam.durationMinutes}m
                  </span>
                  <span className="meta-chip" title="Total marks">
                    <Award size={13} /> {exam.totalMarks}
                  </span>
                  {exam.settings.fairPaper && (
                    <span className="meta-chip" title="Fair paper">
                      <Scale size={13} />
                    </span>
                  )}
                  {exam.settings.randomizeQuestions && (
                    <span className="meta-chip" title="Shuffled">
                      <Shuffle size={13} />
                    </span>
                  )}
                </div>
              </div>

              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <Link className="btn btn-sm" to="/examiner/exams/$examId" params={{ examId: exam.id }}>
                  Open <ArrowRight size={14} />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <Dialog title="New examination" onClose={() => setOpen(false)}>
          <form className="stack" onSubmit={submit}>
            <Field label="Title">
              <TextInput
                placeholder="e.g. Data Structures — Final"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                required
              />
            </Field>
            <Field label="Instructions">
              <Area
                placeholder="Instructions shown to candidates…"
                value={form.instructions}
                onChange={(event) => setForm({ ...form, instructions: event.target.value })}
                required
              />
            </Field>
            <div className="compact-grid">
              <Field label="Opens">
                <TextInput
                  type="datetime-local"
                  value={form.windowStart}
                  onChange={(event) => setForm({ ...form, windowStart: event.target.value })}
                  required
                />
              </Field>
              <Field label="Closes">
                <TextInput
                  type="datetime-local"
                  value={form.windowEnd}
                  onChange={(event) => setForm({ ...form, windowEnd: event.target.value })}
                  required
                />
              </Field>
              <Field label="Duration (min)">
                <TextInput
                  type="number"
                  min={1}
                  value={form.durationMinutes}
                  onChange={(event) => setForm({ ...form, durationMinutes: Number(event.target.value) })}
                />
              </Field>
              <Field label="Total marks">
                <TextInput
                  type="number"
                  min={1}
                  value={form.totalMarks}
                  onChange={(event) => setForm({ ...form, totalMarks: Number(event.target.value) })}
                />
              </Field>
            </div>
            <Button type="submit" block loading={create.isPending}>
              <Plus size={15} /> Create draft
            </Button>
            {create.error && <p className="banner error">{create.error.message}</p>}
          </form>
        </Dialog>
      )}
    </section>
  )
}
