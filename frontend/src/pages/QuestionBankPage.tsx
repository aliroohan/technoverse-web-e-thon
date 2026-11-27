import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2, Upload } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { QuestionForm, emptyQuestion, questionPayload, questionToDraft } from '../components/QuestionForm'
import { Banner, Button, Area } from '../components/ui'
import { apiRequest } from '../lib/api-client'
import type { Question } from '../types/domain'

export function QuestionBankPage() {
  const queryClient = useQueryClient()
  const questions = useQuery({ queryKey: ['questions'], queryFn: () => apiRequest<Question[]>('/questions') })
  const [editing, setEditing] = useState<Question | null>(null)
  const [importText, setImportText] = useState('stem,type,category,difficulty,marks,choices,correct')
  const [notice, setNotice] = useState('')

  const remove = useMutation({
    mutationFn: (id: string) => apiRequest(`/questions/${id}`, { method: 'DELETE' }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['questions'] }),
    onError: (error: Error) => setNotice(error.message),
  })

  const upload = useMutation({
    mutationFn: () =>
      apiRequest<{ created: number; errors: { row: number; message: string }[] }>('/questions/import', {
        method: 'POST',
        body: JSON.stringify({ format: 'csv', content: importText }),
      }),
    onSuccess: async (result) => {
      setNotice(`Imported ${result.created}. ${result.errors.map((error) => `Row ${error.row}: ${error.message}`).join(' ')}`)
      await queryClient.invalidateQueries({ queryKey: ['questions'] })
    },
    onError: (error: Error) => setNotice(error.message),
  })

  const save = async (draft: Parameters<typeof questionPayload>[0]) => {
    const payload = questionPayload(draft)
    if (editing) {
      await apiRequest(`/questions/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
      setNotice('Question updated.')
      setEditing(null)
    } else {
      await apiRequest('/questions', { method: 'POST', body: JSON.stringify(payload) })
      setNotice('Question saved.')
    }
    await queryClient.invalidateQueries({ queryKey: ['questions'] })
  }

  const importSubmit = (event: FormEvent) => {
    event.preventDefault()
    upload.mutate()
  }

  return (
    <div className="grid two">
      <section>
        <h1 className="page-title">Question bank</h1>
        {notice && <Banner>{notice}</Banner>}
        <ul className="list">
          {questions.data?.map((question) => (
            <li className="card" key={question.id}>
              <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                <strong>{question.stem}</strong>
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <Button
                    type="button"
                    variant="ghost"
                    className="btn-icon"
                    aria-label={`Edit ${question.stem}`}
                    title="Edit"
                    onClick={() => setEditing(question)}
                  >
                    <Pencil size={15} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="btn-icon"
                    aria-label={`Delete ${question.stem}`}
                    title="Delete"
                    onClick={() => remove.mutate(question.id)}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              </div>
              <p className="meta">
                {question.type} · {question.category} · {question.difficulty} · {question.marks} pts
              </p>
            </li>
          ))}
        </ul>
      </section>
      <div className="stack">
        <div className="panel">
          <QuestionForm
            key={editing?.id ?? 'new'}
            heading={editing ? 'Edit question' : 'New question'}
            submitLabel={editing ? 'Save changes' : 'Save question'}
            initial={editing ? questionToDraft(editing) : emptyQuestion()}
            onCancel={editing ? () => setEditing(null) : undefined}
            onSubmit={save}
          />
        </div>
        <form className="panel stack" onSubmit={importSubmit}>
          <h2>Import CSV</h2>
          <p className="meta">Columns: stem, type, category, difficulty, marks, choices (|), correct (A|C)</p>
          <Area value={importText} onChange={(event) => setImportText(event.target.value)} />
          <Button type="submit" variant="ghost">
            <Upload size={15} /> Import
          </Button>
        </form>
      </div>
    </div>
  )
}
