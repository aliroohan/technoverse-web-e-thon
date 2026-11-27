import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Award, Check, Layers, Pencil, Plus, Search, Tag, Trash2, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { QuestionForm, emptyQuestion, questionPayload, questionToDraft } from '../components/QuestionForm'
import { Banner, Button, Field, Select, TextInput } from '../components/ui'
import { apiRequest, notifyError, notifySuccess } from '../lib/api-client'
import type { Question } from '../types/domain'

const difficultyTone = (difficulty: Question['difficulty']) =>
  difficulty === 'easy' ? 'pill ok' : difficulty === 'hard' ? 'pill danger' : 'pill warn'

export function QuestionBankPage() {
  const queryClient = useQueryClient()
  const questions = useQuery({ queryKey: ['questions'], queryFn: () => apiRequest<Question[]>('/questions') })
  const [formMode, setFormMode] = useState<'closed' | 'create' | 'edit' | 'import'>('closed')
  const [editing, setEditing] = useState<Question | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'' | Question['type']>('')
  const [difficultyFilter, setDifficultyFilter] = useState<'' | Question['difficulty']>('')
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [importFormat, setImportFormat] = useState<'csv' | 'json'>('csv')
  const [importContent, setImportContent] = useState('')
  const [importing, setImporting] = useState(false)
  const [importErrors, setImportErrors] = useState<{ row: number; message: string }[]>([])

  const remove = useMutation({
    mutationFn: (id: string) => apiRequest(`/questions/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      notifySuccess('Question deleted.')
      await queryClient.invalidateQueries({ queryKey: ['questions'] })
    },
    onError: (error: Error) => notifyError(error.message),
  })

  const save = async (draft: Parameters<typeof questionPayload>[0]) => {
    const payload = questionPayload(draft)
    if (formMode === 'edit' && editing) {
      await apiRequest(`/questions/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
      notifySuccess('Question updated.')
      setEditing(null)
      setFormMode('closed')
    } else {
      await apiRequest('/questions', { method: 'POST', body: JSON.stringify(payload) })
      notifySuccess('Question added to bank.')
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
        {!formOpen && (
          <div className="row">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditing(null)
                setImportErrors([])
                setFormMode('import')
                setNotice(null)
              }}
            >
              <Upload size={16} /> Import CSV / JSON
            </Button>
            <Button
              type="button"
              onClick={() => {
                setEditing(null)
                setFormMode('create')
                setNotice(null)
              }}
            >
              <Plus size={16} /> New question
            </Button>
          </div>
        )}
      </div>

      {notice && <Banner tone={notice.tone}>{notice.text}</Banner>}

      {formMode === 'import' && (
        <div className="panel stack">
          <h2 style={{ margin: 0 }}>Bulk import questions</h2>
          <p className="meta" style={{ margin: 0 }}>
            CSV columns: <code>stem, type, category, difficulty, marks, choices, correctIndexes</code> (choices separated by <code>|</code>). Or upload a JSON array.
          </p>
          <div className="row">
            <Field label="File (.csv or .json)">
              <input
                type="file"
                accept=".csv,text/csv,.json,application/json"
                onChange={async (event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  setImportFormat(file.name.toLowerCase().endsWith('.json') ? 'json' : 'csv')
                  setImportContent(await file.text())
                  setImportErrors([])
                }}
              />
            </Field>
            <Field label="Format">
              <Select value={importFormat} onChange={(event) => setImportFormat(event.target.value as 'csv' | 'json')}>
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
              </Select>
            </Field>
          </div>
          <Field label="Or paste CSV / JSON">
            <textarea
              rows={5}
              value={importContent}
              onChange={(event) => setImportContent(event.target.value)}
              placeholder="stem,type,category,difficulty,marks,choices,correctIndexes"
            />
          </Field>
          {importErrors.length > 0 && (
            <Banner tone="error">
              Skipped {importErrors.length} row(s): {importErrors.slice(0, 3).map((e) => `Row ${e.row}: ${e.message}`).join(' · ')}
            </Banner>
          )}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button type="button" variant="ghost" onClick={() => setFormMode('closed')}>Cancel</Button>
            <Button
              type="button"
              disabled={importing || !importContent.trim()}
              onClick={async () => {
                setImporting(true)
                setImportErrors([])
                try {
                  const res = await apiRequest<{ created: number; errors: { row: number; message: string }[] }>('/questions/import', {
                    method: 'POST',
                    body: JSON.stringify({ format: importFormat, content: importContent }),
                  })
                  setImportErrors(res.errors)
                  setNotice({
                    tone: res.created > 0 ? 'ok' : 'error',
                    text: `Imported ${res.created} question(s)${res.errors.length ? `, ${res.errors.length} row(s) had errors` : '.'}`,
                  })
                  await queryClient.invalidateQueries({ queryKey: ['questions'] })
                  if (res.errors.length === 0) {
                    setImportContent('')
                    setFormMode('closed')
                  }
                } catch (err) {
                  setNotice({ tone: 'error', text: err instanceof Error ? err.message : 'Import failed' })
                } finally {
                  setImporting(false)
                }
              }}
            >
              <Upload size={15} /> {importing ? 'Importing…' : 'Import questions'}
            </Button>
          </div>
        </div>
      )}

      {(formMode === 'create' || formMode === 'edit') && (
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
                    disabled={remove.isPending && remove.variables === question.id}
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
