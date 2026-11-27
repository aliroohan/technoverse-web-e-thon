export type Role = 'admin' | 'examiner' | 'candidate'

export type SessionUser = {
  id: string
  name: string
  email: string
  role: Role
}

export type ExamSettings = {
  randomizeQuestions: boolean
  randomizeChoices: boolean
  fairPaper: boolean
  questionCount: number | null
  difficultyBudget: number | null
  tolerance: number
}

export type ExamSummary = {
  id: string
  title: string
  instructions: string
  windowStart: string
  windowEnd: string
  durationMinutes: number
  totalMarks: number
  examinerId: string
  publication: 'draft' | 'published'
  resultsPublished: boolean
  lifecycle: 'draft' | 'published' | 'ongoing' | 'completed'
  settings: ExamSettings
}

export type Question = {
  id: string
  stem: string
  type: 'single' | 'multi' | 'written'
  choices: { id: string; text: string }[]
  correctChoiceIds: string[]
  marks: number
  category: string
  difficulty: 'easy' | 'medium' | 'hard'
  weight: number
}

export type CandidateExam = ExamSummary & {
  access: 'upcoming' | 'available' | 'completed' | 'closed'
  canEnter: boolean
  reason: string
  attemptId: string | null
  attemptStatus: string | null
  resultsReady: boolean
}

export type AttemptQuestion = {
  questionId: string
  order: number
  stem: string
  type: 'single' | 'multi' | 'written'
  choices: { id: string; text: string }[]
  marks: number
  category: string
  difficulty: string
  flaggedForReview: boolean
  answer: { choiceIds: string[]; text: string; savedAt: string | null; version: number }
}

export type AttemptView = {
  id: string
  examId: string
  examTitle: string
  instructions: string
  isSandbox: boolean
  status: 'in_progress' | 'submitted' | 'expired' | 'graded'
  gradingStatus: 'pending_subjective' | 'ready' | null
  startedAt: string
  deadlineAt: string
  submittedAt: string | null
  serverNow: string
  objectiveScore: number | null
  writtenScore: number | null
  totalScore: number | null
  totalMarks: number
  resultsPublished: boolean
  scratchpad: string
  announcements: { id: string; body: string; createdAt: string }[]
  questions: AttemptQuestion[]
}

export type Preferences = {
  fontScale: 'sm' | 'md' | 'lg'
  contrast: 'default' | 'high'
  navigator: 'side' | 'bottom'
}
