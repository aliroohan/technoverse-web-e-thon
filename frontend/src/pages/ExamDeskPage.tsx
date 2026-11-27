import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useState } from 'react'
import { Banner, Button, Field, Select, TextInput, Area } from '../components/ui'
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
  attempts: {
    id: string
    candidateName: string
    status: string
    gradingStatus: string | null
    totalScore: number
    totalMarks: number
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
    presented: number
    skipped: number
    incorrect: number | null
    empiricalDifficulty: number | null
    averageAwarded: number | null
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

const tabs = ['setup', 'questions', 'people', 'monitor', 'marking', 'insights', 'fairness'] as const

export function ExamDeskPage() {
  const { examId } = useParams({ strict: false }) as { examId: string }
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [tab, setTab] = useState<(typeof tabs)[number]>('setup')
  const [notice, setNotice] = useState('')
  const desk = useQuery({
    queryKey: ['exam', examId],
    queryFn: () => apiRequest<Desk>(`/exams/${examId}`),
  })

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['exam', examId] })
  }

  if (!desk.data) return <p>Loading the desk…</p>
  const exam = desk.data

  return (
    <section>
      <p className="meta">{exam.lifecycle}{exam.resultsPublished ? ' · results published' : ''}</p>
      <h1 className="page-title">{exam.title}</h1>
      {notice && <Banner>{notice}</Banner>}
      <div className="tabs" role="tablist">
        {tabs.map((item) => (
          <button key={item} type="button" className="btn-ghost" role="tab" aria-selected={tab === item} onClick={() => setTab(item)}>
            {item}
          </button>
        ))}
      </div>
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
  const locked = exam.publication === 'published'

  const save = async () => {
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
    }
  }

  const publish = async () => {
    try {
      await apiRequest(`/exams/${exam.id}/publish`, { method: 'POST' })
      onNotice('Published. Candidates can enter when the window opens.')
      await onSaved()
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Could not publish')
    }
  }

  return (
    <div className="panel stack">
      <p className="meta">Opens {formatWhen(exam.windowStart)} · closes {formatWhen(exam.windowEnd)} · {exam.durationMinutes} min</p>
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
          <Field label="Questions on each paper, including pinned">
            <TextInput type="number" min={1} value={questionCount} onChange={(event) => setQuestionCount(Number(event.target.value))} />
          </Field>
          <Field label="Difficulty budget for the sampled questions">
            <TextInput type="number" min={1} value={budget} onChange={(event) => setBudget(Number(event.target.value))} />
          </Field>
        </>
      )}
      {locked && <p className="meta">Duration, the question set, and fairness settings are locked. You can still extend the close time.</p>}
      <div className="row">
        <Button type="button" onClick={() => void save()}>Save</Button>
        {exam.publication === 'draft' && (
          <Button type="button" variant="ghost" onClick={() => void publish()}>Publish</Button>
        )}
      </div>
    </div>
  )
}

function Questions({ exam, onSaved, onNotice }: { exam: Desk; onSaved: () => Promise<void>; onNotice: (value: string) => void }) {
  const bank = useQuery({ queryKey: ['questions'], queryFn: () => apiRequest<Question[]>('/questions') })
  const [questionId, setQuestionId] = useState('')

  const add = async () => {
    try {
      await apiRequest(`/exams/${exam.id}/questions`, { method: 'POST', body: JSON.stringify({ questionId }) })
      await onSaved()
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Could not assign')
    }
  }

  return (
    <div className="stack">
      <ul className="list">
        {exam.questions.map((question) => (
          <li className="card" key={question.questionId}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <strong>{question.stem}</strong>
                <div className="meta">{question.type} · {question.category} · {question.difficulty} · {question.marks} marks {question.pinned ? '· pinned' : ''}</div>
              </div>
              {exam.publication === 'draft' && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void apiRequest(`/exams/${exam.id}/questions/${question.questionId}`, { method: 'DELETE' }).then(onSaved)}
                >
                  Remove
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {exam.publication === 'draft' && (
        <div className="row">
          <Select aria-label="Question to assign" value={questionId} onChange={(event) => setQuestionId(event.target.value)}>
            <option value="">Choose a bank question</option>
            {bank.data?.map((question) => (
              <option key={question.id} value={question.id}>{question.stem}</option>
            ))}
          </Select>
          <Button type="button" onClick={() => void add()} disabled={!questionId}>Assign</Button>
        </div>
      )}
    </div>
  )
}

function People({ exam, onSaved, onNotice }: { exam: Desk; onSaved: () => Promise<void>; onNotice: (value: string) => void }) {
  const users = useQuery({
    queryKey: ['candidates'],
    queryFn: () => apiRequest<{ id: string; name: string; email: string; role: string }[]>('/users?role=candidate'),
  })
  const [candidateId, setCandidateId] = useState('')
  const [csv, setCsv] = useState('name,email')

  return (
    <div className="stack">
      <ul className="list">
        {exam.enrollments.map((person) => (
          <li className="card row" key={person.candidateId} style={{ justifyContent: 'space-between' }}>
            <span>{person.name} <span className="meta">{person.email}</span></span>
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                void apiRequest(`/exams/${exam.id}/enrollments/${person.candidateId}`, { method: 'DELETE' })
                  .then(onSaved)
                  .catch((error: Error) => onNotice(error.message))
              }
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <div className="row">
        <Select aria-label="Candidate" value={candidateId} onChange={(event) => setCandidateId(event.target.value)}>
          <option value="">Choose a candidate</option>
          {users.data?.map((user) => (
            <option key={user.id} value={user.id}>{user.name}</option>
          ))}
        </Select>
        <Button
          type="button"
          disabled={!candidateId}
          onClick={() =>
            void apiRequest(`/exams/${exam.id}/enrollments`, { method: 'POST', body: JSON.stringify({ candidateId }) })
              .then(onSaved)
              .catch((error: Error) => onNotice(error.message))
          }
        >
          Enroll
        </Button>
      </div>
      {users.error && <Banner tone="error">Only an administrator can list every account. Ask an admin for candidate ids, or import a CSV below.</Banner>}
      <form
        className="panel stack"
        onSubmit={(event) => {
          event.preventDefault()
          void apiRequest<{ created: number; enrolled: number; errors: { row: number; message: string }[]; passwordNote: string }>(
            `/exams/${exam.id}/candidates/import`,
            { method: 'POST', body: JSON.stringify({ format: 'csv', content: csv }) },
          )
            .then((result) => {
              onNotice(`${result.passwordNote} Created ${result.created}, enrolled ${result.enrolled}. ${result.errors.map((error) => `Row ${error.row}: ${error.message}`).join(' ')}`)
              return onSaved()
            })
            .catch((error: Error) => onNotice(error.message))
        }}
      >
        <h2>Import candidates</h2>
        <Area value={csv} onChange={(event) => setCsv(event.target.value)} />
        <Button type="submit" variant="ghost">Import CSV</Button>
      </form>
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

  return (
    <div className="stack">
      <Banner>{incidents.data?.notice ?? 'Signals are not a finding of misconduct.'}</Banner>
      <ul className="list">
        {roster.data?.map((row) => (
          <li className="card" key={row.attemptId}>
            <strong>{row.candidateName}</strong>
            <div className="meta">{row.answered}/{row.total} answered · {row.online ? 'online' : 'not recently seen'} · deadline {formatWhen(row.deadlineAt)}</div>
          </li>
        ))}
        {roster.data?.length === 0 && <li className="meta">No active attempts.</li>}
      </ul>
      <form
        className="row"
        onSubmit={(event) => {
          event.preventDefault()
          void apiRequest(`/exams/${examId}/announcements`, { method: 'POST', body: JSON.stringify({ body }) }).then(() => setBody(''))
        }}
      >
        <TextInput aria-label="Announcement" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Announcement to the room" />
        <Button type="submit">Send</Button>
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

  const publish = async () => {
    try {
      await apiRequest(`/exams/${examId}/publish-results`, { method: 'POST' })
      onNotice('Results published. Candidates can now see their own scores.')
      await queryClient.invalidateQueries({ queryKey: ['grading', examId] })
      await queryClient.invalidateQueries({ queryKey: ['exam', examId] })
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Could not publish')
    }
  }

  return (
    <div className="stack">
      <div className="row">
        <Button type="button" onClick={() => void publish()} disabled={grading.data?.resultsPublished}>
          {grading.data?.resultsPublished ? 'Results are published' : 'Publish results'}
        </Button>
      </div>
      {grading.data?.attempts.map((attempt) => (
        <article className="card stack" key={attempt.id}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong>{attempt.candidateName}</strong>
            <span>{attempt.totalScore} / {attempt.totalMarks} · {attempt.gradingStatus}</span>
          </div>
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

  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault()
        void apiRequest(`/grading/${attemptId}/questions/${question.questionId}`, {
          method: 'PUT',
          body: JSON.stringify({ awardedMarks: marks, comment }),
        })
          .then(async () => {
            setError('')
            await queryClient.invalidateQueries({ queryKey: ['grading', examId] })
          })
          .catch((err: Error) => setError(err.message))
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
      <Button type="submit" variant="ghost">Save mark</Button>
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
        {questions.data?.questions.map((question) => (
          <li className="card" key={question.questionId}>
            <strong>{question.stem}</strong>
            <p className="meta">
              Sat {question.presented}, skipped {question.skipped}
              {question.empiricalDifficulty !== null ? `, empirical difficulty ${question.empiricalDifficulty}` : ''}
              {question.averageAwarded !== null ? `, average awarded ${question.averageAwarded}` : ''}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Fairness({ examId, onSandbox }: { examId: string; onSandbox: () => Promise<void> }) {
  const [preview, setPreview] = useState<Preview | null>(null)

  return (
    <div className="stack">
      <p className="lede">Two draws from the same bank. Pinned questions stay. The rest are chosen so the difficulty weights stay near the budget. Sandbox attempts never enter these statistics.</p>
      <div className="row">
        <Button
          type="button"
          onClick={() => void apiRequest<Preview>(`/exams/${examId}/preview-papers`, { method: 'POST' }).then(setPreview)}
        >
          Preview two papers
        </Button>
        <Button type="button" variant="ghost" onClick={() => void onSandbox()}>
          Open sandbox
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
