import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import {
  Activity,
  ArrowLeft,
  BarChart2,
  Calendar,
  Check,
  CheckSquare,
  Clock,
  FileText,
  Layers,
  Pencil,
  Play,
  Plus,
  Scale,
  Send,
  SlidersHorizontal,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { CandidateForm, CandidateImport, type DirectoryPerson } from '../components/CandidateTools'
import { VerifyShare } from '../components/VerifyShare'
import { QuestionForm, emptyQuestion, questionPayload, questionToDraft } from '../components/QuestionForm'
import { Banner, Button, Dialog, Drawer, Field, Loader, TextInput, Area } from '../components/ui'
import { apiRequest } from '../lib/api-client'
import { formatWhen, toDateTimeLocal } from '../lib/format'
import type { ExamSummary, Question } from '../types/domain'

type Desk = ExamSummary & {
  questions: {
    questionId: string
    stem: string
    type: string
    category: string
    difficulty: string
    marks: number
    pinned: boolean
    order: number
  }[]
  enrollments: { candidateId: string; name: string; email: string }[]
}

type Grading = {
  resultsPublished: boolean
  canPublishResults: boolean
  publishBlockReason: string | null
  attempts: {
    id: string
    candidateName: string
    status: string
    gradingStatus: string | null
    totalScore: number
    totalMarks: number
    verificationCode: string | null
    questions: {
      questionId: string
      stem: string
      type: string
      marks: number
      choices: { id: string; text: string }[]
      correctChoiceIds: string[]
      answer: { choiceIds: string[]; text: string }
    }[]
    grades: { questionId: string; awardedMarks: number; comment: string }[]
  }[]
}

type Analytics = {
  enrolled: number
  submitted: number
  completion: number
  mean: number
  distribution: { label: string; count: number }[]
  candidates: { name: string; totalScore: number; totalMarks: number }[]
}

type QuestionStats = {
  empty: boolean
  notice: string | null
  questions: {
    questionId: string
    stem: string
    type: string
    marks: number
    presented: number
    skipped: number
    incorrect: number | null
    empiricalDifficulty: number | null
    averageAwarded: number | null
    commonMiss: { text: string; count: number } | null
  }[]
}

type Preview = {
  budget: number | null
  papers: {
    weight: number
    sampledWeight: number
    questions: { stem: string; category: string; difficulty: string; weight: number }[]
  }[]
}

const tabs: readonly { id: 'setup' | 'questions' | 'people' | 'monitor' | 'marking' | 'insights' | 'fairness'; label: string; icon: ReactNode }[] = [
  { id: 'setup', label: 'Setup', icon: <SlidersHorizontal size={15} /> },
  { id: 'questions', label: 'Paper', icon: <FileText size={15} /> },
  { id: 'people', label: 'People', icon: <Users size={15} /> },
  { id: 'monitor', label: 'Monitor', icon: <Activity size={15} /> },
  { id: 'marking', label: 'Marking', icon: <CheckSquare size={15} /> },
  { id: 'insights', label: 'Insights', icon: <BarChart2 size={15} /> },
  { id: 'fairness', label: 'Fairness', icon: <Scale size={15} /> },
]

type Tab = (typeof tabs)[number]['id']

export function ExamDeskPage() {
  const { examId } = useParams({ strict: false }) as { examId: string }
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('setup')
  const [notice, setNotice] = useState('')
  const desk = useQuery({
    queryKey: ['exam', examId],
    queryFn: () => apiRequest<Desk>(`/exams/${examId}`),
  })

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['exam', examId] })
  }

  if (desk.isPending) return <Loader label="Loading examination desk" />
  if (desk.isError || !desk.data) {
    return (
      <section className="stack">
        <div>
          <Link to="/examiner/exams" className="btn-ghost btn-icon" aria-label="Back to examinations" title="Back">
            <ArrowLeft size={16} />
          </Link>
        </div>
        <Banner tone="error">
          {desk.error instanceof Error ? desk.error.message : 'Could not load examination.'}
        </Banner>
        <div>
          <Button type="button" variant="ghost" onClick={() => void desk.refetch()}>Retry</Button>
        </div>
      </section>
    )
  }
  const exam = desk.data

  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const nextIndex =
      event.key === 'ArrowRight'
        ? (currentIndex + 1) % tabs.length
        : (currentIndex - 1 + tabs.length) % tabs.length
    const nextTab = tabs[nextIndex]
    if (nextTab) setTab(nextTab.id)
  }

  return (
    <section>
      <div className="row" style={{ gap: '0.75rem', alignItems: 'center', marginBottom: '0.25rem' }}>
        <Link to="/examiner/exams" className="btn-ghost btn-icon" aria-label="Back to examinations" title="Back">
          <ArrowLeft size={16} />
        </Link>
        <p className="meta" style={{ margin: 0 }}>{exam.lifecycle}{exam.resultsPublished ? ' · published' : ''}</p>
      </div>
      <h1 className="page-title">{exam.title}</h1>
      {notice && <Banner>{notice}</Banner>}
      <div className="tabs" role="tablist" aria-label="Examination sections">
        {tabs.map((item, idx) => (
          <button
            key={item.id}
            id={`tab-${item.id}`}
            type="button"
            className="btn-ghost"
            role="tab"
            aria-selected={tab === item.id}
            aria-controls={`panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => setTab(item.id)}
            onKeyDown={(event) => onTabKeyDown(event, idx)}
          >
            {item.icon} {item.label}
          </button>
        ))}
      </div>
      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'setup' && <Setup exam={exam} onSaved={refresh} onNotice={setNotice} />}
        {tab === 'questions' && <Questions exam={exam} onSaved={refresh} onNotice={setNotice} />}
        {tab === 'people' && <People exam={exam} onSaved={refresh} onNotice={setNotice} />}
        {tab === 'monitor' && <Monitor examId={exam.id} />}
        {tab === 'marking' && <Marking examId={exam.id} onNotice={setNotice} />}
        {tab === 'insights' && <Insights examId={exam.id} />}
        {tab === 'fairness' && (
          <Fairness
            examId={exam.id}
            onSandbox={async () => {
              const attempt = await apiRequest<{ id: string }>(`/exams/${exam.id}/sandbox`, { method: 'POST' })
              await navigate({ to: '/exam/$attemptId', params: { attemptId: attempt.id } })
            }}
          />
        )}
      </div>
    </section>
  )
}

function Setup({ exam, onSaved, onNotice }: { exam: Desk; onSaved: () => Promise<void>; onNotice: (value: string) => void }) {
  const [instructions, setInstructions] = useState(exam.instructions)
  const [windowEnd, setWindowEnd] = useState(toDateTimeLocal(exam.windowEnd))
  const [duration, setDuration] = useState(exam.durationMinutes)
  const [fairPaper, setFairPaper] = useState(exam.settings.fairPaper)
  const [questionCount, setQuestionCount] = useState(exam.settings.questionCount ?? 6)
  const [budget, setBudget] = useState(exam.settings.difficultyBudget ?? 10)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const locked = exam.publication === 'published'

  const save = async () => {
    setSaving(true)
    try {
      await apiRequest(`/exams/${exam.id}`, {
        method: 'PATCH',
        body: JSON.stringify(
          locked
            ? { instructions, windowEnd: new Date(windowEnd).toISOString() }
            : {
                instructions,
                windowEnd: new Date(windowEnd).toISOString(),
                durationMinutes: duration,
                settings: { ...exam.settings, fairPaper, questionCount, difficultyBudget: budget },
              },
        ),
      })
      onNotice('Examination saved.')
      await onSaved()
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const publish = async () => {
    setPublishing(true)
    try {
      await apiRequest(`/exams/${exam.id}/publish`, { method: 'POST' })
      onNotice('Published. Candidates can enter when the window opens.')
      await onSaved()
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Could not publish')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="panel stack">
      <div className="meta-row">
        <span className="meta-chip"><Calendar size={14} /> {formatWhen(exam.windowStart)} – {formatWhen(exam.windowEnd)}</span>
        <span className="meta-chip"><Clock size={14} /> {exam.durationMinutes}m</span>
      </div>
      <Field label="Instructions">
        <Area value={instructions} onChange={(event) => setInstructions(event.target.value)} />
      </Field>
      <Field label="Window end">
        <TextInput type="datetime-local" value={windowEnd} onChange={(event) => setWindowEnd(event.target.value)} />
      </Field>
      {!locked && (
        <>
          <Field label="Duration minutes">
            <TextInput type="number" min={1} value={duration} onChange={(event) => setDuration(Number(event.target.value))} />
          </Field>
          <label className="row">
            <input type="checkbox" checked={fairPaper} onChange={(event) => setFairPaper(event.target.checked)} />
            Fair paper (difficulty budget)
          </label>
          <Field label="Questions per paper">
            <TextInput type="number" min={1} value={questionCount} onChange={(event) => setQuestionCount(Number(event.target.value))} />
          </Field>
          <Field label="Difficulty budget">
            <TextInput type="number" min={1} value={budget} onChange={(event) => setBudget(Number(event.target.value))} />
          </Field>
        </>
      )}
      {locked && <p className="meta">Settings locked after publish; close time can still be extended.</p>}
      <div className="row">
        <Button type="button" loading={saving} disabled={publishing} onClick={() => void save()}>
          <Check size={15} /> Save
        </Button>
        {exam.publication === 'draft' && (
          <Button type="button" variant="ghost" loading={publishing} disabled={saving} onClick={() => void publish()}>
            <Send size={15} /> Publish
          </Button>
        )}
      </div>
    </div>
  )
}

function Questions({ exam, onSaved, onNotice }: { exam: Desk; onSaved: () => Promise<void>; onNotice: (value: string) => void }) {
  const queryClient = useQueryClient()
  const bank = useQuery({ queryKey: ['questions'], queryFn: () => apiRequest<Question[]>('/questions') })
  const [bankOpen, setBankOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [adding, setAdding] = useState(false)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [editor, setEditor] = useState<null | { mode: 'create' } | { mode: 'edit'; question: Question }>(null)
  const [now] = useState(() => Date.now())
  const draft = exam.publication === 'draft'
  const canEdit = new Date(exam.windowStart).getTime() > now
  const onPaper = new Set(exam.questions.map((question) => question.questionId))

  const toggle = (id: string) => {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  const addSelected = async () => {
    setAdding(true)
    try {
      await apiRequest(`/exams/${exam.id}/questions/bulk`, {
        method: 'POST',
        body: JSON.stringify({ questionIds: selected }),
      })
      const count = selected.length
      setSelected([])
      setBankOpen(false)
      onNotice(count === 1 ? '1 question added to the paper.' : `${count} questions added to the paper.`)
      await onSaved()
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Could not assign')
      await onSaved()
    } finally {
      setAdding(false)
    }
  }

  const openEdit = async (questionId: string) => {
    setOpeningId(questionId)
    try {
      const known = bank.data?.find((question) => question.id === questionId)
      const question = known ?? (await apiRequest<Question>(`/questions/${questionId}`))
      setEditor({ mode: 'edit', question })
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Could not open that question')
    } finally {
      setOpeningId(null)
    }
  }

  const saveQuestion = async (form: Parameters<typeof questionPayload>[0]) => {
    const payload = questionPayload(form)
    if (editor?.mode === 'edit') {
      await apiRequest(`/questions/${editor.question.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
      if (draft) {
        await apiRequest(`/exams/${exam.id}/questions/${editor.question.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ marks: payload.marks }),
        })
      }
      onNotice('Question updated.')
    } else {
      const created = await apiRequest<Question>('/questions', { method: 'POST', body: JSON.stringify(payload) })
      await queryClient.invalidateQueries({ queryKey: ['questions'] })
      if (draft) {
        await apiRequest(`/exams/${exam.id}/questions`, {
          method: 'POST',
          body: JSON.stringify({ questionId: created.id, marks: payload.marks }),
        })
      }
      onNotice(draft ? 'Question added to the paper.' : 'Question saved to the bank.')
    }
    await queryClient.invalidateQueries({ queryKey: ['questions'] })
    await onSaved()
    setEditor(null)
  }

  return (
    <div className="stack">
      {draft && (
        <div className="row">
          <Button type="button" onClick={() => setEditor({ mode: 'create' })}>
            <Plus size={15} /> New question
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSelected([])
              setBankOpen(true)
            }}
          >
            <Layers size={15} /> From bank
          </Button>
        </div>
      )}
      {!canEdit && <p className="meta">Locked after exam start.</p>}
      {canEdit && !draft && (
        <p className="meta">Published: question text can still be edited until start.</p>
      )}
      <ul className="list">
        {exam.questions.map((question) => (
          <li className="card" key={question.questionId}>
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <div>
                <strong>{question.stem}</strong>
                <div className="meta">{question.type} · {question.category} · {question.difficulty} · {question.marks} pts {question.pinned ? '· pinned' : ''}</div>
              </div>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                {canEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="btn-icon"
                    aria-label={`Edit ${question.stem}`}
                    title="Edit"
                    disabled={openingId === question.questionId}
                    onClick={() => void openEdit(question.questionId)}
                  >
                    <Pencil size={15} />
                  </Button>
                )}
                {draft && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="btn-icon"
                    aria-label={`Remove ${question.stem}`}
                    title="Remove"
                    disabled={removingId === question.questionId}
                    onClick={async () => {
                      setRemovingId(question.questionId)
                      try {
                        await apiRequest(`/exams/${exam.id}/questions/${question.questionId}`, { method: 'DELETE' })
                        await onSaved()
                      } catch (error) {
                        onNotice(error instanceof Error ? error.message : 'Could not remove question')
                      } finally {
                        setRemovingId(null)
                      }
                    }}
                  >
                    <Trash2 size={15} />
                  </Button>
                )}
              </div>
            </div>
          </li>
        ))}
        {exam.questions.length === 0 && <li className="meta">No questions yet.</li>}
      </ul>
      {bankOpen && (
        <Drawer
          title="Questions"
          onClose={() => setBankOpen(false)}
          footer={
            <Button type="button" loading={adding} disabled={selected.length === 0} onClick={() => void addSelected()}>
              {selected.length === 1 ? 'Add 1 question' : `Add ${selected.length} questions`}
            </Button>
          }
        >
          {bank.isLoading && <Loader label="Loading questions" />}
          {bank.data?.length === 0 && <p className="meta">The bank is empty. Create a question first.</p>}
          {bank.data?.map((question) => {
            const taken = onPaper.has(question.id)
            return (
              <label className="pick" key={question.id}>
                <input
                  type="checkbox"
                  checked={taken || selected.includes(question.id)}
                  disabled={taken}
                  onChange={() => toggle(question.id)}
                />
                <span>
                  <strong>{question.stem}</strong>
                  <span className="meta">
                    {question.type} · {question.category} · {question.difficulty} · {question.marks} marks
                    {taken ? ' · on this paper' : ''}
                  </span>
                </span>
              </label>
            )
          })}
        </Drawer>
      )}
      {editor && (
        <Dialog title={editor.mode === 'edit' ? 'Edit question' : 'New question'} onClose={() => setEditor(null)}>
          <QuestionForm
            key={editor.mode === 'edit' ? editor.question.id : 'new'}
            initial={editor.mode === 'edit' ? questionToDraft(editor.question) : emptyQuestion()}
            submitLabel={editor.mode === 'edit' ? 'Save changes' : 'Save question'}
            submitBlock
            onSubmit={saveQuestion}
          />
        </Dialog>
      )}
    </div>
  )
}

function People({ exam, onSaved, onNotice }: { exam: Desk; onSaved: () => Promise<void>; onNotice: (value: string) => void }) {
  const queryClient = useQueryClient()
  const users = useQuery({
    queryKey: ['candidates'],
    queryFn: () => apiRequest<DirectoryPerson[]>('/users?role=candidate'),
  })
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [enrolling, setEnrolling] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [panel, setPanel] = useState<'list' | 'new' | 'import'>('list')
  const enrolled = new Set(exam.enrollments.map((person) => person.candidateId))

  const toggle = (id: string) => {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  const enroll = async () => {
    setEnrolling(true)
    try {
      await apiRequest(`/exams/${exam.id}/enrollments/bulk`, {
        method: 'POST',
        body: JSON.stringify({ candidateIds: selected }),
      })
      const count = selected.length
      setSelected([])
      setOpen(false)
      onNotice(count === 1 ? '1 candidate enrolled.' : `${count} candidates enrolled.`)
      await onSaved()
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Could not enroll')
      await onSaved()
    } finally {
      setEnrolling(false)
    }
  }

  const refreshDirectory = async () => {
    await queryClient.invalidateQueries({ queryKey: ['candidates'] })
  }

  return (
    <div className="stack">
      <div className="row">
        <Button
          type="button"
          onClick={() => {
            setPanel('list')
            setSelected([])
            setOpen(true)
          }}
        >
          <UserPlus size={15} /> Add candidates
        </Button>
      </div>
      <ul className="list">
        {exam.enrollments.map((person) => (
          <li className="card row" key={person.candidateId} style={{ justifyContent: 'space-between' }}>
            <span>{person.name} <span className="meta">{person.email}</span></span>
            <Button
              type="button"
              variant="ghost"
              className="btn-icon"
              aria-label={`Remove ${person.name}`}
              title="Remove"
              disabled={removingId === person.candidateId}
              onClick={async () => {
                setRemovingId(person.candidateId)
                try {
                  await apiRequest(`/exams/${exam.id}/enrollments/${person.candidateId}`, { method: 'DELETE' })
                  await onSaved()
                } catch (error) {
                  onNotice(error instanceof Error ? error.message : 'Could not remove candidate')
                } finally {
                  setRemovingId(null)
                }
              }}
            >
              <Trash2 size={15} />
            </Button>
          </li>
        ))}
        {exam.enrollments.length === 0 && <li className="meta">No enrollments yet.</li>}
      </ul>
      {open && (
        <Drawer
          title="Candidates"
          onClose={() => setOpen(false)}
          footer={
            panel === 'list' ? (
              <Button type="button" loading={enrolling} disabled={selected.length === 0} onClick={() => void enroll()}>
                {selected.length === 1 ? 'Enroll 1' : `Enroll ${selected.length}`}
              </Button>
            ) : undefined
          }
        >
          <div className="row">
            <Button type="button" variant={panel === 'new' ? 'solid' : 'ghost'} onClick={() => setPanel(panel === 'new' ? 'list' : 'new')}>
              New candidate
            </Button>
            <Button type="button" variant={panel === 'import' ? 'solid' : 'ghost'} onClick={() => setPanel(panel === 'import' ? 'list' : 'import')}>
              Import
            </Button>
          </div>
          {panel === 'new' && (
            <CandidateForm
              onCreated={async (person) => {
                onNotice(`${person.name} was added. ${person.passwordNote} Select them to enroll.`)
                setPanel('list')
                await refreshDirectory()
              }}
            />
          )}
          {panel === 'import' && (
            <CandidateImport
              onCancel={() => setPanel('list')}
              onAdded={async (result) => {
                const problems = result.errors.map((error) => `Row ${error.row}: ${error.message}`).join(' ')
                onNotice(`${result.passwordNote} Added ${result.created}. Select who should sit this examination. ${problems}`.trim())
                setPanel('list')
                await refreshDirectory()
              }}
            />
          )}
          {panel === 'list' && (
            <>
              {users.error && <Banner tone="error">{users.error.message}</Banner>}
              {users.isLoading && <Loader label="Loading candidates" />}
              {users.data?.length === 0 && <p className="meta">No candidates yet. Add one, or import a file.</p>}
              {users.data?.map((person) => {
                const taken = enrolled.has(person.id)
                return (
                  <label className="pick" key={person.id}>
                    <input
                      type="checkbox"
                      checked={taken || selected.includes(person.id)}
                      disabled={taken}
                      onChange={() => toggle(person.id)}
                    />
                    <span>
                      <strong>{person.name}</strong>
                      <span className="meta">{person.email}{taken ? ' · enrolled' : ''}</span>
                    </span>
                  </label>
                )
              })}
            </>
          )}
        </Drawer>
      )}
    </div>
  )
}

function Monitor({ examId }: { examId: string }) {
  const roster = useQuery({
    queryKey: ['monitor', examId],
    queryFn: () =>
      apiRequest<{ attemptId: string; candidateName: string; answered: number; total: number; online: boolean; deadlineAt: string }[]>(
        `/exams/${examId}/monitoring`,
      ),
    refetchInterval: 5000,
  })
  const incidents = useQuery({
    queryKey: ['incidents', examId],
    queryFn: () =>
      apiRequest<{ notice: string; incidents: { id: string; type: string; at: string; attemptId: string }[] }>(`/exams/${examId}/incidents`),
    refetchInterval: 5000,
  })
  const [body, setBody] = useState('')
  const [announceError, setAnnounceError] = useState('')
  const [sending, setSending] = useState(false)

  return (
    <div className="stack">
      <Banner>{incidents.data?.notice ?? 'Signals are not a finding of misconduct.'}</Banner>
      {(roster.isError || incidents.isError) && (
        <Banner tone="error">
          {roster.error instanceof Error
            ? roster.error.message
            : incidents.error instanceof Error
              ? incidents.error.message
              : 'Could not load monitoring data.'}
        </Banner>
      )}
      {roster.isPending && <Loader label="Loading live roster" />}
      <ul className="list">
        {roster.data?.map((row) => (
          <li className="card" key={row.attemptId}>
            <strong>{row.candidateName}</strong>
            <div className="meta">{row.answered}/{row.total} answered · {row.online ? 'online' : 'not recently seen'} · deadline {formatWhen(row.deadlineAt)}</div>
          </li>
        ))}
        {roster.data?.length === 0 && <li className="meta">No active attempts.</li>}
      </ul>
      {announceError && <Banner tone="error">{announceError}</Banner>}
      <form
        className="row"
        onSubmit={async (event) => {
          event.preventDefault()
          if (!body.trim()) return
          setSending(true)
          setAnnounceError('')
          try {
            await apiRequest(`/exams/${examId}/announcements`, { method: 'POST', body: JSON.stringify({ body: body.trim() }) })
            setBody('')
          } catch (err) {
            setAnnounceError(err instanceof Error ? err.message : 'Could not send announcement')
          } finally {
            setSending(false)
          }
        }}
      >
        <TextInput aria-label="Announcement" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Announcement to the room" />
        <Button type="submit" loading={sending} disabled={!body.trim()}><Send size={15} /> Send</Button>
      </form>
      <ul className="list">
        {incidents.data?.incidents.map((incident) => (
          <li key={incident.id} className="meta">{formatWhen(incident.at)} · {incident.type} · not a verdict</li>
        ))}
      </ul>
    </div>
  )
}

function Marking({ examId, onNotice }: { examId: string; onNotice: (value: string) => void }) {
  const queryClient = useQueryClient()
  const grading = useQuery({ queryKey: ['grading', examId], queryFn: () => apiRequest<Grading>(`/exams/${examId}/grading`) })
  const [publishing, setPublishing] = useState(false)

  const publish = async () => {
    setPublishing(true)
    try {
      await apiRequest(`/exams/${examId}/publish-results`, { method: 'POST' })
      onNotice('Results published. Candidates can now see their own scores.')
      await queryClient.invalidateQueries({ queryKey: ['grading', examId] })
      await queryClient.invalidateQueries({ queryKey: ['exam', examId] })
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Could not publish')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="stack">
      {grading.isPending && <Loader label="Loading submissions" />}
      {grading.isError && (
        <Banner tone="error">
          {grading.error instanceof Error ? grading.error.message : 'Could not load grading data.'}
        </Banner>
      )}
      <div className="stack">
        <Button
          type="button"
          onClick={() => void publish()}
          loading={publishing}
          disabled={!grading.data || grading.data.resultsPublished || !grading.data.canPublishResults}
        >
          {grading.data?.resultsPublished ? 'Results are published' : 'Publish results'}
        </Button>
        {!grading.data?.resultsPublished && grading.data?.publishBlockReason && (
          <p className="meta">{grading.data.publishBlockReason}</p>
        )}
      </div>
      {grading.data?.attempts.map((attempt) => (
        <article className="card stack" key={attempt.id}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong>{attempt.candidateName}</strong>
            <span>{attempt.totalScore} / {attempt.totalMarks} · {attempt.gradingStatus}</span>
          </div>
          {attempt.gradingStatus === 'pending_subjective' && (
            <p className="meta" style={{ margin: 0 }}>This result stays hidden until the written answers are marked.</p>
          )}
          {grading.data?.resultsPublished && attempt.gradingStatus === 'ready' && attempt.verificationCode && (
            <VerifyShare code={attempt.verificationCode} />
          )}
          {attempt.questions.filter((question) => question.type === 'written').map((question) => (
            <WrittenMark key={question.questionId} examId={examId} attemptId={attempt.id} question={question} existing={attempt.grades.find((grade) => grade.questionId === question.questionId)} />
          ))}
        </article>
      ))}
    </div>
  )
}

function WrittenMark({
  examId,
  attemptId,
  question,
  existing,
}: {
  examId: string
  attemptId: string
  question: Grading['attempts'][number]['questions'][number]
  existing?: { awardedMarks: number; comment: string }
}) {
  const queryClient = useQueryClient()
  const [marks, setMarks] = useState(existing?.awardedMarks ?? 0)
  const [comment, setComment] = useState(existing?.comment ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  return (
    <form
      className="stack"
      onSubmit={async (event) => {
        event.preventDefault()
        setSaving(true)
        try {
          await apiRequest(`/grading/${attemptId}/questions/${question.questionId}`, {
            method: 'PUT',
            body: JSON.stringify({ awardedMarks: marks, comment }),
          })
          setError('')
          await queryClient.invalidateQueries({ queryKey: ['grading', examId] })
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not save mark')
        } finally {
          setSaving(false)
        }
      }}
    >
      <p>{question.stem}</p>
      <p className="meta">Response: {question.answer.text || 'No response'}</p>
      <Field label={`Awarded marks, maximum ${question.marks}`}>
        <TextInput type="number" min={0} max={question.marks} value={marks} onChange={(event) => setMarks(Number(event.target.value))} />
      </Field>
      <Field label="Comment">
        <TextInput value={comment} onChange={(event) => setComment(event.target.value)} />
      </Field>
      {error && <Banner tone="error">{error}</Banner>}
      <Button type="submit" variant="ghost" loading={saving}>Save mark</Button>
    </form>
  )
}

function Insights({ examId }: { examId: string }) {
  const analytics = useQuery({ queryKey: ['analytics', examId], queryFn: () => apiRequest<Analytics>(`/exams/${examId}/analytics`) })
  const questions = useQuery({ queryKey: ['q-analytics', examId], queryFn: () => apiRequest<QuestionStats>(`/exams/${examId}/question-analytics`) })
  const data = analytics.data
  const max = Math.max(1, ...(data?.distribution.map((bucket) => bucket.count) ?? [1]))

  return (
    <div className="stack">
      {(analytics.isPending || questions.isPending) && <Loader label="Loading insights" />}
      {(analytics.isError || questions.isError) && (
        <Banner tone="error">
          {analytics.error instanceof Error
            ? analytics.error.message
            : questions.error instanceof Error
              ? questions.error.message
              : 'Could not load examination insights.'}
        </Banner>
      )}
      {data && (
        <div className="card">
          <p>{data.submitted} of {data.enrolled} enrolled have a finalized attempt. Mean {data.mean}. Completion {Math.round(data.completion * 100)}%.</p>
          <div className="bars">
            {data.distribution.map((bucket) => (
              <div key={bucket.label}>
                <span className="meta">{bucket.label} · {bucket.count}</span>
                <div className="bar" aria-hidden="true"><span style={{ width: `${(bucket.count / max) * 100}%` }} /></div>
              </div>
            ))}
          </div>
          <ul>
            {data.candidates.map((candidate) => (
              <li key={candidate.name}>{candidate.name}: {candidate.totalScore}/{candidate.totalMarks}</li>
            ))}
          </ul>
        </div>
      )}
      {questions.data?.empty && <Banner>{questions.data.notice}</Banner>}
      <ul className="list">
        {questions.data?.questions
          .slice()
          .sort((a, b) => concern(b) - concern(a))
          .map((question) => (
            <QuestionInsight key={question.questionId} question={question} />
          ))}
      </ul>
    </div>
  )
}

function concern(question: QuestionStats['questions'][number]) {
  if (question.empiricalDifficulty !== null) return question.empiricalDifficulty
  if (question.averageAwarded !== null && question.marks > 0) return 1 - question.averageAwarded / question.marks
  if (question.presented > 0) return question.skipped / question.presented
  return 0
}

function practiceLabel(value: number) {
  if (value < 0.3) return 'Easy in practice'
  if (value <= 0.6) return 'Mixed'
  return 'Hard in practice'
}

function practiceTone(value: number) {
  if (value < 0.3) return 'ok'
  if (value <= 0.6) return 'warn'
  return 'danger'
}

function InsightMeter({ label, detail, value, tone }: { label: string; detail: string; value: number; tone: 'pine' | 'brass' | 'clay' }) {
  const width = `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`
  return (
    <div className="insight-meter">
      <div className="insight-meter-label">
        <span>{label}</span>
        <span className="meta">{detail}</span>
      </div>
      <div className={`bar ${tone}`} aria-hidden="true"><span style={{ width }} /></div>
    </div>
  )
}

function QuestionInsight({ question }: { question: QuestionStats['questions'][number] }) {
  const answered = question.presented - question.skipped
  const skipRate = question.presented > 0 ? question.skipped / question.presented : 0
  const wrongRate = question.incorrect !== null && answered > 0 ? question.incorrect / answered : 0
  const awardedRate = question.averageAwarded !== null && question.marks > 0 ? question.averageAwarded / question.marks : 0

  return (
    <li className="card insight-card">
      <div className="insight-head">
        <strong>{question.stem}</strong>
        {question.empiricalDifficulty !== null && (
          <span className={`pill ${practiceTone(question.empiricalDifficulty)}`}>{practiceLabel(question.empiricalDifficulty)}</span>
        )}
        {question.empiricalDifficulty === null && question.type === 'written' && <span className="pill">Written</span>}
      </div>
      <p className="meta" style={{ margin: 0 }}>Sat by {question.presented}</p>
      <div className="bars">
        <InsightMeter
          label="Skipped"
          detail={`${question.skipped} of ${question.presented} left blank`}
          value={skipRate}
          tone={skipRate > 0.25 ? 'brass' : 'pine'}
        />
        {question.type === 'written' ? (
          <InsightMeter
            label="Average awarded"
            detail={question.averageAwarded === null ? 'Not marked yet' : `${question.averageAwarded} of ${question.marks}`}
            value={awardedRate}
            tone="pine"
          />
        ) : (
          <InsightMeter
            label="Incorrect"
            detail={answered === 0 ? 'No answers yet' : `${question.incorrect ?? 0} of ${answered} answers wrong`}
            value={wrongRate}
            tone={wrongRate > 0.6 ? 'clay' : wrongRate > 0.3 ? 'brass' : 'pine'}
          />
        )}
        {question.empiricalDifficulty !== null && (
          <InsightMeter
            label="Observed difficulty"
            detail={`${question.empiricalDifficulty} · wrong answers among those who responded`}
            value={question.empiricalDifficulty}
            tone={question.empiricalDifficulty > 0.6 ? 'clay' : question.empiricalDifficulty > 0.3 ? 'brass' : 'pine'}
          />
        )}
      </div>
      {question.commonMiss && (
        <p className="insight-miss">Most often chose “{question.commonMiss.text}” · {question.commonMiss.count}</p>
      )}
    </li>
  )
}

function Fairness({ examId, onSandbox }: { examId: string; onSandbox: () => Promise<void> }) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  return (
    <div className="stack">
      <p className="meta">Two difficulty-balanced draws from the bank. Sandbox attempts are excluded from statistics.</p>
      {error && <Banner tone="error">{error}</Banner>}
      <div className="row">
        <Button
          type="button"
          disabled={pending}
          onClick={async () => {
            setPending(true)
            setError('')
            try {
              setPreview(await apiRequest<Preview>(`/exams/${examId}/preview-papers`, { method: 'POST' }))
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not preview papers')
            } finally {
              setPending(false)
            }
          }}
        >
          <Scale size={15} /> Preview papers
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={async () => {
            setPending(true)
            setError('')
            try {
              await onSandbox()
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not start sandbox')
              setPending(false)
            }
          }}
        >
          <Play size={15} /> Sandbox
        </Button>
      </div>
      <div className="grid two">
        {preview?.papers.map((paper, index) => (
          <article className="card" key={index}>
            <h2>Paper {index + 1}</h2>
            <p className="meta">
              Sampled difficulty {paper.sampledWeight} · budget {preview.budget ?? '—'} · paper weight {paper.weight}
            </p>
            <ol>
              {paper.questions.map((question) => (
                <li key={question.stem}>{question.stem} <span className="meta">{question.category} · {question.difficulty} · w{question.weight}</span></li>
              ))}
            </ol>
          </article>
        ))}
      </div>
    </div>
  )
}
