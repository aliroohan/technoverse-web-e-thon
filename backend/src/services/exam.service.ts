import { randomBytes } from 'node:crypto'
import {
  Attempt,
  Enrollment,
  Exam,
  ExamQuestion,
  Question,
  User,
} from '../models/index.js'
import { HttpError } from '../lib/http-error.js'
import type { ExamSettings, SessionUser } from '../types/domain.js'
import { DIFFICULTY_WEIGHT } from '../types/domain.js'
import { loadOwnedExam } from './access.js'
import { lifecycleOf } from './lifecycle.js'
import { writtenAwaitingMark } from './marking.js'
import { buildSnapshots, describePaper } from './paper.js'

const id = () => randomBytes(4).toString('hex')

export const asSettings = (settings: {
  randomizeQuestions: boolean
  randomizeChoices: boolean
  fairPaper: boolean
  questionCount?: number | null
  difficultyBudget?: number | null
  tolerance: number
}): ExamSettings => ({
  randomizeQuestions: settings.randomizeQuestions,
  randomizeChoices: settings.randomizeChoices,
  fairPaper: settings.fairPaper,
  questionCount: settings.questionCount ?? null,
  difficultyBudget: settings.difficultyBudget ?? null,
  tolerance: settings.tolerance,
})

export const publicExam = (exam: {
  _id: { toString(): string }
  title: string
  instructions: string
  windowStart: Date
  windowEnd: Date
  durationMinutes: number
  totalMarks: number
  examinerId: { toString(): string }
  publication: 'draft' | 'published'
  resultsPublished: boolean
  settings: {
    randomizeQuestions: boolean
    randomizeChoices: boolean
    fairPaper: boolean
    questionCount?: number | null
    difficultyBudget?: number | null
    tolerance: number
  }
}) => ({
  id: exam._id.toString(),
  title: exam.title,
  instructions: exam.instructions,
  windowStart: exam.windowStart,
  windowEnd: exam.windowEnd,
  durationMinutes: exam.durationMinutes,
  totalMarks: exam.totalMarks,
  examinerId: exam.examinerId.toString(),
  publication: exam.publication,
  resultsPublished: exam.resultsPublished,
  lifecycle: lifecycleOf(exam.publication, exam.windowStart, exam.windowEnd),
  settings: asSettings(exam.settings),
})

const settingsFrom = (input: Partial<ExamSettings> | undefined, current?: ExamSettings): ExamSettings => ({
  randomizeQuestions: input?.randomizeQuestions ?? current?.randomizeQuestions ?? true,
  randomizeChoices: input?.randomizeChoices ?? current?.randomizeChoices ?? true,
  fairPaper: input?.fairPaper ?? current?.fairPaper ?? false,
  questionCount: input?.questionCount === undefined ? (current?.questionCount ?? null) : input.questionCount,
  difficultyBudget:
    input?.difficultyBudget === undefined ? (current?.difficultyBudget ?? null) : input.difficultyBudget,
  tolerance: input?.tolerance ?? current?.tolerance ?? 1,
})

export const createExam = async (
  user: SessionUser,
  input: {
    title: string
    instructions: string
    windowStart: Date
    windowEnd: Date
    durationMinutes: number
    totalMarks: number
    settings?: Partial<ExamSettings>
  },
) => {
  if (input.windowEnd <= input.windowStart) {
    throw new HttpError(400, 'The window must end after it starts')
  }
  const exam = await Exam.create({
    ...input,
    examinerId: user.id,
    publication: 'draft',
    settings: settingsFrom(input.settings),
  })
  return publicExam(exam)
}

export const updateExam = async (
  user: SessionUser,
  examId: string,
  input: {
    title?: string
    instructions?: string
    windowStart?: Date
    windowEnd?: Date
    durationMinutes?: number
    totalMarks?: number
    settings?: Partial<ExamSettings>
  },
) => {
  const exam = await loadOwnedExam(examId, user)
  if (exam.publication === 'published') {
    if (
      input.durationMinutes !== undefined ||
      input.windowStart !== undefined ||
      input.totalMarks !== undefined ||
      input.settings !== undefined
    ) {
      throw new HttpError(400, 'Published examinations lock duration, schedule start, marks, and paper settings')
    }
  }

  if (input.title !== undefined) exam.title = input.title
  if (input.instructions !== undefined) exam.instructions = input.instructions
  if (input.totalMarks !== undefined) exam.totalMarks = input.totalMarks
  if (input.durationMinutes !== undefined) exam.durationMinutes = input.durationMinutes
  if (input.windowStart !== undefined) exam.windowStart = input.windowStart
  if (input.windowEnd !== undefined) {
    if (exam.publication === 'published' && input.windowEnd < new Date()) {
      throw new HttpError(400, 'The window end cannot be moved into the past')
    }
    if (input.windowEnd <= exam.windowStart) throw new HttpError(400, 'The window must end after it starts')
    exam.windowEnd = input.windowEnd
  }
  if (input.settings && exam.publication === 'draft') {
    exam.set('settings', settingsFrom(input.settings, asSettings(exam.settings)))
  }
  if (exam.windowEnd <= exam.windowStart) throw new HttpError(400, 'The window must end after it starts')
  await exam.save()
  return publicExam(exam)
}

export const publishExam = async (user: SessionUser, examId: string) => {
  const exam = await loadOwnedExam(examId, user)
  const count = await ExamQuestion.countDocuments({ examId: exam._id })
  if (count === 0) throw new HttpError(400, 'Add at least one question before publishing')
  if (exam.windowEnd <= exam.windowStart) throw new HttpError(400, 'The window must end after it starts')
  if (exam.durationMinutes < 1) throw new HttpError(400, 'Duration must be positive')
  exam.publication = 'published'
  await exam.save()
  return publicExam(exam)
}

export const listExams = async (user: SessionUser) => {
  const filter = user.role === 'admin' ? {} : { examinerId: user.id }
  const exams = await Exam.find(filter).sort({ updatedAt: -1 })
  return exams.map(publicExam)
}

export const getExam = async (user: SessionUser, examId: string) => {
  const exam = await loadOwnedExam(examId, user)
  const links = await ExamQuestion.find({ examId }).sort({ order: 1 })
  const questions = await Question.find({ _id: { $in: links.map((link) => link.questionId) } })
  const byId = new Map(questions.map((question) => [question._id.toString(), question]))
  const enrollments = await Enrollment.find({ examId })
  const candidates = await User.find({ _id: { $in: enrollments.map((row) => row.candidateId) } })
  const candidateById = new Map(candidates.map((candidate) => [candidate._id.toString(), candidate]))

  return {
    ...publicExam(exam),
    questions: links.map((link) => {
      const question = byId.get(link.questionId.toString())
      return {
        id: link._id.toString(),
        questionId: link.questionId.toString(),
        stem: question?.stem ?? 'Missing question',
        type: question?.type ?? 'written',
        category: question?.category ?? '',
        difficulty: question?.difficulty ?? 'medium',
        marks: link.marks,
        pinned: link.pinned,
        order: link.order,
      }
    }),
    enrollments: enrollments.map((row) => {
      const candidate = candidateById.get(row.candidateId.toString())
      return {
        id: row._id.toString(),
        candidateId: row.candidateId.toString(),
        name: candidate?.name ?? 'Unknown',
        email: candidate?.email ?? '',
      }
    }),
  }
}

export const assignQuestion = async (
  user: SessionUser,
  examId: string,
  input: { questionId: string; marks?: number; pinned?: boolean },
) => {
  const exam = await loadOwnedExam(examId, user)
  if (exam.publication !== 'draft') throw new HttpError(400, 'The question set is locked after publication')
  const question = await Question.findById(input.questionId)
  if (!question) throw new HttpError(404, 'Question not found')
  const existing = await ExamQuestion.findOne({ examId, questionId: question._id })
  if (existing) throw new HttpError(409, 'That question is already on this examination')
  const count = await ExamQuestion.countDocuments({ examId })
  await ExamQuestion.create({
    examId,
    questionId: question._id,
    marks: input.marks ?? question.marks,
    pinned: input.pinned ?? question.type === 'written',
    order: count,
  })
  return getExam(user, examId)
}

export const updateAssignment = async (
  user: SessionUser,
  examId: string,
  questionId: string,
  input: { marks?: number; pinned?: boolean },
) => {
  const exam = await loadOwnedExam(examId, user)
  if (exam.publication !== 'draft') throw new HttpError(400, 'The question set is locked after publication')
  const link = await ExamQuestion.findOne({ examId, questionId })
  if (!link) throw new HttpError(404, 'That question is not on this examination')
  if (input.marks !== undefined) link.marks = input.marks
  if (input.pinned !== undefined) link.pinned = input.pinned
  await link.save()
  return getExam(user, examId)
}

export const unassignQuestion = async (user: SessionUser, examId: string, questionId: string) => {
  const exam = await loadOwnedExam(examId, user)
  if (exam.publication !== 'draft') throw new HttpError(400, 'The question set is locked after publication')
  await ExamQuestion.deleteOne({ examId, questionId })
  return getExam(user, examId)
}

export const enrollCandidate = async (user: SessionUser, examId: string, candidateId: string) => {
  const exam = await loadOwnedExam(examId, user)
  const candidate = await User.findById(candidateId)
  if (!candidate || candidate.role !== 'candidate') throw new HttpError(400, 'Choose a candidate account')
  const existing = await Enrollment.findOne({ examId: exam._id, candidateId })
  if (!existing) await Enrollment.create({ examId: exam._id, candidateId })
  return getExam(user, examId)
}

export const unenrollCandidate = async (user: SessionUser, examId: string, candidateId: string) => {
  await loadOwnedExam(examId, user)
  const attempt = await Attempt.findOne({ examId, candidateId, isSandbox: false })
  if (attempt) throw new HttpError(400, 'This candidate already has an attempt')
  await Enrollment.deleteOne({ examId, candidateId })
  return getExam(user, examId)
}

export const listCandidateExams = async (user: SessionUser) => {
  const enrollments = await Enrollment.find({ candidateId: user.id })
  const exams = await Exam.find({
    _id: { $in: enrollments.map((row) => row.examId) },
    publication: 'published',
  })
  const attempts = await Attempt.find({
    candidateId: user.id,
    isSandbox: false,
    examId: { $in: exams.map((exam) => exam._id) },
  })
  const attemptByExam = new Map(attempts.map((attempt) => [attempt.examId.toString(), attempt]))

  return exams.map((exam) => {
    const lifecycle = lifecycleOf(exam.publication, exam.windowStart, exam.windowEnd)
    const attempt = attemptByExam.get(exam._id.toString())
    let access: 'upcoming' | 'available' | 'completed' | 'closed' = 'closed'
    let canEnter = false
    let reason = 'The examination window has closed'

    if (attempt && attempt.status !== 'in_progress') {
      access = 'completed'
      reason = 'You have already submitted this examination'
    } else if (attempt && attempt.status === 'in_progress') {
      access = lifecycle === 'completed' ? 'closed' : 'available'
      canEnter = lifecycle === 'ongoing'
      reason = canEnter ? 'Resume your attempt' : 'The examination window has closed'
    } else if (lifecycle === 'published') {
      access = 'upcoming'
      reason = 'This examination is not open yet'
    } else if (lifecycle === 'ongoing') {
      access = 'available'
      canEnter = true
      reason = 'You can start this examination'
    }

    return {
      ...publicExam(exam),
      access,
      canEnter,
      reason,
      attemptId: attempt?._id.toString() ?? null,
      attemptStatus: attempt?.status ?? null,
      resultsReady: Boolean(exam.resultsPublished && attempt && attempt.status !== 'in_progress' && !writtenAwaitingMark(attempt)),
    }
  })
}

export const previewPapers = async (user: SessionUser, examId: string) => {
  const exam = await loadOwnedExam(examId, user)
  const settings = asSettings(exam.settings)
  const pinnedIds = new Set(
    (await ExamQuestion.find({ examId, pinned: true })).map((row) => row.questionId.toString()),
  )
  const first = describePaper(await buildSnapshots(examId, settings), pinnedIds)
  const second = describePaper(await buildSnapshots(examId, settings), pinnedIds)
  return {
    budget: settings.difficultyBudget,
    tolerance: settings.tolerance,
    fairPaper: settings.fairPaper,
    papers: [first, second],
  }
}

export const createQuestion = async (
  user: SessionUser,
  input: {
    stem: string
    type: 'single' | 'multi' | 'written'
    category: string
    difficulty: 'easy' | 'medium' | 'hard'
    marks: number
    choices: { text: string }[]
    correctIndexes: number[]
  },
) => {
  const choices = input.type === 'written' ? [] : input.choices.map((choice) => ({ id: id(), text: choice.text.trim() }))
  if (input.type !== 'written' && choices.length < 2) {
    throw new HttpError(400, 'Objective questions need at least two choices')
  }
  if (input.type === 'single' && input.correctIndexes.length !== 1) {
    throw new HttpError(400, 'Single-answer questions need exactly one correct choice')
  }
  if (input.type === 'multi' && input.correctIndexes.length < 1) {
    throw new HttpError(400, 'Multiple-select questions need at least one correct choice')
  }
  const correctChoiceIds = input.correctIndexes.map((index) => {
    const choice = choices[index]
    if (!choice) throw new HttpError(400, 'A correct choice is out of range')
    return choice.id
  })
  const question = await Question.create({
    stem: input.stem,
    type: input.type,
    category: input.category,
    difficulty: input.difficulty,
    marks: input.marks,
    choices,
    correctChoiceIds,
    weight: DIFFICULTY_WEIGHT[input.difficulty],
    authorId: user.id,
  })
  return serializeQuestion(question)
}

export const updateQuestion = async (
  user: SessionUser,
  questionId: string,
  input: {
    stem?: string
    category?: string
    difficulty?: 'easy' | 'medium' | 'hard'
    marks?: number
    choices?: { text: string }[]
    correctIndexes?: number[]
  },
) => {
  if (user.role === 'candidate') throw new HttpError(403, 'You do not have permission to do that')
  const question = await Question.findById(questionId)
  if (!question) throw new HttpError(404, 'Question not found')
  const links = await ExamQuestion.find({ questionId }).select('examId')
  if (links.length > 0) {
    const started = await Exam.exists({
      _id: { $in: links.map((link) => link.examId) },
      publication: 'published',
      windowStart: { $lte: new Date() },
    })
    if (started) throw new HttpError(400, 'This question is locked because an examination using it has started')
  }
  if (input.stem !== undefined) question.stem = input.stem
  if (input.category !== undefined) question.category = input.category
  if (input.marks !== undefined) question.marks = input.marks
  if (input.difficulty !== undefined) {
    question.difficulty = input.difficulty
    question.weight = DIFFICULTY_WEIGHT[input.difficulty]
  }
  if (input.choices && question.type !== 'written') {
    const choices = input.choices.map((choice) => ({ id: id(), text: choice.text.trim() }))
    if (choices.length < 2) throw new HttpError(400, 'Objective questions need at least two choices')
    const indexes = input.correctIndexes ?? []
    if (question.type === 'single' && indexes.length !== 1) {
      throw new HttpError(400, 'Single-answer questions need exactly one correct choice')
    }
    if (question.type === 'multi' && indexes.length < 1) {
      throw new HttpError(400, 'Multiple-select questions need at least one correct choice')
    }
    question.set('choices', choices)
    question.correctChoiceIds = indexes.map((index) => {
      const choice = choices[index]
      if (!choice) throw new HttpError(400, 'A correct choice is out of range')
      return choice.id
    })
  }
  await question.save()
  return serializeQuestion(question)
}

export const deleteQuestion = async (user: SessionUser, questionId: string) => {
  if (user.role === 'candidate') throw new HttpError(403, 'You do not have permission to do that')
  const assigned = await ExamQuestion.exists({ questionId })
  if (assigned) throw new HttpError(400, 'Remove this question from examinations before deleting it')
  const result = await Question.deleteOne({ _id: questionId })
  if (result.deletedCount === 0) throw new HttpError(404, 'Question not found')
}

export const listQuestions = async (user: SessionUser) => {
  if (user.role === 'candidate') throw new HttpError(403, 'You do not have permission to do that')
  const questions = await Question.find().sort({ updatedAt: -1 })
  return questions.map(serializeQuestion)
}

export const getQuestion = async (user: SessionUser, questionId: string) => {
  if (user.role === 'candidate') throw new HttpError(403, 'You do not have permission to do that')
  const question = await Question.findById(questionId)
  if (!question) throw new HttpError(404, 'Question not found')
  return serializeQuestion(question)
}

const serializeQuestion = (question: {
  _id: { toString(): string }
  stem: string
  type: string
  choices: { id: string; text: string }[]
  correctChoiceIds: string[]
  marks: number
  category: string
  difficulty: string
  weight: number
}) => ({
  id: question._id.toString(),
  stem: question.stem,
  type: question.type,
  choices: question.choices,
  correctChoiceIds: question.correctChoiceIds,
  marks: question.marks,
  category: question.category,
  difficulty: question.difficulty,
  weight: question.weight,
})
