import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Banner, Button, Field, Select, TextInput, Area } from '../components/ui'
import { apiRequest } from '../lib/api-client'
import type { Question } from '../types/domain'

const empty = {
  stem: '',
  type: 'single' as Question['type'],
  category: '',
  difficulty: 'medium' as Question['difficulty'],
  marks: 2,
  choices: ['', ''],
  correctIndexes: [0],
}

export function QuestionBankPage() {
  const queryClient = useQueryClient()
  const questions = useQuery({ queryKey: ['questions'], queryFn: () => apiRequest<Question[]>('/questions') })
  const [form, setForm] = useState(empty)
  const [importText, setImportText] = useState('stem,type,category,difficulty,marks,choices,correct')
  const [notice, setNotice] = useState('')

  const save = useMutation({
    mutationFn: () =>
      apiRequest('/questions', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          choices: form.type === 'written' ? [] : form.choices.filter(Boolean).map((text) => ({ text })),
          correctIndexes: form.type === 'written' ? [] : form.correctIndexes,
        }),
      }),
    onSuccess: async () => {
      setForm(empty)
      setNotice('Question saved to the bank.')
      await queryClient.invalidateQueries({ queryKey: ['questions'] })
    },
    onError: (error: Error) => setNotice(error.message),
  })

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

  const toggleCorrect = (index: number) => {
    if (form.type === 'single') {
      setForm({ ...form, correctIndexes: [index] })
      return
    }
    const has = form.correctIndexes.includes(index)
    setForm({
      ...form,
      correctIndexes: has ? form.correctIndexes.filter((item) => item !== index) : [...form.correctIndexes, index],
    })
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    save.mutate()
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
                <Button type="button" variant="ghost" onClick={() => remove.mutate(question.id)}>
                  Delete
                </Button>
              </div>
              <p className="meta">
                {question.type} · {question.category} · {question.difficulty} · {question.marks} marks
              </p>
            </li>
          ))}
        </ul>
      </section>
      <div className="stack">
        <form className="panel stack" onSubmit={submit}>
          <h2>New question</h2>
          <Field label="Stem">
            <Area value={form.stem} onChange={(event) => setForm({ ...form, stem: event.target.value })} required />
          </Field>
          <Field label="Category">
            <TextInput value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required />
          </Field>
          <div className="row">
            <Field label="Type">
              <Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as Question['type'] })}>
                <option value="single">single answer</option>
                <option value="multi">multiple select</option>
                <option value="written">written</option>
              </Select>
            </Field>
            <Field label="Difficulty">
              <Select value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value as Question['difficulty'] })}>
                <option value="easy">easy</option>
                <option value="medium">medium</option>
                <option value="hard">hard</option>
              </Select>
            </Field>
            <Field label="Marks">
              <TextInput type="number" min={1} value={form.marks} onChange={(event) => setForm({ ...form, marks: Number(event.target.value) })} />
            </Field>
          </div>
          {form.type !== 'written' &&
            form.choices.map((choice, index) => (
              <div className="row" key={index}>
                <Field label={`Choice ${index + 1}`}>
                  <TextInput
                    value={choice}
                    onChange={(event) => {
                      const choices = [...form.choices]
                      choices[index] = event.target.value
                      setForm({ ...form, choices })
                    }}
                  />
                </Field>
                <label>
                  <input
                    type={form.type === 'single' ? 'radio' : 'checkbox'}
                    name="correct"
                    checked={form.correctIndexes.includes(index)}
                    onChange={() => toggleCorrect(index)}
                  />
                  Correct
                </label>
              </div>
            ))}
          {form.type !== 'written' && (
            <Button type="button" variant="ghost" onClick={() => setForm({ ...form, choices: [...form.choices, ''] })}>
              Add choice
            </Button>
          )}
          <Button type="submit">Save question</Button>
        </form>
        <form
          className="panel stack"
          onSubmit={(event) => {
            event.preventDefault()
            upload.mutate()
          }}
        >
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
