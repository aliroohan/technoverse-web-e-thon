import { useQuery } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { Button } from '../components/ui'
import { apiRequest, downloadPdf } from '../lib/api-client'
import { formatWhen } from '../lib/format'

type Result = {
  attemptId: string
  examTitle: string
  candidateName?: string
  totalScore: number
  totalMarks: number
  objectiveScore: number
  writtenScore: number
  submittedAt: string | null
  verificationCode: string | null
  questions: { questionId: string; stem: string; type: string; marks: number; awarded?: number | null; comment: string }[]
}

export function ResultPage() {
  const { attemptId } = useParams({ strict: false }) as { attemptId: string }
  const result = useQuery({
    queryKey: ['result', attemptId],
    queryFn: () => apiRequest<Result>(`/results/${attemptId}`),
  })

  if (result.isPending) return <p>Loading result…</p>
  if (result.error) return <p className="banner error">{result.error.message}</p>
  const data = result.data
  if (!data) return null

  return (
    <article>
      <p className="meta">Issued result</p>
      <h1 className="page-title">{data.examTitle}</h1>
      <p className="lede">
        {data.candidateName ? `${data.candidateName}. ` : ''}
        Score {data.totalScore} / {data.totalMarks}. Submitted {formatWhen(data.submittedAt)}.
      </p>
      {data.verificationCode && (
        <p className="banner ok">
          Verification code <strong>{data.verificationCode}</strong>. Anyone can confirm this report without seeing your email or your answers.
        </p>
      )}
      <ul className="list">
        {data.questions.map((question, index) => (
          <li className="card" key={question.questionId}>
            <strong>{index + 1}. {question.stem}</strong>
            <p className="meta">
              {question.type === 'written' ? `Awarded ${question.awarded ?? '—'} / ${question.marks}` : `${question.marks} marks available`}
              {question.comment ? ` · ${question.comment}` : ''}
            </p>
          </li>
        ))}
      </ul>
      <Button type="button" onClick={() => void downloadPdf(`/reports/${data.attemptId}/pdf`, `holdfast-${data.attemptId}.pdf`)}>
        Download PDF
      </Button>
    </article>
  )
}
