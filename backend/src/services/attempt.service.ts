import { Announcement, Answer, Attempt, Enrollment, Exam, Incident, Scratchpad } from '../models/index.js'
import { redisCall } from '../db/redis.js'
import { HttpError } from '../lib/http-error.js'
import type { QuestionSnapshot, SessionUser } from '../types/domain.js'
import { loadOwnedExam } from './access.js'
import { computeDeadline, isPastDeadline } from './deadline.js'
import { asSettings } from './exam.service.js'
import { lifecycleOf } from './lifecycle.js'
import { scoreObjective, writtenAwaitingMark } from './marking.js'
import { buildSnapshots } from './paper.js'
import { toCandidateQuestion } from './serializers.js'

const finalized = new Set(['submitted', 'expired', 'graded'])

const cacheDeadline = async (attemptId: string, deadlineAt: Date) => {
  const ttl = Math.max(60, Math.ceil((deadlineAt.getTime() - Date.now()) / 1000) + 3600)
  await redisCall((redis) => redis.set(`attempt:${attemptId}:deadline`, deadlineAt.toISOString(), 'EX', ttl))
}

export const finalizeAttempt = async (attemptId: string, reason: 'submit' | 'expired') => {
  const current = await Attempt.findById(attemptId)
  if (!current) throw new HttpError(404, 'Attempt not found')
  if (current.status !== 'in_progress') return current

  const hasWritten = current.questionSnapshots.some((snapshot) => snapshot.type === 'written')
  const claimedStatus = hasWritten ? (reason === 'expired' ? 'expired' : 'submitted') : 'graded'
  const claimed = await Attempt.findOneAndUpdate(
    { _id: attemptId, status: 'in_progress' },
    {
      $set: {
        status: claimedStatus,
        gradingStatus: hasWritten ? 'pending_subjective' : 'ready',
        submittedAt: new Date(),
      },
    },
    { returnDocument: 'after' },
  )
  if (!claimed) return await Attempt.findById(attemptId)

  const answers = await Answer.find({ attemptId })
  const answerByQuestion = new Map(answers.map((answer) => [answer.questionId, answer]))
  let objectiveScore = 0

  for (const snapshot of claimed.questionSnapshots) {
    const answer = answerByQuestion.get(snapshot.questionId)
    const score = scoreObjective({
      type: snapshot.type,
      correctChoiceIds: snapshot.correctChoiceIds,
      marks: snapshot.marks,
      choiceIds: answer?.choiceIds ?? [],
    })
    if (score !== null) objectiveScore += score
  }

  return await Attempt.findByIdAndUpdate(
    attemptId,
    {
      $set: {
        objectiveScore,
        writtenScore: 0,
        totalScore: objectiveScore,
      },
    },
    { returnDocument: 'after' },
  )
}

const ownAttempt = async (attemptId: string, user: SessionUser) => {
  const attempt = await Attempt.findById(attemptId)
  if (!attempt) throw new HttpError(404, 'Attempt not found')
  if (attempt.candidateId.toString() === user.id) return attempt
  if (user.role === 'examiner' || user.role === 'admin') {
    await loadOwnedExam(attempt.examId.toString(), user)
    return attempt
  }
  throw new HttpError(403, 'You cannot access this attempt')
}

const presentAttempt = async (attempt: NonNullable<Awaited<ReturnType<typeof ownAttempt>>>, user: SessionUser) => {
  const exam = await Exam.findById(attempt.examId)
  if (!exam) throw new HttpError(404, 'Examination not found')
  const answers = await Answer.find({ attemptId: attempt._id })
  const scratchpad = await Scratchpad.findOne({ attemptId: attempt._id })
  const announcements = await Announcement.find({ examId: attempt.examId }).sort({ createdAt: 1 })
  const includeKeys = user.role !== 'candidate' && attempt.candidateId.toString() !== user.id
  const showResults = (exam.resultsPublished && !writtenAwaitingMark(attempt)) || includeKeys

  return {
    id: attempt._id.toString(),
    examId: attempt.examId.toString(),
    examTitle: exam.title,
    instructions: exam.instructions,
    isSandbox: attempt.isSandbox,
    status: attempt.status,
    gradingStatus: attempt.gradingStatus,
    startedAt: attempt.startedAt,
    deadlineAt: attempt.deadlineAt,
    submittedAt: attempt.submittedAt,
    serverNow: new Date().toISOString(),
    objectiveScore: showResults ? attempt.objectiveScore : null,
    writtenScore: showResults ? attempt.writtenScore : null,
    totalScore: showResults ? attempt.totalScore : null,
    totalMarks: attempt.questionSnapshots.reduce((sum, item) => sum + item.marks, 0),
    resultsPublished: exam.resultsPublished,
    scratchpad: attempt.candidateId.toString() === user.id ? (scratchpad?.text ?? '') : '',
    announcements: announcements.map((item) => ({
      id: item._id.toString(),
      body: item.body,
      createdAt: item.createdAt,
    })),
    questions: [...attempt.questionSnapshots]
      .sort((a, b) => a.order - b.order)
      .map((snapshot) => {
        const answer = answers.find((item) => item.questionId === snapshot.questionId)
        const base = includeKeys
          ? snapshot
          : toCandidateQuestion(snapshot as QuestionSnapshot)
        return {
          ...base,
          flaggedForReview: answer?.flaggedForReview ?? false,
          answer: {
            choiceIds: answer?.choiceIds ?? [],
            text: answer?.text ?? '',
            savedAt: answer?.savedAt ?? null,
            version: answer?.version ?? 0,
          },
        }
      }),
  }
}

export const getAttemptView = async (user: SessionUser, attemptId: string) => {
  const attempt = await ownAttempt(attemptId, user)
  if (attempt.status === 'in_progress' && isPastDeadline(attempt.deadlineAt)) {
    const finalizedAttempt = await finalizeAttempt(attempt.id, 'expired')
    if (!finalizedAttempt) throw new HttpError(404, 'Attempt not found')
    return presentAttempt(finalizedAttempt, user)
  }
  return presentAttempt(attempt, user)
}

export const startCandidateAttempt = async (user: SessionUser, examId: string) => {
  if (user.role !== 'candidate') throw new HttpError(403, 'Only candidates can sit an examination')
  const exam = await Exam.findById(examId)
  if (!exam || exam.publication !== 'published') throw new HttpError(404, 'Examination not found')
  const enrolled = await Enrollment.findOne({ examId, candidateId: user.id })
  if (!enrolled) throw new HttpError(403, 'You are not enrolled in this examination')

  const existing = await Attempt.findOne({ examId, candidateId: user.id, isSandbox: false })
  if (existing) {
    if (finalized.has(existing.status)) throw new HttpError(409, 'You have already submitted this examination')
    if (isPastDeadline(existing.deadlineAt)) {
      const finalizedAttempt = await finalizeAttempt(existing.id, 'expired')
      if (!finalizedAttempt) throw new HttpError(404, 'Attempt not found')
      return presentAttempt(finalizedAttempt, user)
    }
    return presentAttempt(existing, user)
  }

  const lifecycle = lifecycleOf(exam.publication, exam.windowStart, exam.windowEnd)
  if (lifecycle === 'published') throw new HttpError(403, 'This examination is not open yet')
  if (lifecycle === 'completed') throw new HttpError(403, 'The examination window has closed')

  const startedAt = new Date()
  const deadlineAt = computeDeadline(startedAt, exam.durationMinutes, exam.windowEnd)
  const snapshots = await buildSnapshots(examId, asSettings(exam.settings))
  const attempt = await Attempt.create({
    examId,
    candidateId: user.id,
    isSandbox: false,
    startedAt,
    deadlineAt,
    questionSnapshots: snapshots,
  })
  await cacheDeadline(attempt.id, deadlineAt)
  return presentAttempt(attempt, user)
}

export const startSandbox = async (user: SessionUser, examId: string) => {
  const exam = await loadOwnedExam(examId, user)
  const startedAt = new Date()
  const deadlineAt = new Date(startedAt.getTime() + exam.durationMinutes * 60_000)
  const snapshots = await buildSnapshots(examId, asSettings(exam.settings))
  const attempt = await Attempt.create({
    examId,
    candidateId: user.id,
    isSandbox: true,
    startedAt,
    deadlineAt,
    questionSnapshots: snapshots,
  })
  await cacheDeadline(attempt.id, deadlineAt)
  return presentAttempt(attempt, user)
}

export const saveAnswer = async (
  user: SessionUser,
  attemptId: string,
  input: {
    questionId: string
    choiceIds?: string[]
    text?: string
    flaggedForReview?: boolean
    expectedVersion?: number
  },
) => {
  const attempt = await ownAttempt(attemptId, user)
  if (attempt.candidateId.toString() !== user.id) {
    throw new HttpError(403, 'Only the sitting candidate can save answers')
  }
  if (attempt.status !== 'in_progress') throw new HttpError(409, 'This attempt is already finalized')
  if (isPastDeadline(attempt.deadlineAt)) {
    await finalizeAttempt(attempt.id, 'expired')
    throw new HttpError(409, 'The deadline has passed. This answer was not accepted.')
  }

  const snapshot = attempt.questionSnapshots.find((item) => item.questionId === input.questionId)
  if (!snapshot) throw new HttpError(404, 'That question is not on this attempt')

  const choiceIds = input.choiceIds ?? []
  const allowed = new Set(snapshot.choices.map((choice) => choice.id))
  if (choiceIds.some((choiceId) => !allowed.has(choiceId))) {
    throw new HttpError(400, 'That choice is not on this question')
  }
  if (snapshot.type === 'single' && choiceIds.length > 1) {
    throw new HttpError(400, 'Select one choice')
  }
  if (snapshot.type === 'written' && choiceIds.length > 0) {
    throw new HttpError(400, 'Written questions do not take choices')
  }

  const existing = await Answer.findOne({ attemptId, questionId: input.questionId })
  if (
    input.expectedVersion !== undefined &&
    existing &&
    existing.version > input.expectedVersion
  ) {
    throw new HttpError(409, 'A newer answer has already been saved on the server')
  }

  const stillActive = await Attempt.exists({ _id: attemptId, status: 'in_progress' })
  if (!stillActive) {
    throw new HttpError(409, 'This attempt is already finalized')
  }

  const saved = await Answer.findOneAndUpdate(
    { attemptId, questionId: input.questionId },
    {
      $set: {
        choiceIds: input.choiceIds ?? existing?.choiceIds ?? [],
        text: input.text ?? existing?.text ?? '',
        flaggedForReview: input.flaggedForReview ?? existing?.flaggedForReview ?? false,
        savedAt: new Date(),
        version: (existing?.version ?? 0) + 1,
      },
    },
    { upsert: true, returnDocument: 'after' },
  )

  const activeAfterSave = await Attempt.exists({ _id: attemptId, status: 'in_progress' })
  if (!activeAfterSave) {
    throw new HttpError(409, 'This attempt was finalized while saving')
  }

  await redisCall((redis) =>
    redis.hset(
      `attempt:${attemptId}:answers`,
      input.questionId,
      JSON.stringify({ choiceIds: saved.choiceIds, text: saved.text, version: saved.version }),
    ),
  )

  return {
    questionId: input.questionId,
    choiceIds: saved.choiceIds,
    text: saved.text,
    flaggedForReview: saved.flaggedForReview,
    version: saved.version,
    savedAt: saved.savedAt,
    serverNow: new Date().toISOString(),
    deadlineAt: attempt.deadlineAt,
  }
}

export const submitAttempt = async (user: SessionUser, attemptId: string) => {
  const attempt = await ownAttempt(attemptId, user)
  if (attempt.candidateId.toString() !== user.id) throw new HttpError(403, 'Only the sitting candidate can submit')
  if (attempt.status !== 'in_progress') return presentAttempt(attempt, user)
  const reason = isPastDeadline(attempt.deadlineAt) ? 'expired' : 'submit'
  const finalizedAttempt = await finalizeAttempt(attempt.id, reason)
  if (!finalizedAttempt) throw new HttpError(404, 'Attempt not found')
  return presentAttempt(finalizedAttempt, user)
}

export const heartbeat = async (user: SessionUser, attemptId: string) => {
  const attempt = await ownAttempt(attemptId, user)
  if (attempt.status === 'in_progress' && isPastDeadline(attempt.deadlineAt)) {
    await finalizeAttempt(attempt.id, 'expired')
  }
  const fresh = await Attempt.findById(attemptId)
  if (fresh?.status === 'in_progress') {
    await redisCall((redis) => redis.hset(`exam:${fresh.examId.toString()}:seen`, fresh.id, Date.now().toString()))
  }
  return {
    serverNow: new Date().toISOString(),
    deadlineAt: fresh?.deadlineAt ?? attempt.deadlineAt,
    status: fresh?.status ?? attempt.status,
  }
}

export const saveScratchpad = async (user: SessionUser, attemptId: string, text: string) => {
  const attempt = await ownAttempt(attemptId, user)
  if (attempt.candidateId.toString() !== user.id) throw new HttpError(403, 'Only the sitting candidate can use the scratchpad')
  if (attempt.status !== 'in_progress') throw new HttpError(409, 'This attempt is already finalized')
  if (isPastDeadline(attempt.deadlineAt)) {
    await finalizeAttempt(attempt.id, 'expired')
    throw new HttpError(409, 'The deadline has passed. Scratchpad cannot be updated.')
  }
  await Scratchpad.findOneAndUpdate(
    { attemptId },
    { $set: { text, updatedAt: new Date() } },
    { upsert: true },
  )
  return { text }
}

export const recordIncident = async (
  user: SessionUser,
  attemptId: string,
  type: 'disconnect' | 'reconnect' | 'blur' | 'focus' | 'autosave_failed',
  note = '',
) => {
  const attempt = await ownAttempt(attemptId, user)
  if (attempt.candidateId.toString() !== user.id) {
    throw new HttpError(403, 'Only the sitting candidate can record attempt incidents')
  }
  if (attempt.status !== 'in_progress') return { recorded: false }
  await Incident.create({
    attemptId: attempt._id,
    examId: attempt.examId,
    type,
    at: new Date(),
    note,
    conclusive: false,
  })
  return { recorded: true, conclusive: false }
}

export const expireDueAttempts = async () => {
  const due = await Attempt.find({ status: 'in_progress', deadlineAt: { $lte: new Date() } }).select('_id')
  for (const attempt of due) {
    await finalizeAttempt(attempt.id, 'expired')
  }
  return due.length
}
