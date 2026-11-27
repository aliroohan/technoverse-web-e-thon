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
  Percent,
  Send,
  XCircle,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Banner, Button, Field, TextInput } from '../components/ui'
import { apiRequest, downloadPdf, notifyError, notifySuccess } from '../lib/api-client'
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
  const finalized = papers.filter((p) => p.status !== 'in_progress' && p.totalMarks > 0)
  const averagePct = finalized.length
    ? Math.round(
        (finalized.reduce((sum, p) => sum + p.totalScore / p.totalMarks, 0) / finalized.length) * 100,
      )
    : null

  return (
    <section className="stack">
      <div className="row" style={{ gap: '0.85rem' }}>
        <Link
          to="/examiner/candidates"
          className="btn-ghost btn-icon"
          aria-label="Back to candidates"
          title="Back"
        >
          <ArrowLeft size={16} />
        </Link>
        <span className="student-avatar" style={{ width: '44px', height: '44px', fontSize: '1rem' }} aria-hidden="true">
          {initialsOf(student.name)}
        </span>
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title" style={{ fontSize: 'clamp(1.45rem, 2.8vw, 2rem)', margin: 0 }}>
            {student.name}
          </h1>
          <div className="meta">{student.email}</div>
        </div>
      </div>

      <div className="stat-strip">
        <div className="stat-tile">
          <div>
            <div className="stat-value">{papers.length}</div>
            <div className="stat-label">Papers</div>
          </div>
          <span className="stat-icon" aria-hidden="true"><FileText size={18} /></span>
        </div>
        <div className={checkedTotal > 0 ? 'stat-tile ok' : 'stat-tile'}>
          <div>
            <div className="stat-value">{checkedTotal}</div>
            <div className="stat-label">Checked</div>
          </div>
          <span className="stat-icon" aria-hidden="true"><CheckCircle2 size={18} /></span>
        </div>
        <div className={uncheckedTotal > 0 ? 'stat-tile warn' : 'stat-tile'}>
          <div>
            <div className="stat-value">{uncheckedTotal}</div>
            <div className="stat-label">Pending</div>
          </div>
          <span className="stat-icon" aria-hidden="true"><AlertCircle size={18} /></span>
        </div>
        <div className="stat-tile">
          <div>
            <div className="stat-value">{averagePct !== null ? `${averagePct}%` : '—'}</div>
            <div className="stat-label">Average</div>
          </div>
          <span className="stat-icon" aria-hidden="true"><Percent size={18} /></span>
        </div>
      </div>

      {notice && <Banner tone={notice.tone}>{notice.text}</Banner>}

      {papers.length === 0 ? (
        <Banner>No papers attended yet.</Banner>
      ) : (
        <ul className="list">
          {papers.map((paper) => {
            const isOpen = expanded[paper.attemptId] ?? paper.needsChecking
            const pct = paper.totalMarks > 0 ? Math.min(100, Math.round((paper.totalScore / paper.totalMarks) * 100)) : 0
            return (
              <li className="exam-card" key={paper.attemptId}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="stack" style={{ gap: '0.4rem' }}>
                    <div className="row" style={{ gap: '0.45rem' }}>
                      {paper.needsChecking ? (
                        <span className="pill warn meta-chip">
                          <AlertCircle size={12} /> unchecked
                        </span>
                      ) : paper.status === 'graded' ? (
                        <span className="pill ok meta-chip">
                          <CheckCircle2 size={12} /> graded
                        </span>
                      ) : (
                        <span className="pill">{paper.status.replace('_', ' ')}</span>
                      )}
                      {paper.resultsPublished && (
                        <span className="pill ok meta-chip" title="Results published">
                          <Send size={11} /> published
                        </span>
                      )}
                    </div>
                    <h2 style={{ margin: 0, fontFamily: 'var(--serif)', fontWeight: 540, fontSize: '1.3rem', lineHeight: 1.2 }}>
                      {paper.examTitle}
                    </h2>
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

                <div className="dossier-stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))' }}>
                  <div className="dossier-stat">
                    <span className="dossier-stat-val">{paper.objectiveScore}</span>
                    <span className="dossier-stat-key">Objective</span>
                  </div>
                  <div className="dossier-stat">
                    <span className="dossier-stat-val">{paper.writtenScore}</span>
                    <span className="dossier-stat-key">Written</span>
                  </div>
                  <div className="dossier-stat">
                    <span className="dossier-stat-val">{paper.status === 'in_progress' ? '—' : `${pct}%`}</span>
                    <span className="dossier-stat-key">Result</span>
                  </div>
                  <div className="dossier-stat">
                    <span className="dossier-stat-val" style={{ fontSize: '0.9rem', fontWeight: 520 }}>
                      <Clock size={13} style={{ color: 'var(--ink-soft)' }} />
                      {formatWhen(paper.submittedAt ?? paper.startedAt)}
                    </span>
                    <span className="dossier-stat-key">{paper.submittedAt ? 'Submitted' : 'Started'}</span>
                  </div>
                </div>

                {isOpen && (
                  <PaperCheckingSection
                    paper={paper}
                    onSaved={async (msg) => {
                      notifySuccess(msg)
                      setNotice(null)
                      await refresh()
                    }}
                    onError={(msg) => notifyError(msg)}
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
    <div
      className="stack"
      style={{
        paddingTop: '0.85rem',
        borderTop: '1px solid var(--line)',
        animation: 'panelReveal 220ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
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
        let awarded = 0
        if (question.type === 'single') {
          const only = [...selected]
          awarded = only.length === 1 && correct.size === 1 && only[0] !== undefined && correct.has(only[0]) ? question.marks : 0
        } else if (correct.size > 0) {
          let correctSelected = 0
          let wrongSelected = 0
          for (const id of selected) {
            if (correct.has(id)) correctSelected += 1
            else wrongSelected += 1
          }
          awarded = Math.max(0, Math.round(((correctSelected - wrongSelected) / correct.size) * question.marks * 100) / 100)
        }
        const pillTone = awarded >= question.marks ? 'pill ok meta-chip' : awarded > 0 ? 'pill warn meta-chip' : 'pill danger meta-chip'

        return (
          <div
            className="stack"
            key={question.questionId}
            style={{
              background: 'var(--paper)',
              border: '1px solid rgba(221, 212, 196, 0.85)',
              borderRadius: '12px',
              padding: '0.8rem 0.95rem',
              gap: '0.5rem',
            }}
          >
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <strong style={{ fontSize: '0.96rem' }}>
                {idx + 1}. {question.stem}
              </strong>
              <span className={pillTone} style={{ flexShrink: 0 }}>
                {awarded > 0 ? <Check size={13} /> : <XCircle size={13} />}
                {awarded} / {question.marks}
              </span>
            </div>
            <div className="qbank-choices" style={{ marginTop: 0 }}>
              {question.choices.map((choice) => {
                const picked = selected.has(choice.id)
                const isRight = correct.has(choice.id)
                return (
                  <span
                    key={choice.id}
                    className={picked ? (isRight ? 'qbank-choice correct' : 'qbank-choice wrong') : 'qbank-choice'}
                    style={!picked ? { background: 'var(--paper-2)' } : undefined}
                  >
                    {picked ? (isRight ? <Check size={13} /> : <XCircle size={13} />) : null}
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
    <form
      className="stack"
      onSubmit={(event) => void submit(event)}
      style={{
        background: 'var(--paper)',
        border: '1px solid rgba(221, 212, 196, 0.85)',
        borderRadius: '12px',
        padding: '0.9rem 1rem',
      }}
    >
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <strong style={{ fontSize: '0.96rem' }}>
          {index + 1}. {question.stem}
        </strong>
        <span className={existing ? 'pill ok' : 'pill warn'} style={{ flexShrink: 0 }}>
          {existing ? `${existing.awardedMarks} / ${question.marks}` : `0–${question.marks}`}
        </span>
      </div>

      <div className="response-box" style={{ background: 'var(--paper-2)' }}>
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
