import { useQuery } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { Award, Clock, FileDown, MessageSquare } from 'lucide-react'
import { VerifyShare } from '../components/VerifyShare'
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
  teacherComment?: string
  verificationCode: string | null
  questions: { questionId: string; stem: string; type: string; marks: number; awarded?: number | null; comment: string }[]
}

export function ResultPage() {
  const { attemptId } = useParams({ strict: false }) as { attemptId: string }
  const result = useQuery({
    queryKey: ['result', attemptId],
    queryFn: () => apiRequest<Result>(`/results/${attemptId}`),
  })

  if (result.isPending) return <p className="meta">Loading…</p>
  if (result.error) return <p className="banner error">{result.error.message}</p>
  const data = result.data
  if (!data) return null

  return (
    <article className="stack">
      <div>
        <h1 className="page-title">{data.examTitle}</h1>
        <div className="meta-row">
          {data.candidateName && <strong>{data.candidateName}</strong>}
          <span className="meta-chip"><Award size={14} /> {data.totalScore} / {data.totalMarks}</span>
          <span className="meta-chip"><Clock size={14} /> {formatWhen(data.submittedAt)}</span>
        </div>
      </div>
      {data.verificationCode && <VerifyShare code={data.verificationCode} />}
      {data.teacherComment && (
        <p className="banner meta-chip">
          <MessageSquare size={16} />
          <span>{data.teacherComment}</span>
        </p>
      )}
      <ul className="list">
        {data.questions.map((question, index) => (
          <li className="card" key={question.questionId}>
            <strong>{index + 1}. {question.stem}</strong>
            <p className="meta" style={{ marginBottom: 0 }}>
              {question.type === 'written' ? `${question.awarded ?? '—'} / ${question.marks} pts` : `${question.marks} pts`}
              {question.comment ? ` · ${question.comment}` : ''}
            </p>
          </li>
        ))}
      </ul>
      <Button type="button" onClick={() => void downloadPdf(`/reports/${data.attemptId}/pdf`, `holdfast-${data.attemptId}.pdf`)}>
        <FileDown size={15} /> Download PDF
      </Button>
    </article>
  )
}
