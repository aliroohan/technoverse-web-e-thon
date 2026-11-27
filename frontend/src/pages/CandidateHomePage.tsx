import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
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
    <section>
      <h1 className="page-title">Your examinations</h1>
      <p className="lede">Available means the window is open. Upcoming means the server clock has not reached the start. A closed window cannot be entered.</p>
      {groups.map((group) => {
        const rows = exams.data?.filter((exam) => exam.access === group) ?? []
        if (rows.length === 0) return null
        return (
          <section key={group}>
            <h2 style={{ fontFamily: 'var(--serif)', fontWeight: 520 }}>{group}</h2>
            <ul className="list">
              {rows.map((exam) => (
                <li className="card" key={exam.id}>
                  <h3 style={{ margin: '0 0 0.3rem' }}>{exam.title}</h3>
                  <p>{exam.instructions}</p>
                  <p className="meta">
                    {formatWhen(exam.windowStart)} – {formatWhen(exam.windowEnd)} · {exam.durationMinutes} min · {exam.reason}
                  </p>
                  <div className="row">
                    {exam.canEnter && (
                      <Button type="button" onClick={() => start.mutate(exam.id)}>
                        {exam.attemptStatus === 'in_progress' ? 'Resume' : 'Enter'}
                      </Button>
                    )}
                    {exam.access === 'completed' && exam.resultsPublished && exam.attemptId && (
                      <Link className="btn-ghost" to="/candidate/results/$attemptId" params={{ attemptId: exam.attemptId }}>
                        View result
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
