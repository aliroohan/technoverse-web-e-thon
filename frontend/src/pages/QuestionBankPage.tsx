import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Award, Check, Layers, Pencil, Plus, Search, Tag, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { QuestionForm, emptyQuestion, questionPayload, questionToDraft } from '../components/QuestionForm'
import { Banner, Button, Select, TextInput } from '../components/ui'
import { apiRequest } from '../lib/api-client'
import type { Question } from '../types/domain'

const difficultyTone = (difficulty: Question['difficulty']) =>
  difficulty === 'easy' ? 'pill ok' : difficulty === 'hard' ? 'pill danger' : 'pill warn'

export function QuestionBankPage() {
  const queryClient = useQueryClient()
  const questions = useQuery({ queryKey: ['questions'], queryFn: () => apiRequest<Question[]>('/questions') })
  const [formMode, setFormMode] = useState<'closed' | 'create' | 'edit'>('closed')
  const [editing, setEditing] = useState<Question | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'' | Question['type']>('')
  const [difficultyFilter, setDifficultyFilter] = useState<'' | Question['difficulty']>('')
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  const remove = useMutation({
    mutationFn: (id: string) => apiRequest(`/questions/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      setNotice({ tone: 'ok', text: 'Question deleted.' })
      await queryClient.invalidateQueries({ queryKey: ['questions'] })
    },
    onError: (error: Error) => setNotice({ tone: 'error', text: error.message }),
  })

  const save = async (draft: Parameters<typeof questionPayload>[0]) => {
    const payload = questionPayload(draft)
    if (formMode === 'edit' && editing) {
      await apiRequest(`/questions/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
      setNotice({ tone: 'ok', text: 'Question updated.' })
      setEditing(null)
      setFormMode('closed')
    } else {
      await apiRequest('/questions', { method: 'POST', body: JSON.stringify(payload) })
      setNotice({ tone: 'ok', text: 'Question added to bank.' })
      setFormMode('closed')
    }
    await queryClient.invalidateQueries({ queryKey: ['questions'] })
  }

  const filtered = useMemo(() => {
    const list = questions.data ?? []
    const term = search.trim().toLowerCase()
    return list.filter((q) => {
      if (typeFilter && q.type !== typeFilter) return false
      if (difficultyFilter && q.difficulty !== difficultyFilter) return false
      if (term && !q.stem.toLowerCase().includes(term) && !q.category.toLowerCase().includes(term)) {
        return false
      }
      return true
    })
  }, [questions.data, search, typeFilter, difficultyFilter])

  const categoryCount = useMemo(
    () => new Set((questions.data ?? []).map((q) => q.category.toLowerCase())).size,
    [questions.data],
  )

  const formOpen = formMode !== 'closed'

  return (
    <section className="stack">
      <div className="admin-header">
        <div>
          <h1 className="page-title">Question bank</h1>
          <div className="meta-row">
            <span className="meta-chip">
              <Layers size={14} /> {questions.data?.length ?? 0} questions
            </span>
            <span className="meta-chip">
              <Tag size={14} /> {categoryCount} categories
            </span>
          </div>
        </div>
        <Button
          type="button"
          variant={formOpen ? 'ghost' : 'solid'}
          onClick={() => {
            if (formOpen) {
              setFormMode('closed')
              setEditing(null)
            } else {
              setEditing(null)
              setFormMode('create')
              setNotice(null)
            }
          }}
        >
          {formOpen ? <X size={16} /> : <Plus size={16} />}
          {formOpen ? 'Close' : 'New question'}
        </Button>
      </div>

      {notice && <Banner tone={notice.tone}>{notice.text}</Banner>}

      {formOpen && (
        <div className="panel">
          <QuestionForm
            key={editing?.id ?? 'new'}
            heading={formMode === 'edit' ? 'Edit question' : 'New question'}
            submitLabel={formMode === 'edit' ? 'Save changes' : 'Create question'}
            initial={formMode === 'edit' && editing ? questionToDraft(editing) : emptyQuestion()}
            onCancel={() => {
              setFormMode('closed')
              setEditing(null)
            }}
            onSubmit={save}
          />
        </div>
      )}

      <div className="row">
        <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
          <Search
            size={15}
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '0.72rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--ink-soft)',
              pointerEvents: 'none',
            }}
          />
          <TextInput
            className="compact-input"
            style={{ paddingLeft: '2.1rem' }}
            aria-label="Search questions"
            placeholder="Search stem or category…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select
          aria-label="Filter by type"
          className="inline-select"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as '' | Question['type'])}
        >
          <option value="">All types</option>
          <option value="single">single</option>
          <option value="multi">multi</option>
          <option value="written">written</option>
        </Select>
        <Select
          aria-label="Filter by difficulty"
          className="inline-select"
          value={difficultyFilter}
          onChange={(event) => setDifficultyFilter(event.target.value as '' | Question['difficulty'])}
        >
          <option value="">All levels</option>
          <option value="easy">easy</option>
          <option value="medium">medium</option>
          <option value="hard">hard</option>
        </Select>
      </div>

      {questions.isPending && <p className="meta">Loading…</p>}
      {questions.error && <Banner tone="error">{questions.error.message}</Banner>}

      {questions.data && filtered.length === 0 ? (
        <Banner>No questions match the current filter.</Banner>
      ) : (
        <ul className="list">
          {filtered.map((question) => (
            <li className="card" key={question.id}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: '1.03rem' }}>{question.stem}</strong>
                  <div className="meta-row" style={{ marginTop: '0.45rem' }}>
                    <span className="pill">{question.type}</span>
                    <span className="pill">{question.category}</span>
                    <span className={difficultyTone(question.difficulty)}>{question.difficulty}</span>
                    <span className="meta-chip">
                      <Award size={14} /> {question.marks} pts
                    </span>
                  </div>
                </div>
                <div className="row" style={{ flexWrap: 'nowrap', flexShrink: 0 }}>
                  <Button
                    type="button"
                    variant="ghost"
                    className="btn-icon"
                    aria-label={`Edit ${question.stem}`}
                    title="Edit"
                    onClick={() => {
                      setEditing(question)
                      setFormMode('edit')
                      setNotice(null)
                    }}
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

              {question.choices.length > 0 && (
                <div className="qbank-choices">
                  {question.choices.map((choice) => {
                    const correct = question.correctChoiceIds.includes(choice.id)
                    return (
                      <span key={choice.id} className={correct ? 'qbank-choice correct' : 'qbank-choice'}>
                        {correct && <Check size={13} />}
                        {choice.text}
                      </span>
                    )
                  })}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
