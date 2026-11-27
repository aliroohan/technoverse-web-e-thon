import { useState, type FormEvent } from 'react'
import type { Question } from '../types/domain'
import { Banner, Button, Field, Select, TextInput, Area } from './ui'

export type QuestionDraft = {
  stem: string
  type: Question['type']
  category: string
  difficulty: Question['difficulty']
  marks: number
  choices: string[]
  correctIndexes: number[]
}

export const emptyQuestion = (): QuestionDraft => ({
  stem: '',
  type: 'single',
  category: '',
  difficulty: 'medium',
  marks: 2,
  choices: ['', ''],
  correctIndexes: [0],
})

export const questionToDraft = (question: Question): QuestionDraft => ({
  stem: question.stem,
  type: question.type,
  category: question.category,
  difficulty: question.difficulty,
  marks: question.marks,
  choices: question.type === 'written' ? ['', ''] : question.choices.map((choice) => choice.text),
  correctIndexes:
    question.type === 'written'
      ? []
      : question.choices.flatMap((choice, index) => (question.correctChoiceIds.includes(choice.id) ? [index] : [])),
})

export const questionPayload = (form: QuestionDraft) => {
  if (form.type === 'written') {
    return {
      stem: form.stem,
      type: form.type,
      category: form.category,
      difficulty: form.difficulty,
      marks: form.marks,
      choices: [] as { text: string }[],
      correctIndexes: [] as number[],
    }
  }
  const choices: { text: string }[] = []
  const indexMap: number[] = []
  form.choices.forEach((text, index) => {
    const trimmed = text.trim()
    if (!trimmed) return
    indexMap[index] = choices.length
    choices.push({ text: trimmed })
  })
  return {
    stem: form.stem,
    type: form.type,
    category: form.category,
    difficulty: form.difficulty,
    marks: form.marks,
    choices,
    correctIndexes: form.correctIndexes.flatMap((index) => (indexMap[index] === undefined ? [] : [indexMap[index]])),
  }
}

export function QuestionForm({
  initial,
  heading,
  submitLabel,
  submitBlock = false,
  onSubmit,
  onCancel,
}: {
  initial: QuestionDraft
  heading?: string
  submitLabel: string
  submitBlock?: boolean
  onSubmit: (draft: QuestionDraft) => Promise<void>
  onCancel?: () => void
}) {
  const [form, setForm] = useState(initial)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

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

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      await onSubmit(form)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the question')
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="stack" onSubmit={(event) => void submit(event)}>
      {heading && <h2>{heading}</h2>}
      <Field label="Stem">
        <Area value={form.stem} onChange={(event) => setForm({ ...form, stem: event.target.value })} required />
      </Field>
      <Field label="Category">
        <TextInput value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required />
      </Field>
      <div className="row">
        <Field label="Type">
          <Select
            value={form.type}
            onChange={(event) => {
              const type = event.target.value as Question['type']
              setForm({
                ...form,
                type,
                choices: type !== 'written' && form.choices.length < 2 ? ['', ''] : form.choices,
                correctIndexes: type === 'single' ? [0] : type === 'written' ? [] : form.correctIndexes,
              })
            }}
          >
            <option value="single">single answer</option>
            <option value="multi">multiple select</option>
            <option value="written">written</option>
          </Select>
        </Field>
        <Field label="Difficulty">
          <Select
            value={form.difficulty}
            onChange={(event) => setForm({ ...form, difficulty: event.target.value as Question['difficulty'] })}
          >
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
            <label className="inline-check">
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
      {error && <Banner tone="error">{error}</Banner>}
      <div className="row">
        <Button type="submit" block={submitBlock} disabled={pending}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
