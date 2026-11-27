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
    <form className="stack" onSubmit={(event) => void submit(event)}>
      <Field label="Name">
        <TextInput value={name} onChange={(event) => setName(event.target.value)} required />
      </Field>
      <Field label="Email">
        <TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </Field>
      <p className="meta">This creates an account. It does not place the person on an examination.</p>
      {error && <Banner tone="error">{error}</Banner>}
      <Button type="submit" disabled={pending}>
        Add candidate
      </Button>
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
      <p className="meta">Load a CSV with name and email columns. The rows stay here until you add them, and adding them does not enroll anyone.</p>
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
      {skipped > 0 && <p className="meta">{skipped} {skipped === 1 ? 'row was' : 'rows were'} skipped because a name or email was missing.</p>}
      {rows && (
        <>
          <p className="meta">{rows.length} {rows.length === 1 ? 'candidate' : 'candidates'} ready to add.</p>
          <ul className="list">
            {rows.map((row, index) => (
              <li className="card" key={`${row.email}-${index}`}>
                <strong>{row.name}</strong>
                <div className="meta">{row.email}</div>
              </li>
            ))}
          </ul>
          <div className="row">
            <Button type="button" disabled={pending} onClick={() => void add()}>
              Add
            </Button>
            {onCancel && (
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </>
      )}
      {error && <Banner tone="error">{error}</Banner>}
    </div>
  )
}
