import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { Calendar, Clock, Eye, Play } from 'lucide-react'
import { Button } from '../components/ui'
import { apiRequest } from '../lib/api-client'
import { formatWhen } from '../lib/format'
import type { CandidateExam } from '../types/domain'

const groups = ['available', 'upcoming', 'completed', 'closed'] as const

export function CandidateHomePage() {
  const navigate = useNavigate()
  const exams = useQuery({ queryKey: ['my-exams'], queryFn: () => apiRequest<CandidateExam[]>('/exams/mine') })
  const start = useMutation({
    mutationFn: (examId: string) => apiRequest<{ id: string }>(`/attempts/start/${examId}`, { method: 'POST' }),
    onSuccess: async (attempt) => {
      await navigate({ to: '/exam/$attemptId', params: { attemptId: attempt.id } })
    },
  })

  return (
    <section className="stack">
      <h1 className="page-title">Your examinations</h1>
      {groups.map((group) => {
        const rows = exams.data?.filter((exam) => exam.access === group) ?? []
        if (rows.length === 0) return null
        return (
          <section key={group} className="stack">
            <h2 style={{ fontFamily: 'var(--serif)', fontWeight: 520, textTransform: 'capitalize', margin: 0 }}>{group}</h2>
            <ul className="list">
              {rows.map((exam) => (
                <li className="card" key={exam.id}>
                  <h3 style={{ margin: '0 0 0.3rem' }}>{exam.title}</h3>
                  <p style={{ margin: '0 0 0.5rem' }}>{exam.instructions}</p>
                  <div className="meta-row" style={{ marginBottom: '0.75rem' }}>
                    <span className="meta-chip"><Calendar size={14} /> {formatWhen(exam.windowStart)} – {formatWhen(exam.windowEnd)}</span>
                    <span className="meta-chip"><Clock size={14} /> {exam.durationMinutes}m</span>
                    <span>{exam.reason}</span>
                  </div>
                  <div className="row">
                    {exam.canEnter && (
                      <Button type="button" onClick={() => start.mutate(exam.id)}>
                        <Play size={15} /> {exam.attemptStatus === 'in_progress' ? 'Resume' : 'Enter'}
                      </Button>
                    )}
                    {exam.access === 'completed' && exam.resultsPublished && exam.attemptId && (
                      <Link className="btn-ghost" to="/candidate/results/$attemptId" params={{ attemptId: exam.attemptId }}>
                        <Eye size={15} /> View result
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      {start.error && <p className="banner error" role="alert">{start.error.message}</p>}
    </section>
  )
}
