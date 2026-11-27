import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { ArrowLeft, Award, Clock, FileDown, MessageSquare } from 'lucide-react'
import { useState } from 'react'
import { VerifyShare } from '../components/VerifyShare'
import { Banner, Button, Loader } from '../components/ui'
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
  const [pdfError, setPdfError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const result = useQuery({
    queryKey: ['result', attemptId],
    queryFn: () => apiRequest<Result>(`/results/${attemptId}`),
  })

  if (result.isPending) return <Loader label="Loading result" />
  if (result.error) {
    return (
      <section className="stack">
        <div>
          <Link to="/candidate" className="btn-ghost btn-icon" aria-label="Back to examinations" title="Back">
            <ArrowLeft size={16} />
          </Link>
        </div>
        <p className="banner error" role="alert">{result.error.message}</p>
      </section>
    )
  }
  const data = result.data
  if (!data) return null

  const onDownload = async () => {
    setPdfError('')
    setDownloading(true)
    try {
      await downloadPdf(`/reports/${data.attemptId}/pdf`, `holdfast-${data.attemptId}.pdf`)
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'Could not download PDF report')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <article className="stack">
      <div>
        <Link to="/candidate" className="btn-ghost btn-icon" aria-label="Back to examinations" title="Back">
          <ArrowLeft size={16} />
        </Link>
      </div>
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
      {pdfError && <Banner tone="error">{pdfError}</Banner>}
      <Button type="button" loading={downloading} onClick={() => void onDownload()}>
        <FileDown size={15} /> Download PDF
      </Button>
    </article>
  )
}
