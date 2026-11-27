export const roles = ['admin', 'examiner', 'candidate'] as const
export type Role = (typeof roles)[number]

export const questionTypes = ['single', 'multi', 'written'] as const
export type QuestionType = (typeof questionTypes)[number]

export const difficulties = ['easy', 'medium', 'hard'] as const
export type Difficulty = (typeof difficulties)[number]

export const attemptStatuses = ['in_progress', 'submitted', 'expired', 'graded'] as const
export type AttemptStatus = (typeof attemptStatuses)[number]

export const gradingStatuses = ['pending_subjective', 'ready'] as const
export type GradingStatus = (typeof gradingStatuses)[number]

export const lifecycleStates = ['draft', 'published', 'ongoing', 'completed'] as const
export type LifecycleState = (typeof lifecycleStates)[number]

export type Choice = { id: string; text: string }

export type QuestionSnapshot = {
  questionId: string
  order: number
  stem: string
  type: QuestionType
  choices: Choice[]
  correctChoiceIds: string[]
  marks: number
  category: string
  difficulty: Difficulty
  weight: number
}

export type SessionUser = {
  id: string
  role: Role
  name: string
  email: string
}

export type ExamSettings = {
  randomizeQuestions: boolean
  randomizeChoices: boolean
  fairPaper: boolean
  questionCount: number | null
  difficultyBudget: number | null
  tolerance: number
}

export const DIFFICULTY_WEIGHT: Record<Difficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
}
