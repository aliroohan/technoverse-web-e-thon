import { Answer, Attempt, Enrollment, Exam, Grade, User } from '../models/index.js'
import { HttpError } from '../lib/http-error.js'
import type { Role, SessionUser } from '../types/domain.js'
import { hashPassword } from './auth.service.js'
import { lifecycleOf } from './lifecycle.js'

const publicUser = (user: { _id: { toString(): string }; name: string; email: string; role: Role; active: boolean }) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  active: user.active,
})

export const listUsers = async (role?: Role) => {
  const users = await User.find(role ? { role } : {}).sort({ name: 1 })
  return users.map(publicUser)
}

const CANDIDATE_PASSWORD = 'Candidate123!'

export const createCandidate = async (input: { name: string; email: string }) => {
  const user = await createUser({
    name: input.name,
    email: input.email,
    password: CANDIDATE_PASSWORD,
    role: 'candidate',
  })
  return { ...user, passwordNote: `New candidates can sign in with ${CANDIDATE_PASSWORD}` }
}

export const createUser = async (input: { name: string; email: string; password: string; role: Role }) => {
  const existing = await User.findOne({ email: input.email.toLowerCase() })
  if (existing) throw new HttpError(409, 'An account with that email already exists')
  const user = await User.create({
    name: input.name,
    email: input.email,
    passwordHash: await hashPassword(input.password),
    role: input.role,
    active: true,
  })
  return publicUser(user)
}

export const updateUser = async (
  actor: SessionUser,
  userId: string,
  input: { name?: string; role?: Role; active?: boolean; password?: string },
) => {
  const user = await User.findById(userId)
  if (!user) throw new HttpError(404, 'User not found')
  if (actor.id === userId && input.active === false) throw new HttpError(400, 'You cannot deactivate yourself')
  if (input.name !== undefined) user.name = input.name
  if (input.role !== undefined) user.role = input.role
  if (input.active !== undefined) user.active = input.active
  if (input.password) user.passwordHash = await hashPassword(input.password)
  await user.save()
  return publicUser(user)
}

export const listExaminerStudents = async (actor: SessionUser) => {
  const examFilter = actor.role === 'admin' ? {} : { examinerId: actor.id }
  const exams = await Exam.find(examFilter).select('_id')
  const examIds = exams.map((exam) => exam._id)

  const [candidates, enrollments, attempts] = await Promise.all([
    User.find({ role: 'candidate' }).sort({ name: 1 }),
    Enrollment.find({ examId: { $in: examIds } }).select('candidateId examId'),
    Attempt.find({ examId: { $in: examIds }, isSandbox: false }).select(
      'candidateId examId status gradingStatus startedAt submittedAt totalScore questionSnapshots',
    ),
  ])

  const enrolledByCandidate = new Map<string, Set<string>>()
  for (const row of enrollments) {
    const cid = row.candidateId.toString()
    const set = enrolledByCandidate.get(cid) ?? new Set<string>()
    set.add(row.examId.toString())
    enrolledByCandidate.set(cid, set)
  }

  const attemptsByCandidate = new Map<string, typeof attempts>()
  for (const attempt of attempts) {
    const cid = attempt.candidateId.toString()
    const list = attemptsByCandidate.get(cid) ?? []
    list.push(attempt)
    attemptsByCandidate.set(cid, list)
  }

  return candidates.map((candidate) => {
    const cid = candidate._id.toString()
    const mine = attemptsByCandidate.get(cid) ?? []
    const uncheckedCount = mine.filter(
      (a) => a.status !== 'in_progress' && a.gradingStatus === 'pending_subjective',
    ).length
    const latest = mine.reduce<Date | null>((acc, a) => {
      const when = a.submittedAt ?? a.startedAt
      return !acc || when > acc ? when : acc
    }, null)

    return {
      ...publicUser(candidate),
      enrolledCount: enrolledByCandidate.get(cid)?.size ?? 0,
      attendedCount: mine.length,
      uncheckedCount,
      latestActivityAt: latest,
    }
  })
}

export const getExaminerStudentDetail = async (actor: SessionUser, candidateId: string) => {
  const candidate = await User.findOne({ _id: candidateId, role: 'candidate' })
  if (!candidate) throw new HttpError(404, 'Student not found')

  const examFilter = actor.role === 'admin' ? {} : { examinerId: actor.id }
  const exams = await Exam.find(examFilter)
  const examById = new Map(exams.map((exam) => [exam._id.toString(), exam]))
  const examIds = exams.map((exam) => exam._id)

  const attempts = await Attempt.find({
    candidateId,
    examId: { $in: examIds },
    isSandbox: false,
  }).sort({ submittedAt: -1, startedAt: -1 })

  const attemptIds = attempts.map((a) => a._id)
  const [answers, grades] = await Promise.all([
    Answer.find({ attemptId: { $in: attemptIds } }),
    Grade.find({ attemptId: { $in: attemptIds } }),
  ])

  return {
    student: publicUser(candidate),
    papers: attempts.map((attempt) => {
      const exam = examById.get(attempt.examId.toString())
      const orderedQuestions = [...attempt.questionSnapshots].sort((a, b) => a.order - b.order)
      const attemptAnswers = answers.filter((a) => a.attemptId.toString() === attempt._id.toString())
      const attemptGrades = grades.filter((g) => g.attemptId.toString() === attempt._id.toString())
      const totalMarks = attempt.questionSnapshots.reduce((sum, item) => sum + item.marks, 0)
      const needsChecking = attempt.status !== 'in_progress' && attempt.gradingStatus === 'pending_subjective'

      return {
        attemptId: attempt._id.toString(),
        examId: attempt.examId.toString(),
        examTitle: exam?.title ?? 'Examination',
        lifecycle: exam ? lifecycleOf(exam.publication, exam.windowStart, exam.windowEnd) : 'completed',
        resultsPublished: exam?.resultsPublished ?? false,
        status: attempt.status,
        gradingStatus: attempt.gradingStatus ?? null,
        needsChecking,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        objectiveScore: attempt.objectiveScore,
        writtenScore: attempt.writtenScore,
        totalScore: attempt.totalScore,
        totalMarks,
        teacherComment: attempt.teacherComment ?? '',
        questions: orderedQuestions.map((snapshot) => {
          const answer = attemptAnswers.find((a) => a.questionId === snapshot.questionId)
          return {
            questionId: snapshot.questionId,
            order: snapshot.order,
            stem: snapshot.stem,
            type: snapshot.type,
            marks: snapshot.marks,
            choices: snapshot.choices,
            correctChoiceIds: snapshot.correctChoiceIds,
            answer: {
              choiceIds: answer?.choiceIds ?? [],
              text: answer?.text ?? '',
            },
          }
        }),
        grades: attemptGrades.map((grade) => ({
          questionId: grade.questionId,
          awardedMarks: grade.awardedMarks,
          comment: grade.comment,
        })),
      }
    }),
  }
}
