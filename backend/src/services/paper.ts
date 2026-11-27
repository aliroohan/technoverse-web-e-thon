import { randomBytes } from 'node:crypto'
import { ExamQuestion, Question } from '../models/index.js'
import { HttpError } from '../lib/http-error.js'
import type { ExamSettings, QuestionSnapshot } from '../types/domain.js'
import { selectPaper, paperWeight, type PaperItem } from './fair-paper.js'

const shuffle = <T>(items: T[]) => {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomBytes(1)[0]! % (i + 1)
    const current = copy[i]
    copy[i] = copy[j] as T
    copy[j] = current as T
  }
  return copy
}

export const loadAssignment = async (examId: string) => {
  const links = await ExamQuestion.find({ examId }).sort({ order: 1 })
  const questions = await Question.find({ _id: { $in: links.map((link) => link.questionId) } })
  const byId = new Map(questions.map((question) => [question._id.toString(), question]))
  return { links, byId }
}

export const buildSnapshots = async (examId: string, settings: ExamSettings): Promise<QuestionSnapshot[]> => {
  const { links, byId } = await loadAssignment(examId)
  if (links.length === 0) throw new HttpError(400, 'This examination has no questions')

  const items: PaperItem[] = links.map((link) => {
    const question = byId.get(link.questionId.toString())
    if (!question) throw new HttpError(400, 'A question on this examination is missing')
    return {
      questionId: question._id.toString(),
      category: question.category,
      weight: question.weight,
      pinned: link.pinned,
      order: link.order,
    }
  })

  const selected = selectPaper(items, {
    fairPaper: settings.fairPaper,
    questionCount: settings.questionCount,
    difficultyBudget: settings.difficultyBudget,
    tolerance: settings.tolerance,
    randomizeQuestions: settings.randomizeQuestions,
  })

  return selected.map((item) => {
    const question = byId.get(item.questionId)
    const link = links.find((row) => row.questionId.toString() === item.questionId)
    if (!question || !link) throw new HttpError(400, 'A question on this examination is missing')
    const choices = question.choices.map((choice) => ({ id: choice.id, text: choice.text }))
    return {
      questionId: item.questionId,
      order: item.order,
      stem: question.stem,
      type: question.type as QuestionSnapshot['type'],
      choices: settings.randomizeChoices ? shuffle(choices) : choices,
      correctChoiceIds: [...question.correctChoiceIds],
      marks: link.marks,
      category: question.category,
      difficulty: question.difficulty as QuestionSnapshot['difficulty'],
      weight: question.weight,
    }
  })
}

export const describePaper = (snapshots: QuestionSnapshot[], pinnedIds: Set<string> = new Set()) => ({
  weight: paperWeight(
    snapshots.map((item) => ({
      questionId: item.questionId,
      category: item.category,
      weight: item.weight,
      pinned: pinnedIds.has(item.questionId),
      order: item.order,
    })),
  ),
  sampledWeight: paperWeight(
    snapshots
      .filter((item) => !pinnedIds.has(item.questionId))
      .map((item) => ({
        questionId: item.questionId,
        category: item.category,
        weight: item.weight,
        pinned: false,
        order: item.order,
      })),
  ),
  questions: snapshots.map((item) => ({
    questionId: item.questionId,
    order: item.order,
    stem: item.stem,
    category: item.category,
    difficulty: item.difficulty,
    weight: item.weight,
    marks: item.marks,
    type: item.type,
    pinned: false,
  })),
})
