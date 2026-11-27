import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { CandidateForm, CandidateImport, type DirectoryPerson } from '../components/CandidateTools'
import { Banner, Button } from '../components/ui'
import { apiRequest } from '../lib/api-client'

export function CandidatesPage() {
  const queryClient = useQueryClient()
  const people = useQuery({
    queryKey: ['candidates'],
    queryFn: () => apiRequest<DirectoryPerson[]>('/users?role=candidate'),
  })
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [notice, setNotice] = useState('')

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['candidates'] })
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h1 className="page-title">Candidates</h1>
          <p className="lede">Add people here. They join an examination only when you select them on that paper.</p>
        </div>
        <div className="row">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setImporting((open) => !open)
              setCreating(false)
            }}
          >
            Import
          </Button>
          <Button
            type="button"
            onClick={() => {
              setCreating((open) => !open)
              setImporting(false)
            }}
          >
            New candidate
          </Button>
        </div>
      </div>
      {notice && <Banner>{notice}</Banner>}
      {creating && (
        <div className="panel" style={{ marginBottom: '1rem' }}>
          <h2>New candidate</h2>
          <CandidateForm
            onCreated={async (person) => {
              setNotice(`${person.name} was added. ${person.passwordNote}`)
              setCreating(false)
              await refresh()
            }}
          />
        </div>
      )}
      {importing && (
        <div className="panel" style={{ marginBottom: '1rem' }}>
          <h2>Import</h2>
          <CandidateImport
            onCancel={() => setImporting(false)}
            onAdded={async (result) => {
              const problems = result.errors.map((error) => `Row ${error.row}: ${error.message}`).join(' ')
              setNotice(`${result.passwordNote} Added ${result.created}. ${problems}`.trim())
              setImporting(false)
              await refresh()
            }}
          />
        </div>
      )}
      {people.error && <Banner tone="error">{people.error.message}</Banner>}
      <ul className="list">
        {people.data?.map((person) => (
          <li className="card" key={person.id}>
            <strong>{person.name}</strong>
            <div className="meta">{person.email}</div>
          </li>
        ))}
        {people.data?.length === 0 && <li className="meta">No candidates yet.</li>}
      </ul>
    </section>
  )
}
