import { useQuery } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { Award, Clock, ShieldAlert, ShieldCheck } from 'lucide-react'
import { formatWhen } from '../lib/format'
import { apiRequest } from '../lib/api-client'

type Verification = {
  examTitle: string
  candidateName: string
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
    <main className="main stack">
      <div>
        <p className="meta" style={{ margin: 0 }}>Public verification</p>
        <h1 className="page-title">Holdfast</h1>
      </div>
      {result.isPending && <p className="meta">Checking…</p>}
      {result.error && <p className="banner error">No issued report matches that code.</p>}
      {result.data && (
        <article className="card stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0 }}>{result.data.candidateName}</h2>
            <span className={result.data.status === 'valid' ? 'pill ok meta-chip' : 'pill danger meta-chip'}>
              {result.data.status === 'valid' ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
              {result.data.status}
            </span>
          </div>
          <p style={{ margin: 0 }}>{result.data.examTitle}</p>
          <div className="meta-row">
            <span className="meta-chip"><Award size={14} /> {result.data.totalScore} / {result.data.totalMarks}</span>
            <span className="meta-chip"><Clock size={14} /> {formatWhen(result.data.issuedAt)}</span>
          </div>
          <p className="meta" style={{ margin: 0 }}>This page does not show an email, a script, or anyone else’s result.</p>
        </article>
      )}
    </main>
  )
}
