import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { Button, Dialog, Field, TextInput, Area } from '../components/ui'
import { apiRequest } from '../lib/api-client'
import { toDateTimeLocal } from '../lib/format'
import type { ExamSummary } from '../types/domain'

const freshForm = () => {
  const start = new Date()
  const end = new Date(Date.now() + 4 * 60 * 60 * 1000)
  return {
    title: '',
    instructions: '',
    windowStart: toDateTimeLocal(start),
    windowEnd: toDateTimeLocal(end),
    durationMinutes: 30,
    totalMarks: 20,
  }
}

export function ExamListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const exams = useQuery({ queryKey: ['exams'], queryFn: () => apiRequest<ExamSummary[]>('/exams') })
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(freshForm)

  const create = useMutation({
    mutationFn: () =>
      apiRequest<ExamSummary>('/exams', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          windowStart: new Date(form.windowStart).toISOString(),
          windowEnd: new Date(form.windowEnd).toISOString(),
          settings: { fairPaper: true, randomizeQuestions: true, randomizeChoices: true, questionCount: 6, difficultyBudget: 10, tolerance: 2 },
        }),
      }),
    onSuccess: async (exam) => {
      setOpen(false)
      setForm(freshForm())
      await queryClient.invalidateQueries({ queryKey: ['exams'] })
      await navigate({ to: '/examiner/exams/$examId', params: { examId: exam.id } })
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    create.mutate()
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h1 className="page-title">Examinations</h1>
          <p className="lede">Draft, publish, sit, mark, and release. The lifecycle follows the server clock.</p>
        </div>
        <Button type="button" onClick={() => setOpen(true)}>
          New exam
        </Button>
      </div>
      <ul className="list">
        {exams.data?.map((exam) => (
          <li className="card" key={exam.id}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2>{exam.title}</h2>
              <span className="pill">{exam.lifecycle}</span>
            </div>
            <p className="meta">{exam.durationMinutes} minutes · {exam.totalMarks} marks</p>
            <Link className="btn" to="/examiner/exams/$examId" params={{ examId: exam.id }}>
              Open desk
            </Link>
          </li>
        ))}
        {exams.data?.length === 0 && <li className="meta">No examinations yet.</li>}
      </ul>
      {open && (
        <Dialog title="New examination" onClose={() => setOpen(false)}>
          <form className="stack" onSubmit={submit}>
            <Field label="Title">
              <TextInput value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
            </Field>
            <Field label="Instructions">
              <Area value={form.instructions} onChange={(event) => setForm({ ...form, instructions: event.target.value })} required />
            </Field>
            <Field label="Opens">
              <TextInput type="datetime-local" value={form.windowStart} onChange={(event) => setForm({ ...form, windowStart: event.target.value })} required />
            </Field>
            <Field label="Closes">
              <TextInput type="datetime-local" value={form.windowEnd} onChange={(event) => setForm({ ...form, windowEnd: event.target.value })} required />
            </Field>
            <Field label="Duration in minutes">
              <TextInput type="number" min={1} value={form.durationMinutes} onChange={(event) => setForm({ ...form, durationMinutes: Number(event.target.value) })} />
            </Field>
            <Field label="Total marks">
              <TextInput type="number" min={1} value={form.totalMarks} onChange={(event) => setForm({ ...form, totalMarks: Number(event.target.value) })} />
            </Field>
            <Button type="submit" block disabled={create.isPending}>
              Create draft
            </Button>
            {create.error && <p className="banner error">{create.error.message}</p>}
          </form>
        </Dialog>
      )}
    </section>
  )
}
