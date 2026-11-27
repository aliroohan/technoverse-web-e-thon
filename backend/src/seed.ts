import {
  Announcement,
  Answer,
  Attempt,
  Enrollment,
  Exam,
  ExamQuestion,
  Grade,
  Incident,
  Question,
  ReportVerification,
  Scratchpad,
  User,
  WorkspacePreference,
} from './models/index.js'
import { connectMongo } from './db/mongoose.js'
import { hashPassword } from './services/auth.service.js'
import { saveAnswer, startCandidateAttempt, submitAttempt } from './services/attempt.service.js'
import {
  assignQuestion,
  createExam,
  createQuestion,
  enrollCandidate,
  publishExam,
} from './services/exam.service.js'
import { gradeWritten, publishResults } from './services/grading.service.js'
import type { SessionUser } from './types/domain.js'
import { logger } from './utils/logger.js'

const password = {
  admin: 'Admin123!',
  examiner: 'Examiner123!',
  candidate: 'Candidate123!',
}

const main = async () => {
  await connectMongo()
  await Promise.all([
    User.deleteMany({}),
    Question.deleteMany({}),
    Exam.deleteMany({}),
    ExamQuestion.deleteMany({}),
    Enrollment.deleteMany({}),
    Attempt.deleteMany({}),
    Answer.deleteMany({}),
    Grade.deleteMany({}),
    Incident.deleteMany({}),
    Announcement.deleteMany({}),
    Scratchpad.deleteMany({}),
    ReportVerification.deleteMany({}),
    WorkspacePreference.deleteMany({}),
  ])

  const admin = await User.create({
    name: 'Amina Shah',
    email: 'admin@holdfast.test',
    passwordHash: await hashPassword(password.admin),
    role: 'admin',
    active: true,
  })
  const examiner = await User.create({
    name: 'Omar Rahman',
    email: 'examiner@holdfast.test',
    passwordHash: await hashPassword(password.examiner),
    role: 'examiner',
    active: true,
  })
  const hana = await User.create({
    name: 'Hana Iqbal',
    email: 'hana@holdfast.test',
    passwordHash: await hashPassword(password.candidate),
    role: 'candidate',
    active: true,
  })
  const bilal = await User.create({
    name: 'Bilal Khan',
    email: 'bilal@holdfast.test',
    passwordHash: await hashPassword(password.candidate),
    role: 'candidate',
    active: true,
  })

  const omar: SessionUser = {
    id: examiner.id,
    name: examiner.name,
    email: examiner.email,
    role: 'examiner',
  }
  const bilalSession: SessionUser = {
    id: bilal.id,
    name: bilal.name,
    email: bilal.email,
    role: 'candidate',
  }

  const bank = [
    question('Which traversal visits a graph level by level?', 'single', 'graphs', 'easy', ['DFS', 'BFS', 'Dijkstra', 'Prim'], [1]),
    question('A stack is last-in, first-out.', 'single', 'complexity', 'easy', ['True', 'False'], [0]),
    question('Stable sorting algorithms include:', 'multi', 'sorting', 'easy', ['Merge sort', 'Quick sort', 'Insertion sort', 'Heap sort'], [0, 2]),
    question('Dijkstra requires non-negative edge weights.', 'single', 'graphs', 'medium', ['True', 'False'], [0]),
    question('Average time of quicksort is:', 'single', 'sorting', 'medium', ['O(n)', 'O(n log n)', 'O(n^2)', 'O(log n)'], [1]),
    question('Which statements about big-O are true?', 'multi', 'complexity', 'medium', ['It is an upper bound', 'It is a lower bound', 'Constants are dropped', 'It describes exact time'], [0, 2]),
    question('A bipartite graph can contain an odd cycle.', 'single', 'graphs', 'hard', ['True', 'False'], [1]),
    question('Worst-case comparison sorts need:', 'single', 'sorting', 'hard', ['O(n)', 'Omega(n log n)', 'O(log n)', 'O(1)'], [1]),
    question('Which problems are NP-complete?', 'multi', 'complexity', 'hard', ['SAT', 'Sorting', 'Hamiltonian cycle', 'Finding the minimum in an array'], [0, 2]),
    question('Explain how a hash table can resolve collisions, and name one trade-off of your approach.', 'written', 'complexity', 'medium', [], []),
  ]

  const created = []
  for (const item of bank) {
    created.push(await createQuestion(omar, item))
  }

  const now = Date.now()
  const exam = await createExam(omar, {
    title: 'Intro to Algorithms — Midterm',
    instructions:
      'Answer every question. The clock is the server clock and does not pause if your connection drops. Your scratchpad is not graded.',
    windowStart: new Date(now - 60 * 60 * 1000),
    windowEnd: new Date(now + 4 * 60 * 60 * 1000),
    durationMinutes: 30,
    totalMarks: 20,
    settings: {
      randomizeQuestions: true,
      randomizeChoices: true,
      fairPaper: true,
      questionCount: 6,
      difficultyBudget: 10,
      tolerance: 2,
    },
  })

  for (const item of created) {
    await assignQuestion(omar, exam.id, {
      questionId: item.id,
      marks: item.type === 'written' ? 10 : 2,
      pinned: item.type === 'written',
    })
  }

  await publishExam(omar, exam.id)
  await enrollCandidate(omar, exam.id, bilal.id)

  const attempt = await startCandidateAttempt(bilalSession, exam.id)
  for (const item of attempt.questions) {
    const source = created.find((question) => question.id === item.questionId)
    if (!source) continue
    if (item.type === 'written') {
      await saveAnswer(bilalSession, attempt.id, {
        questionId: item.questionId,
        text: 'Separate chaining stores collisions in a list at each bucket. The trade-off is extra memory and pointer chasing, against simpler deletion.',
      })
    } else {
      await saveAnswer(bilalSession, attempt.id, {
        questionId: item.questionId,
        choiceIds: source.correctChoiceIds,
      })
    }
  }
  await submitAttempt(bilalSession, attempt.id)
  const written = attempt.questions.find((item) => item.type === 'written')
  if (written) {
    await gradeWritten(omar, attempt.id, written.questionId, 8, 'Clear trade-off and a named method.')
  }
  const published = await publishResults(omar, exam.id)
  await enrollCandidate(omar, exam.id, hana.id)

  logger.info('Seed complete', {
    admin: admin.email,
    examiner: examiner.email,
    hana: hana.email,
    bilal: bilal.email,
    examId: exam.id,
    bilalAttempt: attempt.id,
    verification: published.issued,
  })
  process.exit(0)
}

const question = (
  stem: string,
  type: 'single' | 'multi' | 'written',
  category: string,
  difficulty: 'easy' | 'medium' | 'hard',
  choices: string[],
  correctIndexes: number[],
) => ({
  stem,
  type,
  category,
  difficulty,
  marks: type === 'written' ? 10 : 2,
  choices: choices.map((text) => ({ text })),
  correctIndexes,
})

void main().catch((error: unknown) => {
  logger.error('Seed failed', { message: error instanceof Error ? error.message : 'unknown' })
  process.exit(1)
})
