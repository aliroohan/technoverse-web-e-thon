import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useParams } from '@tanstack/react-router'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  FileEdit,
  Flag,
  LogOut,
  Megaphone,
  Send,
  SlidersHorizontal,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { Banner, Button, Dialog, Select } from '../components/ui'
import { ApiError, apiRequest, socketOrigin } from '../lib/api-client'
import { formatRemaining } from '../lib/format'
import { enqueueOutbox, readOutbox, writeOutbox, type OutboxItem } from '../lib/outbox'
import type { AttemptView, Preferences } from '../types/domain'

type SaveState = 'idle' | 'saving' | 'saved' | 'failed' | 'rejected'

export function ExamRunnerPage() {
  const { attemptId } = useParams({ strict: false }) as { attemptId: string }
  const queryClient = useQueryClient()
  const attempt = useQuery({
    queryKey: ['attempt', attemptId],
    queryFn: () => apiRequest<AttemptView>(`/attempts/${attemptId}`),
  })
  const preferences = useQuery({
    queryKey: ['preferences'],
    queryFn: () => apiRequest<Preferences>('/preferences'),
  })

  if (attempt.isPending || preferences.isPending) return <p className="main">Opening the paper…</p>
  if (attempt.error || !attempt.data || !preferences.data) {
    return <p className="banner error main">{attempt.error?.message ?? 'Could not open this attempt'}</p>
  }

  return (
    <Runner
      initial={attempt.data}
      preferences={preferences.data}
      onAttempt={(next) => queryClient.setQueryData(['attempt', attemptId], next)}
    />
  )
}

function Runner({
  initial,
  preferences,
  onAttempt,
}: {
  initial: AttemptView
  preferences: Preferences
  onAttempt: (next: AttemptView) => void
}) {
  const queryClient = useQueryClient()
  const [attempt, setAttempt] = useState(initial)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState(() => {
    const base = Object.fromEntries(initial.questions.map((question) => [question.questionId, question.answer]))
    for (const queued of readOutbox(initial.id)) {
      const current = base[queued.questionId] ?? { choiceIds: [], text: '', savedAt: null, version: 0 }
      base[queued.questionId] = {
        ...current,
        choiceIds: queued.choiceIds ?? current.choiceIds,
        text: queued.text ?? current.text,
      }
    }
    return base
  })
  const [flags, setFlags] = useState(() => {
    const base = Object.fromEntries(initial.questions.map((question) => [question.questionId, question.flaggedForReview]))
    for (const queued of readOutbox(initial.id)) {
      if (queued.flaggedForReview !== undefined) {
        base[queued.questionId] = queued.flaggedForReview
      }
    }
    return base
  })
  const [saveState, setSaveState] = useState<SaveState>(() => (readOutbox(initial.id).length > 0 ? 'failed' : 'idle'))
  const [online, setOnline] = useState(navigator.onLine)
  const [offset, setOffset] = useState(() => new Date(initial.serverNow).getTime() - Date.now())
  const [now, setNow] = useState(() => Date.now())
  const [scratchpad, setScratchpad] = useState(initial.scratchpad)
  const [scratchError, setScratchError] = useState('')
  const [scratchOpen, setScratchOpen] = useState(false)
  const [prefsOpen, setPrefsOpen] = useState(false)
  const [prefs, setPrefs] = useState(preferences)
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [lateNote, setLateNote] = useState('')
  const [annExpanded, setAnnExpanded] = useState(false)
  const [minimizedAnnCount, setMinimizedAnnCount] = useState<number | null>(null)
  const timers = useRef<Record<string, number>>({})

  const question = attempt.questions[index]
  const remaining = new Date(attempt.deadlineAt).getTime() - (now + offset)
  const urgent = remaining < 5 * 60 * 1000 && attempt.status === 'in_progress'

  const flush = useCallback(async () => {
    const queued = readOutbox(attempt.id)
    if (queued.length === 0) return
    const kept: OutboxItem[] = []
    for (const item of queued) {
      try {
        const saved = await apiRequest<{ questionId: string; version: number; savedAt: string }>(`/attempts/${attempt.id}/answers`, {
          method: 'PUT',
          body: JSON.stringify(item),
          silent: true,
        })
        setAnswers((prev) => {
          const cur = prev[saved.questionId]
          if (!cur) return prev
          return { ...prev, [saved.questionId]: { ...cur, version: saved.version, savedAt: saved.savedAt } }
        })
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          setLateNote(error.message)
        } else {
          kept.push(item)
        }
      }
    }
    writeOutbox(attempt.id, kept)
    setSaveState(kept.length === 0 ? 'saved' : 'failed')
  }, [attempt.id])

  useEffect(() => {
    const initialFlush =
      navigator.onLine && initial.status === 'in_progress' && readOutbox(attempt.id).length > 0
        ? window.setTimeout(() => void flush(), 0)
        : undefined
    const clock = window.setInterval(() => setNow(Date.now()), 1000)
    const onOnline = () => {
      setOnline(true)
      void flush()
    }
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      if (initialFlush !== undefined) window.clearTimeout(initialFlush)
      window.clearInterval(clock)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [attempt.id, flush, initial.status])

  useEffect(() => {
    const beat = window.setInterval(() => {
      void apiRequest<{ serverNow: string; deadlineAt: string; status: AttemptView['status'] }>(`/attempts/${attempt.id}/heartbeat`, {
        method: 'POST',
        silent: true,
      })
        .then((pulse) => {
          setOffset(new Date(pulse.serverNow).getTime() - Date.now())
          setAttempt((current) => ({ ...current, deadlineAt: pulse.deadlineAt, status: pulse.status }))
          if (pulse.status !== 'in_progress') {
            void apiRequest<AttemptView>(`/attempts/${attempt.id}`, { silent: true })
              .then((fresh) => {
                setAttempt(fresh)
                onAttempt(fresh)
              })
              .catch(() => undefined)
          }
        })
        .catch(() => undefined)
    }, 15000)
    return () => window.clearInterval(beat)
  }, [attempt.id, onAttempt])

  useEffect(() => {
    const socket = io(socketOrigin, { path: '/socket.io', withCredentials: true })
    socket.emit('exam:join', attempt.examId)
    socket.emit('attempt:join', attempt.id)
    socket.on('announcement', (announcement: AttemptView['announcements'][number]) => {
      setAttempt((current) => ({ ...current, announcements: [...current.announcements, announcement] }))
    })
    return () => {
      socket.disconnect()
    }
  }, [attempt.examId, attempt.id])

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && attempt.status === 'in_progress') {
        void apiRequest(`/attempts/${attempt.id}/incidents`, { method: 'POST', body: JSON.stringify({ type: 'blur' }), silent: true })
      }
      if (document.visibilityState === 'visible' && attempt.status === 'in_progress') {
        void apiRequest(`/attempts/${attempt.id}/incidents`, { method: 'POST', body: JSON.stringify({ type: 'focus' }), silent: true })
      }
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [attempt.id, attempt.status])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return
      if (event.key === 'ArrowRight') setIndex((value) => Math.min(attempt.questions.length - 1, value + 1))
      if (event.key === 'ArrowLeft') setIndex((value) => Math.max(0, value - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [attempt.questions.length])

  const queueSave = (questionId: string, payload: OutboxItem) => {
    window.clearTimeout(timers.current[questionId])
    timers.current[questionId] = window.setTimeout(() => {
      setSaveState('saving')
      void apiRequest<{ questionId: string; version: number; savedAt: string }>(`/attempts/${attempt.id}/answers`, {
        method: 'PUT',
        body: JSON.stringify(payload),
        silent: true,
      })
        .then((saved) => {
          setSaveState('saved')
          setAnswers((prev) => {
            const cur = prev[saved.questionId]
            if (!cur) return prev
            return { ...prev, [saved.questionId]: { ...cur, version: saved.version, savedAt: saved.savedAt } }
          })
        })
        .catch((error: Error) => {
          enqueueOutbox(attempt.id, payload)
          if (error instanceof ApiError && error.status === 409) {
            setSaveState('rejected')
            setLateNote(error.message)
          } else {
            setSaveState('failed')
            void apiRequest(`/attempts/${attempt.id}/incidents`, {
              method: 'POST',
              body: JSON.stringify({ type: 'autosave_failed' }),
              silent: true,
            }).catch(() => undefined)
          }
        })
    }, 500)
  }

  const updateChoice = (choiceId: string) => {
    if (!question || attempt.status !== 'in_progress') return
    const current = answers[question.questionId] ?? { choiceIds: [], text: '', savedAt: null, version: 0 }
    const choiceIds =
      question.type === 'multi'
        ? current.choiceIds.includes(choiceId)
          ? current.choiceIds.filter((id) => id !== choiceId)
          : [...current.choiceIds, choiceId]
        : [choiceId]
    const next = { ...current, choiceIds }
    setAnswers({ ...answers, [question.questionId]: next })
    queueSave(question.questionId, { questionId: question.questionId, choiceIds, flaggedForReview: flags[question.questionId] })
  }

  const updateText = (text: string) => {
    if (!question) return
    const current = answers[question.questionId] ?? { choiceIds: [], text: '', savedAt: null, version: 0 }
    setAnswers({ ...answers, [question.questionId]: { ...current, text } })
    queueSave(question.questionId, { questionId: question.questionId, text, flaggedForReview: flags[question.questionId] })
  }

  const toggleFlag = () => {
    if (!question) return
    const flagged = !flags[question.questionId]
    setFlags({ ...flags, [question.questionId]: flagged })
    const current = answers[question.questionId]
    queueSave(question.questionId, {
      questionId: question.questionId,
      choiceIds: current?.choiceIds,
      text: current?.text,
      flaggedForReview: flagged,
    })
  }

  const [prefsError, setPrefsError] = useState('')
  const savePrefs = async (next: Preferences) => {
    setPrefs(next)
    setPrefsError('')
    try {
      await apiRequest('/preferences', { method: 'PUT', body: JSON.stringify(next) })
      await queryClient.invalidateQueries({ queryKey: ['preferences'] })
    } catch (error) {
      setPrefsError(error instanceof Error ? error.message : 'Could not save workspace preferences')
    }
  }

  const statusLabel = useMemo(() => {
    if (!online) return 'Offline · queued'
    if (saveState === 'saving') return 'Saving…'
    if (saveState === 'saved') return 'Saved'
    if (saveState === 'failed') return 'Retry pending'
    if (saveState === 'rejected') return 'Deadline passed'
    return 'Ready'
  }, [online, saveState])

  const submit = async () => {
    setSubmitting(true)
    setSubmitError('')
    try {
      const fresh = await apiRequest<AttemptView>(`/attempts/${attempt.id}/submit`, { method: 'POST' })
      setAttempt(fresh)
      onAttempt(fresh)
      setConfirming(false)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not submit attempt')
    } finally {
      setSubmitting(false)
    }
  }

  const unansweredCount = useMemo(
    () =>
      attempt.questions.filter((item) => {
        const answer = answers[item.questionId]
        return item.type === 'written' ? !answer?.text.trim() : (answer?.choiceIds.length ?? 0) === 0
      }).length,
    [attempt.questions, answers],
  )
  const flaggedCount = useMemo(
    () => attempt.questions.filter((item) => Boolean(flags[item.questionId])).length,
    [attempt.questions, flags],
  )

  const answeredCount = attempt.questions.length - unansweredCount
  const totalQuestions = attempt.questions.length
  const progressPct = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0
  const announcements = attempt.announcements
  const latestAnnouncement = announcements[announcements.length - 1]
  const olderAnnouncements = announcements.slice(0, -1).reverse()
  const annMinimized = minimizedAnnCount === announcements.length
  const hasNotices = !online || Boolean(lateNote) || announcements.length > 0 || attempt.status !== 'in_progress'
  const syncTone =
    !online || saveState === 'rejected' || saveState === 'failed'
      ? 'sync-pill warn'
      : saveState === 'saved'
        ? 'sync-pill ok'
        : 'sync-pill'

  return (
    <div className="runner" data-contrast={prefs.contrast} data-font={prefs.fontScale} data-nav={prefs.navigator}>
      <header className="runner-bar">
        <div className="runner-brand">
          <strong>{attempt.examTitle}</strong>
          {attempt.isSandbox && <span className="pill warn">Sandbox</span>}
        </div>
        <div className="runner-telemetry">
          <div className={urgent ? 'timer-pill urgent' : 'timer-pill'} aria-live="polite">
            <Clock size={17} />
            <p className={urgent ? 'timer urgent' : 'timer'} role="timer">
              {formatRemaining(remaining)}
            </p>
            {urgent && attempt.status === 'in_progress' && <span className="timer-urgent-tag">Ending soon</span>}
          </div>
          <p className={syncTone} role="status">
            {!online ? (
              <WifiOff size={14} />
            ) : saveState === 'rejected' || saveState === 'failed' ? (
              <AlertTriangle size={14} />
            ) : saveState === 'saved' ? (
              <Check size={14} />
            ) : (
              <Wifi size={14} />
            )}
            {statusLabel}
          </p>
        </div>
        <div className="row">
          {annMinimized && announcements.length > 0 && (
            <button
              type="button"
              className="notice-chip-btn"
              onClick={() => setMinimizedAnnCount(null)}
              title="Show announcements"
            >
              <Megaphone size={13} /> {announcements.length}
            </button>
          )}
          <Button
            type="button"
            variant="ghost"
            aria-expanded={scratchOpen}
            onClick={() => {
              setPrefsOpen(false)
              setConfirming(false)
              setScratchOpen((open) => !open)
            }}
          >
            <FileEdit size={15} /> Scratchpad
          </Button>
          <Button
            type="button"
            variant="ghost"
            aria-expanded={prefsOpen}
            onClick={() => {
              setScratchOpen(false)
              setConfirming(false)
              setPrefsOpen((open) => !open)
            }}
          >
            <SlidersHorizontal size={15} /> View
          </Button>
          {attempt.status === 'in_progress' ? (
            <Button
              type="button"
              onClick={() => {
                setScratchOpen(false)
                setPrefsOpen(false)
                setConfirming(true)
              }}
            >
              <Send size={15} /> Submit
            </Button>
          ) : (
            <Link className="btn-ghost" to={attempt.isSandbox ? '/examiner/exams' : '/candidate'}>
              <LogOut size={15} /> Leave
            </Link>
          )}
        </div>
      </header>
      {hasNotices && !(
        online &&
        !lateNote &&
        attempt.status === 'in_progress' &&
        annMinimized
      ) && (
        <div className="runner-notices">
          {latestAnnouncement && !annMinimized && (
            <div className={`runner-notice-bar announcement${annExpanded ? ' expanded' : ''}`} role="status">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="runner-notice-main">
                  <span className="runner-notice-icon" aria-hidden="true">
                    <Megaphone size={13} />
                  </span>
                  <p className="runner-notice-text" title={latestAnnouncement.body}>
                    {latestAnnouncement.body}
                  </p>
                </div>
                {annExpanded && olderAnnouncements.length > 0 && (
                  <div className="runner-notice-history">
                    {olderAnnouncements.map((item) => (
                      <p key={item.id}>{item.body}</p>
                    ))}
                  </div>
                )}
              </div>
              <div className="runner-notice-actions">
                {olderAnnouncements.length > 0 && (
                  <button
                    type="button"
                    className="notice-chip-btn"
                    onClick={() => setAnnExpanded((value) => !value)}
                  >
                    {annExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    {annExpanded ? 'Less' : `+${olderAnnouncements.length} earlier`}
                  </button>
                )}
                <button
                  type="button"
                  className="notice-chip-btn"
                  aria-label="Hide announcement bar"
                  onClick={() => {
                    setAnnExpanded(false)
                    setMinimizedAnnCount(announcements.length)
                  }}
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          )}
          {!online && (
            <div className="runner-notice-bar">
              <span>Offline — new answers stay queued locally; deadline does not pause.</span>
            </div>
          )}
          {lateNote && (
            <div className="runner-notice-bar error">
              <span>{lateNote}</span>
            </div>
          )}
          {attempt.status !== 'in_progress' && (
            <div className="runner-notice-bar ok">
              <span>Attempt {attempt.status}.</span>
            </div>
          )}
        </div>
      )}
      <div className="runner-body">
        {question && (
          <article className="question-card">
            <div className="q-card-head">
              <div className="q-card-meta">
                <span className="q-num-pill">
                  Question {index + 1} / {totalQuestions}
                </span>
                <span className="pill">{question.marks} {question.marks === 1 ? 'pt' : 'pts'}</span>
                <span className="pill">
                  {question.type === 'single' ? 'Single choice' : question.type === 'multi' ? 'Multiple choice' : 'Written'}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                className={flags[question.questionId] ? 'flag-btn-active' : undefined}
                aria-pressed={Boolean(flags[question.questionId])}
                onClick={toggleFlag}
              >
                <Flag size={15} /> {flags[question.questionId] ? 'Marked for review' : 'Mark review'}
              </Button>
            </div>
            <h1 className="q-card-stem">{question.stem}</h1>
            {question.type === 'written' ? (
              <label>
                Response
                <textarea
                  className="q-textarea"
                  placeholder="Write your answer here…"
                  value={answers[question.questionId]?.text ?? ''}
                  onChange={(event) => updateText(event.target.value)}
                  disabled={attempt.status !== 'in_progress'}
                />
              </label>
            ) : (
              <div className="q-choices">
                {question.choices.map((choice, choiceIndex) => {
                  const checked = (answers[question.questionId]?.choiceIds ?? []).includes(choice.id)
                  return (
                    <label className={checked ? 'choice selected' : 'choice'} key={choice.id}>
                      <input
                        type={question.type === 'single' ? 'radio' : 'checkbox'}
                        name={question.questionId}
                        checked={checked}
                        onChange={() => updateChoice(choice.id)}
                        disabled={attempt.status !== 'in_progress'}
                      />
                      <span className="choice-letter">{String.fromCharCode(65 + choiceIndex)}</span>
                      <span>{choice.text}</span>
                    </label>
                  )
                })}
              </div>
            )}
            <div className="q-card-foot">
              <Button type="button" variant="ghost" onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index === 0}>
                <ChevronLeft size={15} /> Previous
              </Button>
              <span className="meta">
                {index + 1} of {totalQuestions}
              </span>
              <Button type="button" variant="ghost" onClick={() => setIndex((value) => Math.min(totalQuestions - 1, value + 1))} disabled={index === totalQuestions - 1}>
                Next <ChevronRight size={15} />
              </Button>
            </div>
          </article>
        )}
        <aside className="palette-panel" aria-label="Question navigator">
          <div className="palette-head">
            <strong>Questions</strong>
            <span className={answeredCount === totalQuestions && totalQuestions > 0 ? 'pill ok' : 'pill'}>
              {answeredCount}/{totalQuestions} done
            </span>
          </div>
          <div className="palette-progress" aria-hidden="true">
            <span style={{ width: `${progressPct}%` }} />
          </div>
          <nav className="palette" aria-label="Questions">
            {attempt.questions.map((item, itemIndex) => {
              const answer = answers[item.questionId]
              const answered = item.type === 'written' ? Boolean(answer?.text.trim()) : (answer?.choiceIds.length ?? 0) > 0
              return (
                <button
                  key={item.questionId}
                  type="button"
                  className={`${answered ? 'answered' : ''} ${flags[item.questionId] ? 'review' : ''} ${itemIndex === index ? 'current' : ''}`}
                  aria-current={itemIndex === index ? 'true' : undefined}
                  aria-label={`Question ${itemIndex + 1}${answered ? ', answered' : ', unanswered'}${flags[item.questionId] ? ', marked for review' : ''}`}
                  onClick={() => setIndex(itemIndex)}
                >
                  {itemIndex + 1}
                </button>
              )
            })}
          </nav>
          <div className="palette-legend">
            <span><i className="swatch current" /> Current</span>
            <span><i className="swatch answered" /> Answered</span>
            <span><i className="swatch review" /> Review{flaggedCount > 0 ? ` (${flaggedCount})` : ''}</span>
          </div>
        </aside>
      </div>
      {scratchOpen && (
        <aside className="drawer">
          <div className="drawer-head">
            <h2>Scratchpad</h2>
            <button type="button" className="btn-icon" aria-label="Close scratchpad" onClick={() => setScratchOpen(false)}>
              <X size={16} />
            </button>
          </div>
          <p className="meta" style={{ margin: 0 }}>Rough work only — not graded.</p>
          {scratchError && <Banner tone="error">{scratchError}</Banner>}
          <textarea
            value={scratchpad}
            disabled={attempt.status !== 'in_progress'}
            onChange={(event) => {
              const text = event.target.value
              setScratchpad(text)
              setScratchError('')
              window.clearTimeout(timers.current.scratch)
              timers.current.scratch = window.setTimeout(() => {
                void apiRequest(`/attempts/${attempt.id}/scratchpad`, { method: 'PUT', body: JSON.stringify({ text }), silent: true })
                  .catch((error: Error) => {
                    setScratchError(error.message || 'Could not save scratchpad')
                  })
              }, 500)
            }}
          />
        </aside>
      )}
      {prefsOpen && (
        <Dialog title="Workspace" onClose={() => setPrefsOpen(false)}>
          {prefsError && <Banner tone="error">{prefsError}</Banner>}
          <label>
            Type size
            <Select value={prefs.fontScale} onChange={(event) => void savePrefs({ ...prefs, fontScale: event.target.value as Preferences['fontScale'] })}>
              <option value="sm">Small</option>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
            </Select>
          </label>
          <label>
            Contrast
            <Select value={prefs.contrast} onChange={(event) => void savePrefs({ ...prefs, contrast: event.target.value as Preferences['contrast'] })}>
              <option value="default">Paper</option>
              <option value="high">High contrast</option>
            </Select>
          </label>
          <label>
            Question list
            <Select value={prefs.navigator} onChange={(event) => void savePrefs({ ...prefs, navigator: event.target.value as Preferences['navigator'] })}>
              <option value="side">Side</option>
              <option value="bottom">Bottom</option>
            </Select>
          </label>
        </Dialog>
      )}
      {confirming && (
        <Dialog
          title="Submit this attempt?"
          onClose={() => {
            if (!submitting) setConfirming(false)
          }}
        >
          <p style={{ margin: 0 }}>You can submit once. Unanswered questions stay blank.</p>
          <p className="meta" style={{ margin: 0 }}>
            {unansweredCount} unanswered · {flaggedCount} marked for review
          </p>
          {submitError && <Banner tone="error">{submitError}</Banner>}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button type="button" variant="ghost" disabled={submitting} onClick={() => setConfirming(false)}>
              Keep working
            </Button>
            <Button type="button" disabled={submitting} onClick={() => void submit()}>
              {submitting ? 'Submitting…' : 'Submit now'}
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  )
}
