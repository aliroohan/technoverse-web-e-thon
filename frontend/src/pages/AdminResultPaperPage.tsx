import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { useState } from 'react'
import { Area, Banner, Button, Field, Pagination, TextInput } from '../components/ui'
import { apiRequest, downloadPdf } from '../lib/api-client'
import { formatWhen } from '../lib/format'
import type { ExamSummary } from '../types/domain'

type PaperQuestion = {
  id: string
  questionId: string
  stem: string
  type: 'single' | 'multi' | 'written'
  category: string
  difficulty: string
  choices: { id: string; text: string }[]
  correctChoiceIds: string[]
  marks: number
  pinned: boolean
  order: number
}

type StudentWrittenQuestion = {
  questionId: string
  order: number
  stem: string
  marks: number
  awardedMarks: number | null
  comment: string
  graderName: string | null
}

type StudentComment = {
  questionId: string
  order: number
  stem: string
  awardedMarks: number
  maxMarks: number
  comment: string
  graderName: string
}

type StudentResultRow = {
  attemptId: string | null
  candidateId: string
  candidateName: string
  candidateEmail: string
  status: 'in_progress' | 'submitted' | 'expired' | 'graded'
  gradingStatus: 'pending_subjective' | 'ready' | null
  objectiveScore: number
  writtenScore: number
  totalScore: number
  totalMarks: number
  submittedAt: string | null
  teacherComment: string
  writtenQuestions: StudentWrittenQuestion[]
  questionComments: StudentComment[]
  verification: { code: string; revoked: boolean; issuedAt: string } | null
}

type PaperDetail = {
  exam: ExamSummary & { examinerName: string; examinerEmail: string }
  questions: PaperQuestion[]
  students: {
    items: StudentResultRow[]
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export function AdminResultPaperPage() {
  const { examId } = useParams({ strict: false }) as { examId: string }
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState<{ tone: 'info' | 'error' | 'ok'; text: string } | null>(null)
  const [editing, setEditing] = useState<StudentResultRow | null>(null)

  const detail = useQuery({
    queryKey: ['admin-paper-detail', examId, page, search],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '10' })
      if (search.trim()) params.set('search', search.trim())
      return apiRequest<PaperDetail>(`/admin/papers/${examId}?${params.toString()}`)
    },
  })

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin-paper-detail', examId] })
    await queryClient.invalidateQueries({ queryKey: ['admin-papers'] })
  }

  const togglePublication = useMutation({
    mutationFn: (published: boolean) =>
      apiRequest(`/admin/papers/${examId}/results-publication`, {
        method: 'POST',
        body: JSON.stringify({ published }),
      }),
    onSuccess: async (_data, published) => {
      setNotice({
        tone: 'ok',
        text: published ? 'Results published for all graded candidates.' : 'Results unpublished.',
      })
      await refresh()
    },
    onError: (error: Error) => setNotice({ tone: 'error', text: error.message }),
  })

  if (detail.isPending) return <p className="meta">Loading question paper…</p>
  if (detail.error || !detail.data) {
    return <Banner tone="error">{detail.error?.message ?? 'Could not load question paper.'}</Banner>
  }

  const { exam, questions, students } = detail.data

  return (
    <section className="stack">
      <div>
        <Link to="/admin/logs" className="meta">
          ← Back to student log
        </Link>
      </div>

      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p className="meta">
            {exam.lifecycle} · {exam.resultsPublished ? 'results published' : 'results unpublished'}
          </p>
          <h1 className="page-title">{exam.title}</h1>
          <p className="meta">
            Window {formatWhen(exam.windowStart)} – {formatWhen(exam.windowEnd)} · {exam.durationMinutes} min ·{' '}
            {exam.totalMarks} total marks
          </p>
        </div>
        <Button
          type="button"
          variant={exam.resultsPublished ? 'ghost' : 'solid'}
          disabled={togglePublication.isPending}
          onClick={() => togglePublication.mutate(!exam.resultsPublished)}
        >
          {exam.resultsPublished ? 'Unpublish results' : 'Publish results'}
        </Button>
      </div>

      {notice && <Banner tone={notice.tone}>{notice.text}</Banner>}

      {/* 1. Questions in paper */}
      <section className="stack">
        <h2>Questions in paper ({questions.length})</h2>
        {questions.length === 0 ? (
          <Banner>No questions assigned to this paper yet.</Banner>
        ) : (
          <ol className="list">
            {questions.map((question, index) => (
              <li className="card" key={question.id}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>
                    {index + 1}. {question.stem}
                  </strong>
                  <span className="pill">{question.marks} marks</span>
                </div>
                <p className="meta" style={{ margin: '0.35rem 0 0' }}>
                  {question.type} · {question.category} · {question.difficulty}
                  {question.pinned ? ' · pinned' : ''}
                </p>
                {question.choices.length > 0 && (
                  <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
                    {question.choices.map((choice) => {
                      const isCorrect = question.correctChoiceIds.includes(choice.id)
                      return (
                        <li key={choice.id} className={isCorrect ? '' : 'meta'}>
                          {choice.text} {isCorrect ? <strong>(correct)</strong> : null}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* 2. Examiner name */}
      <section className="panel">
        <p className="meta" style={{ margin: 0 }}>
          Examiner
        </p>
        <h2 style={{ margin: '0.15rem 0 0' }}>
          {exam.examinerName}
          {exam.examinerEmail ? <span className="meta" style={{ fontSize: '0.95rem', fontWeight: 400 }}> · {exam.examinerEmail}</span> : null}
        </h2>
      </section>

      {/* 3. Students who attempted this paper, their marks, and teacher comments */}
      <section className="stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>Students who attempted this paper ({students.total})</h2>
          <form
            className="row"
            onSubmit={(event) => {
              event.preventDefault()
              setPage(1)
              setSearch(searchInput)
            }}
          >
            <TextInput
              aria-label="Filter students"
              placeholder="Search student name or email…"
              value={searchInput}
              onChange={(event) => {
                const value = event.target.value
                setSearchInput(value)
                if (value === '') {
                  setPage(1)
                  setSearch('')
                }
              }}
            />
            <Button type="submit" variant="ghost">
              Filter
            </Button>
          </form>
        </div>

        {editing && (
          <ManageStudentResultPanel
            key={editing.attemptId ?? editing.candidateId}
            student={editing}
            onClose={() => setEditing(null)}
            onSaved={async (msg) => {
              setNotice({ tone: 'ok', text: msg })
              setEditing(null)
              await refresh()
            }}
            onError={(msg) => setNotice({ tone: 'error', text: msg })}
          />
        )}

        {students.items.length === 0 ? (
          <Banner>No students have attempted this question paper yet.</Banner>
        ) : (
          <div className="panel" style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Status</th>
                  <th>Marks</th>
                  <th>Teacher comments</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.items.map((student) => {
                  const canManage = student.attemptId !== null && student.status !== 'in_progress'
                  return (
                    <tr key={student.attemptId ?? student.candidateId}>
                      <td>
                        <strong>{student.candidateName}</strong>
                        <div className="meta">{student.candidateEmail}</div>
                      </td>
                      <td>
                        <span className="pill">{student.status.replace('_', ' ')}</span>
                        {student.gradingStatus === 'pending_subjective' && (
                          <div className="meta">pending written grade</div>
                        )}
                      </td>
                      <td>
                        <strong>
                          {student.totalScore} / {student.totalMarks}
                        </strong>
                        <div className="meta">
                          Obj {student.objectiveScore} · Written {student.writtenScore}
                        </div>
                      </td>
                      <td>
                        {student.questionComments.length === 0 && !student.teacherComment ? (
                          <span className="meta">—</span>
                        ) : (
                          <div className="stack" style={{ gap: '0.25rem' }}>
                            {student.questionComments.map((item) => (
                              <div key={item.questionId}>
                                <span className="meta">Q{item.order + 1} ({item.graderName}):</span>{' '}
                                {item.comment}
                              </div>
                            ))}
                            {student.teacherComment && (
                              <div>
                                <span className="meta">Overall:</span> {student.teacherComment}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="row">
                          {canManage && (
                            <Button type="button" variant="ghost" onClick={() => setEditing(student)}>
                              Manage result
                            </Button>
                          )}
                          {canManage && student.attemptId && (
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() =>
                                void downloadPdf(
                                  `/reports/${student.attemptId}/pdf`,
                                  `holdfast-${student.attemptId}.pdf`,
                                )
                              }
                            >
                              PDF
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          page={students.page}
          totalPages={students.totalPages}
          total={students.total}
          label="students"
          onPageChange={setPage}
        />
      </section>
    </section>
  )
}

function ManageStudentResultPanel({
  student,
  onClose,
  onSaved,
  onError,
}: {
  student: StudentResultRow
  onClose: () => void
  onSaved: (message: string) => Promise<void>
  onError: (message: string) => void
}) {
  const [objectiveScore, setObjectiveScore] = useState(student.objectiveScore)
  const [teacherComment, setTeacherComment] = useState(student.teacherComment)
  const [written, setWritten] = useState(
    () =>
      student.writtenQuestions.map((q) => ({
        questionId: q.questionId,
        order: q.order,
        stem: q.stem,
        marks: q.marks,
        awardedMarks: q.awardedMarks ?? 0,
        comment: q.comment,
      })),
  )
  const [saving, setSaving] = useState(false)

  if (!student.attemptId) return null
  const attemptId = student.attemptId

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      await apiRequest(`/admin/attempts/${attemptId}/result`, {
        method: 'PATCH',
        body: JSON.stringify({
          teacherComment,
          objectiveScore,
          writtenGrades: written.map((item) => ({
            questionId: item.questionId,
            awardedMarks: item.awardedMarks,
            comment: item.comment,
          })),
        }),
      })
      await onSaved(`Updated result for ${student.candidateName}.`)
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not update result')
    } finally {
      setSaving(false)
    }
  }

  const toggleVerification = async () => {
    if (!student.verification) return
    setSaving(true)
    try {
      const nextRevoked = !student.verification.revoked
      await apiRequest(`/admin/attempts/${attemptId}/verification`, {
        method: 'PATCH',
        body: JSON.stringify({ revoked: nextRevoked }),
      })
      await onSaved(
        nextRevoked
          ? `Revoked verification code ${student.verification.code}.`
          : `Restored verification code ${student.verification.code}.`,
      )
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not update verification status')
    } finally {
      setSaving(false)
    }
  }

  const writtenMax = written.reduce((sum, q) => sum + q.marks, 0)
  const maxObjective = Math.max(0, student.totalMarks - writtenMax)

  return (
    <form className="panel stack" onSubmit={(event) => void save(event)}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h2>Manage result: {student.candidateName}</h2>
          <p className="meta">
            {student.candidateEmail} · Submitted {formatWhen(student.submittedAt)}
          </p>
        </div>
        <Button type="button" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>

      {maxObjective > 0 && (
        <Field label={`Objective score (0–${maxObjective})`}>
          <TextInput
            type="number"
            min={0}
            max={maxObjective}
            step="0.01"
            value={objectiveScore}
            onChange={(event) => setObjectiveScore(Number(event.target.value))}
          />
        </Field>
      )}

      {written.map((item, idx) => (
        <div className="card stack" key={item.questionId}>
          <strong>
            Q{item.order + 1}. {item.stem}
          </strong>
          <div className="grid two">
            <Field label={`Awarded marks (0–${item.marks})`}>
              <TextInput
                type="number"
                min={0}
                max={item.marks}
                step="0.01"
                value={item.awardedMarks}
                onChange={(event) => {
                  const value = Number(event.target.value)
                  setWritten((prev) => prev.map((row, i) => (i === idx ? { ...row, awardedMarks: value } : row)))
                }}
              />
            </Field>
            <Field label="Teacher question comment">
              <TextInput
                value={item.comment}
                onChange={(event) => {
                  const value = event.target.value
                  setWritten((prev) => prev.map((row, i) => (i === idx ? { ...row, comment: value } : row)))
                }}
              />
            </Field>
          </div>
        </div>
      ))}

      <Field label="Overall teacher / admin comment">
        <Area
          value={teacherComment}
          onChange={(event) => setTeacherComment(event.target.value)}
          placeholder="Optional overall feedback shown on the student's result"
        />
      </Field>

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save result changes'}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
        {student.verification && (
          <Button type="button" variant="ghost" disabled={saving} onClick={() => void toggleVerification()}>
            {student.verification.revoked
              ? `Restore report (${student.verification.code})`
              : `Revoke report (${student.verification.code})`}
          </Button>
        )}
      </div>
    </form>
  )
}
