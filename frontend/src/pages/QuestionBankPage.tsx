import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
      setNotice('Question saved to the bank.')
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
        <p className="lede">Categories and difficulty feed both the paper and the fairness budget. Editing a question never rewrites an attempt that has already started.</p>
        {notice && <Banner>{notice}</Banner>}
        <ul className="list">
          {questions.data?.map((question) => (
            <li className="card" key={question.id}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong>{question.stem}</strong>
                <div className="row">
                  <Button type="button" variant="ghost" onClick={() => setEditing(question)}>
                    Edit
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => remove.mutate(question.id)}>
                    Delete
                  </Button>
                </div>
              </div>
              <p className="meta">
                {question.type} · {question.category} · {question.difficulty} · {question.marks} marks
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
          <p className="meta">Headers: stem, type, category, difficulty, marks, choices, correct. Separate choices with |. Correct letters look like A|C. Valid rows save; bad rows are reported.</p>
          <Area value={importText} onChange={(event) => setImportText(event.target.value)} />
          <Button type="submit" variant="ghost">
            Import questions
          </Button>
        </form>
      </div>
    </div>
  )
}
