import { useQuery } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { apiRequest } from '../lib/api-client'
import { formatWhen } from '../lib/format'

type Verification = {
  examTitle: string
  totalScore: number
  totalMarks: number
  issuedAt: string
  status: 'valid' | 'revoked'
}

export function VerifyPage() {
  const { code } = useParams({ strict: false }) as { code: string }
  const result = useQuery({
    queryKey: ['verify', code],
    queryFn: () => apiRequest<Verification>(`/verify/${code}`),
  })

  return (
    <main className="main">
      <p className="meta">Public verification</p>
      <h1 className="page-title">Holdfast</h1>
      {result.isPending && <p>Checking the code…</p>}
      {result.error && <p className="banner error">No issued report matches that code.</p>}
      {result.data && (
        <article className="card">
          <h2>{result.data.examTitle}</h2>
          <p>Score {result.data.totalScore} / {result.data.totalMarks}</p>
          <p className="meta">Issued {formatWhen(result.data.issuedAt)} · {result.data.status}</p>
          <p className="meta">This page does not show a name, an email, a script, or anyone else’s result.</p>
        </article>
      )}
    </main>
  )
}
