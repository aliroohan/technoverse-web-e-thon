import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useParams } from '@tanstack/react-router'
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileEdit,
  Flag,
  LogOut,
  Send,
  SlidersHorizontal,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { Banner, Button, Select } from '../components/ui'
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
  const [answers, setAnswers] = useState(() => Object.fromEntries(initial.questions.map((question) => [question.questionId, question.answer])))
  const [flags, setFlags] = useState(() => Object.fromEntries(initial.questions.map((question) => [question.questionId, question.flaggedForReview])))
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [online, setOnline] = useState(navigator.onLine)
  const [offset, setOffset] = useState(() => new Date(initial.serverNow).getTime() - Date.now())
  const [now, setNow] = useState(() => Date.now())
  const [scratchpad, setScratchpad] = useState(initial.scratchpad)
  const [scratchOpen, setScratchOpen] = useState(false)
  const [prefsOpen, setPrefsOpen] = useState(false)
  const [prefs, setPrefs] = useState(preferences)
  const [confirming, setConfirming] = useState(false)
  const [lateNote, setLateNote] = useState('')
  const timers = useRef<Record<string, number>>({})

  const question = attempt.questions[index]
  const remaining = new Date(attempt.deadlineAt).getTime() - (now + offset)
  const urgent = remaining < 5 * 60 * 1000 && attempt.status === 'in_progress'

  const flush = useCallback(async () => {
    const queued = readOutbox(attempt.id)
    const kept: OutboxItem[] = []
    for (const item of queued) {
      try {
        await apiRequest(`/attempts/${attempt.id}/answers`, { method: 'PUT', body: JSON.stringify(item), silent: true })
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          setLateNote(error.message)
        } else {
          kept.push(item)
        }
      }
    }
    writeOutbox(attempt.id, kept)
    if (kept.length === 0) setSaveState('saved')
  }, [attempt.id])

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 1000)
    const onOnline = () => {
      setOnline(true)
      void flush()
    }
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.clearInterval(clock)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [attempt.id, flush])

  useEffect(() => {
    const beat = window.setInterval(() => {
      void apiRequest<{ serverNow: string; deadlineAt: string; status: AttemptView['status'] }>(`/attempts/${attempt.id}/heartbeat`, {
        method: 'POST',
        silent: true,
      }).then((pulse) => {
        setOffset(new Date(pulse.serverNow).getTime() - Date.now())
        setAttempt((current) => ({ ...current, deadlineAt: pulse.deadlineAt, status: pulse.status }))
        if (pulse.status !== 'in_progress') {
          void apiRequest<AttemptView>(`/attempts/${attempt.id}`).then((fresh) => {
            setAttempt(fresh)
            onAttempt(fresh)
          })
        }
      })
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
      void apiRequest(`/attempts/${attempt.id}/answers`, { method: 'PUT', body: JSON.stringify(payload), silent: true })
        .then(() => setSaveState('saved'))
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

  const savePrefs = async (next: Preferences) => {
    setPrefs(next)
    await apiRequest('/preferences', { method: 'PUT', body: JSON.stringify(next) })
    await queryClient.invalidateQueries({ queryKey: ['preferences'] })
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
    const fresh = await apiRequest<AttemptView>(`/attempts/${attempt.id}/submit`, { method: 'POST' })
    setAttempt(fresh)
    onAttempt(fresh)
    setConfirming(false)
  }

  return (
    <div className="runner" data-contrast={prefs.contrast} data-font={prefs.fontScale} data-nav={prefs.navigator}>
      <header className="runner-bar">
        <div>
          <strong>{attempt.examTitle}</strong>
          {attempt.isSandbox && <div className="meta">Sandbox mode</div>}
        </div>
        <div>
          <p className={urgent ? 'timer urgent meta-chip' : 'timer meta-chip'} role="timer">
            <Clock size={20} />
            {formatRemaining(remaining)}
          </p>
          {urgent && attempt.status === 'in_progress' && <p className="meta" style={{ margin: 0 }}>Ending soon</p>}
        </div>
        <p className="meta meta-chip" role="status" style={{ margin: 0 }}>
          {!online ? (
            <WifiOff size={15} />
          ) : saveState === 'rejected' || saveState === 'failed' ? (
            <AlertTriangle size={15} />
          ) : saveState === 'saved' ? (
            <Check size={15} />
          ) : (
            <Wifi size={15} />
          )}
          {statusLabel}
        </p>
        <div className="row">
          <Button type="button" variant="ghost" onClick={() => setScratchOpen((open) => !open)}>
            <FileEdit size={15} /> Scratchpad
          </Button>
          <Button type="button" variant="ghost" onClick={() => setPrefsOpen((open) => !open)}>
            <SlidersHorizontal size={15} /> View
          </Button>
          {attempt.status === 'in_progress' ? (
            <Button type="button" onClick={() => setConfirming(true)}>
              <Send size={15} /> Submit
            </Button>
          ) : (
            <Link className="btn-ghost" to={attempt.isSandbox ? '/examiner/exams' : '/candidate'}>
              <LogOut size={15} /> Leave
            </Link>
          )}
        </div>
      </header>
      {!online && (
        <Banner>Offline — new answers stay queued locally; deadline does not pause.</Banner>
      )}
      {lateNote && <Banner tone="error">{lateNote}</Banner>}
      {attempt.announcements.map((announcement) => (
        <Banner key={announcement.id}>{announcement.body}</Banner>
      ))}
      {attempt.status !== 'in_progress' && (
        <Banner tone="ok">Attempt {attempt.status}.</Banner>
      )}
      <div className="runner-body">
        {question && (
          <article className="question-card">
            <p className="meta">Question {index + 1} / {attempt.questions.length} · {question.marks} pts · {question.type}</p>
            <h1 style={{ fontFamily: 'var(--serif)', fontWeight: 520, fontSize: '1.8rem' }}>{question.stem}</h1>
            {question.type === 'written' ? (
              <label>
                Response
                <textarea value={answers[question.questionId]?.text ?? ''} onChange={(event) => updateText(event.target.value)} disabled={attempt.status !== 'in_progress'} />
              </label>
            ) : (
              question.choices.map((choice) => (
                <label className="choice" key={choice.id}>
                  <input
                    type={question.type === 'single' ? 'radio' : 'checkbox'}
                    name={question.questionId}
                    checked={(answers[question.questionId]?.choiceIds ?? []).includes(choice.id)}
                    onChange={() => updateChoice(choice.id)}
                    disabled={attempt.status !== 'in_progress'}
                  />
                  <span>{choice.text}</span>
                </label>
              ))
            )}
            <div className="row" style={{ marginTop: '1rem' }}>
              <Button type="button" variant="ghost" onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index === 0}>
                <ChevronLeft size={15} /> Previous
              </Button>
              <Button type="button" variant="ghost" onClick={toggleFlag}>
                <Flag size={15} /> {flags[question.questionId] ? 'Unmark' : 'Review'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setIndex((value) => Math.min(attempt.questions.length - 1, value + 1))} disabled={index === attempt.questions.length - 1}>
                Next <ChevronRight size={15} />
              </Button>
            </div>
          </article>
        )}
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
      </div>
      {scratchOpen && (
        <aside className="drawer">
          <h2>Scratchpad</h2>
          <p className="meta">Rough work only — not graded.</p>
          <textarea
            value={scratchpad}
            onChange={(event) => {
              const text = event.target.value
              setScratchpad(text)
              window.clearTimeout(timers.current.scratch)
              timers.current.scratch = window.setTimeout(() => {
                void apiRequest(`/attempts/${attempt.id}/scratchpad`, { method: 'PUT', body: JSON.stringify({ text }), silent: true })
              }, 500)
            }}
          />
        </aside>
      )}
      {prefsOpen && (
        <aside className="drawer">
          <h2>Workspace</h2>
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
        </aside>
      )}
      {confirming && (
        <aside className="drawer">
          <h2>Submit this attempt?</h2>
          <p>You can submit once. Unanswered questions stay blank.</p>
          <div className="row">
            <Button type="button" onClick={() => void submit()}>Submit now</Button>
            <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>Keep working</Button>
          </div>
        </aside>
      )}
    </div>
  )
}
