import { Check, Upload, UserPlus, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { apiRequest } from '../lib/api-client'
import { candidateCsv, parseCandidateCsv, type CandidateRow } from '../lib/candidate-csv'
import { Banner, Button, Field, TextInput } from './ui'

export type DirectoryPerson = {
  id: string
  name: string
  email: string
}

export type CandidateCreated = DirectoryPerson & { passwordNote: string }

export type CandidateImportResult = {
  created: number
  enrolled: number
  errors: { row: number; message: string }[]
  passwordNote: string
}

export function CandidateForm({ onCreated }: { onCreated: (person: CandidateCreated) => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      const person = await apiRequest<CandidateCreated>('/candidates', {
        method: 'POST',
        body: JSON.stringify({ name, email }),
      })
      onCreated(person)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the candidate')
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="stack compact-form" onSubmit={(event) => void submit(event)}>
      <div className="compact-grid">
        <Field label="Name">
          <TextInput value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>
        <Field label="Email">
          <TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </Field>
      </div>
      {error && <Banner tone="error">{error}</Banner>}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <Button type="submit" className="btn-sm" disabled={pending}>
          <UserPlus size={14} /> Add
        </Button>
      </div>
    </form>
  )
}

export function CandidateImport({
  onAdded,
  onCancel,
}: {
  onAdded: (result: CandidateImportResult) => void
  onCancel?: () => void
}) {
  const [rows, setRows] = useState<CandidateRow[] | null>(null)
  const [skipped, setSkipped] = useState(0)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const loadFile = async (file: File) => {
    const parsed = parseCandidateCsv(await file.text())
    setRows(parsed.rows.length ? parsed.rows : null)
    setSkipped(parsed.skipped)
    setError(parsed.error)
  }

  const add = async () => {
    if (!rows?.length) return
    setPending(true)
    setError('')
    try {
      const result = await apiRequest<CandidateImportResult>('/candidates/import', {
        method: 'POST',
        body: JSON.stringify({ format: 'csv', content: candidateCsv(rows) }),
      })
      onAdded(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the candidates')
      setPending(false)
    }
  }

  return (
    <div className="stack">
      <p className="meta" style={{ margin: 0 }}>CSV columns: name, email</p>
      <Field label="CSV file">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void loadFile(file)
          }}
        />
      </Field>
      {skipped > 0 && <p className="meta">{skipped} skipped</p>}
      {rows && (
        <>
          <p className="meta">{rows.length} ready</p>
          <ul className="list">
            {rows.map((row, index) => (
              <li className="card" key={`${row.email}-${index}`}>
                <strong>{row.name}</strong>
                <div className="meta">{row.email}</div>
              </li>
            ))}
          </ul>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            {onCancel && (
              <Button type="button" variant="ghost" className="btn-icon" aria-label="Cancel" title="Cancel" onClick={onCancel}>
                <X size={15} />
              </Button>
            )}
            <Button type="button" className="btn-sm" disabled={pending} onClick={() => void add()}>
              <Upload size={14} /> <Check size={14} /> Add ({rows.length})
            </Button>
          </div>
        </>
      )}
      {error && <Banner tone="error">{error}</Banner>}
    </div>
  )
}
