import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import {
  AlertCircle,
  ArrowLeft,
  Award,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileDown,
  FileText,
  Send,
  UserCheck,
  UserX,
  XCircle,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Banner, Button, Field, TextInput } from '../components/ui'
import { apiRequest, downloadPdf } from '../lib/api-client'
import { formatWhen } from '../lib/format'

type StudentPaperQuestion = {
  questionId: string
  order: number
  stem: string
  type: 'single' | 'multi' | 'written'
  marks: number
  choices: { id: string; text: string }[]
  correctChoiceIds: string[]
  answer: { choiceIds: string[]; text: string }
}

type StudentPaper = {
  attemptId: string
  examId: string
  examTitle: string
  lifecycle: string
  resultsPublished: boolean
  status: 'in_progress' | 'submitted' | 'expired' | 'graded'
  gradingStatus: 'pending_subjective' | 'ready' | null
  needsChecking: boolean
  startedAt: string
  submittedAt: string | null
  objectiveScore: number
  writtenScore: number
  totalScore: number
  totalMarks: number
  teacherComment: string
  questions: StudentPaperQuestion[]
  grades: { questionId: string; awardedMarks: number; comment: string }[]
}

type StudentDetailResponse = {
  student: { id: string; name: string; email: string; active: boolean }
  papers: StudentPaper[]
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function ExaminerStudentPage() {
  const { candidateId } = useParams({ strict: false }) as { candidateId: string }
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  const detail = useQuery({
    queryKey: ['examiner-student', candidateId],
    queryFn: () => apiRequest<StudentDetailResponse>(`/candidates/students/${candidateId}`),
  })

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['examiner-student', candidateId] })
    await queryClient.invalidateQueries({ queryKey: ['examiner-students'] })
  }

  if (detail.isPending) return <p className="meta">Loading…</p>
  if (detail.error || !detail.data) {
    return <Banner tone="error">{detail.error?.message ?? 'Could not load student.'}</Banner>
  }

  const { student, papers } = detail.data
  const uncheckedTotal = papers.filter((p) => p.needsChecking).length
  const checkedTotal = papers.filter((p) => p.status !== 'in_progress' && !p.needsChecking).length

  return (
    <section className="stack">
      <div className="row">
        <Link
          to="/examiner/candidates"
          className="btn-ghost btn-icon"
          aria-label="Back to candidates"
          title="Back"
        >
          <ArrowLeft size={16} />
        </Link>
      </div>

      <div className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="row" style={{ gap: '0.9rem' }}>
            <span className="student-avatar" style={{ width: '46px', height: '46px', fontSize: '1.05rem' }} aria-hidden="true">
              {initialsOf(student.name)}
            </span>
            <div>
              <h1 className="page-title" style={{ fontSize: 'clamp(1.5rem, 3vw, 2.1rem)', marginBottom: '0.15rem' }}>
                {student.name}
              </h1>
              <div className="meta-row">
                <span>{student.email}</span>
                <span className={student.active ? 'pill ok meta-chip' : 'pill danger meta-chip'} title={student.active ? 'Active' : 'Inactive'}>
                  {student.active ? <UserCheck size={12} /> : <UserX size={12} />}
                </span>
              </div>
            </div>
          </div>
          <div className="meta-row">
            <span className="meta-chip" title="Attended papers">
              <FileText size={14} /> {papers.length}
            </span>
            <span className="meta-chip" title="Checked papers">
              <CheckCircle2 size={14} /> {checkedTotal}
            </span>
            {uncheckedTotal > 0 && (
              <span className="pill warn meta-chip" title="Unchecked papers">
                <AlertCircle size={13} /> {uncheckedTotal}
              </span>
            )}
          </div>
        </div>
      </div>

      {notice && <Banner tone={notice.tone}>{notice.text}</Banner>}

      {papers.length === 0 ? (
        <Banner>No papers attended yet.</Banner>
      ) : (
        <ul className="list">
          {papers.map((paper) => {
            const isOpen = expanded[paper.attemptId] ?? paper.needsChecking
            return (
              <li className="card stack" key={paper.attemptId}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div className="row" style={{ marginBottom: '0.3rem' }}>
                      <h2 style={{ margin: 0 }}>{paper.examTitle}</h2>
                      {paper.needsChecking ? (
                        <span className="pill warn meta-chip" title="Needs checking">
                          <AlertCircle size={13} /> unchecked
                        </span>
                      ) : (
                        <span className="pill">{paper.status.replace('_', ' ')}</span>
                      )}
                      {paper.resultsPublished && (
                        <span className="pill ok meta-chip" title="Published">
                          <Send size={12} />
                        </span>
                      )}
                    </div>
                    <div className="meta-row">
                      <span className="meta-chip">
                        <Clock size={14} /> {formatWhen(paper.submittedAt ?? paper.startedAt)}
                      </span>
                      <span>
                        {paper.objectiveScore} + {paper.writtenScore}
                      </span>
                    </div>
                  </div>

                  <div className="row">
                    <span className="score-pill" title="Total marks">
                      <Award size={15} /> {paper.totalScore} / {paper.totalMarks}
                    </span>
                    {paper.status !== 'in_progress' && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="btn-icon"
                        aria-label={`Download PDF for ${paper.examTitle}`}
                        title="Download PDF"
                        onClick={() =>
                          void downloadPdf(`/reports/${paper.attemptId}/pdf`, `holdfast-${paper.attemptId}.pdf`)
                        }
                      >
                        <FileDown size={15} />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant={paper.needsChecking ? 'solid' : 'ghost'}
                      className="btn-icon"
                      aria-label={isOpen ? 'Collapse paper' : 'Expand paper'}
                      title={paper.needsChecking ? 'Check paper' : isOpen ? 'Collapse' : 'View paper'}
                      onClick={() =>
                        setExpanded((prev) => ({ ...prev, [paper.attemptId]: !isOpen }))
                      }
                    >
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </Button>
                  </div>
                </div>

                {isOpen && (
                  <PaperCheckingSection
                    paper={paper}
                    onSaved={async (msg) => {
                      setNotice({ tone: 'ok', text: msg })
                      await refresh()
                    }}
                    onError={(msg) => setNotice({ tone: 'error', text: msg })}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function PaperCheckingSection({
  paper,
  onSaved,
  onError,
}: {
  paper: StudentPaper
  onSaved: (message: string) => Promise<void>
  onError: (message: string) => void
}) {
  const [publishing, setPublishing] = useState(false)

  const publish = async () => {
    setPublishing(true)
    try {
      await apiRequest(`/exams/${paper.examId}/publish-results`, { method: 'POST' })
      await onSaved(`Published results for ${paper.examTitle}.`)
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not publish results')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="stack" style={{ paddingTop: '0.65rem', borderTop: '1px solid var(--line)' }}>
      {paper.questions.map((question, idx) => {
        if (question.type === 'written') {
          const grade = paper.grades.find((g) => g.questionId === question.questionId)
          return (
            <WrittenQuestionChecker
              key={question.questionId}
              index={idx}
              attemptId={paper.attemptId}
              canGrade={paper.status !== 'in_progress'}
              question={question}
              existing={grade}
              onSaved={() => onSaved(`Saved Q${idx + 1}.`)}
              onError={onError}
            />
          )
        }

        const selected = new Set(question.answer.choiceIds)
        const correct = new Set(question.correctChoiceIds)
        const exact =
          selected.size === correct.size && [...selected].every((id) => correct.has(id))

        return (
          <div className="panel stack" key={question.questionId} style={{ padding: '0.8rem 0.95rem', gap: '0.45rem' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>
                {idx + 1}. {question.stem}
              </strong>
              <span className={exact ? 'pill ok meta-chip' : 'pill danger meta-chip'}>
                {exact ? <Check size={13} /> : <XCircle size={13} />}
                {question.marks}
              </span>
            </div>
            <div className="qbank-choices" style={{ marginTop: 0 }}>
              {question.choices.map((choice) => {
                const picked = selected.has(choice.id)
                const isRight = correct.has(choice.id)
                return (
                  <span
                    key={choice.id}
                    className={isRight ? 'qbank-choice correct' : 'qbank-choice'}
                    style={
                      picked && !isRight
                        ? { background: 'var(--clay-soft)', borderColor: 'rgba(140, 52, 36, 0.28)', color: 'var(--clay)' }
                        : undefined
                    }
                  >
                    {isRight ? <Check size={13} /> : picked ? <XCircle size={13} /> : null}
                    {choice.text}
                  </span>
                )
              })}
            </div>
          </div>
        )
      })}

      {paper.status !== 'in_progress' && !paper.needsChecking && !paper.resultsPublished && (
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Button type="button" className="btn-sm" disabled={publishing} onClick={() => void publish()}>
            <Send size={14} /> Publish
          </Button>
        </div>
      )}
    </div>
  )
}

function WrittenQuestionChecker({
  index,
  attemptId,
  canGrade,
  question,
  existing,
  onSaved,
  onError,
}: {
  index: number
  attemptId: string
  canGrade: boolean
  question: StudentPaperQuestion
  existing?: { awardedMarks: number; comment: string }
  onSaved: () => Promise<void>
  onError: (message: string) => void
}) {
  const [marks, setMarks] = useState(existing?.awardedMarks ?? 0)
  const [comment, setComment] = useState(existing?.comment ?? '')
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      await apiRequest(`/grading/${attemptId}/questions/${question.questionId}`, {
        method: 'PUT',
        body: JSON.stringify({ awardedMarks: marks, comment }),
      })
      await onSaved()
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not save mark')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="panel stack" onSubmit={(event) => void submit(event)} style={{ padding: '0.9rem 1rem' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong>
          {index + 1}. {question.stem}
        </strong>
        <span className={existing ? 'pill ok' : 'pill warn'}>
          {existing ? `${existing.awardedMarks} / ${question.marks}` : `0–${question.marks}`}
        </span>
      </div>

      <div className="response-box">
        {question.answer.text.trim() ? question.answer.text : <span className="meta">—</span>}
      </div>

      {canGrade && (
        <div className="compact-grid" style={{ alignItems: 'end' }}>
          <Field label={`Marks (0–${question.marks})`}>
            <TextInput
              className="compact-input"
              type="number"
              min={0}
              max={question.marks}
              step="0.01"
              value={marks}
              onChange={(event) => setMarks(Number(event.target.value))}
            />
          </Field>
          <Field label="Comment">
            <TextInput
              className="compact-input"
              placeholder="Optional feedback…"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
          </Field>
        </div>
      )}

      {canGrade && (
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Button type="submit" className="btn-sm" disabled={saving}>
            <Check size={14} /> Save
          </Button>
        </div>
      )}
    </form>
  )
}
