import { createHash, randomBytes } from 'node:crypto'
import { Answer, Attempt, Grade, ReportVerification, User } from '../models/index.js'
import { HttpError } from '../lib/http-error.js'
import type { SessionUser } from '../types/domain.js'
import { loadOwnedExam } from './access.js'
import { round2 } from './marking.js'

export const issueCode = async (attemptId: string) => {
  const existing = await ReportVerification.findOne({ attemptId })
  if (existing) return existing.code
  const code = randomBytes(4).toString('hex')
  await ReportVerification.create({
    attemptId,
    code,
    codeHash: createHash('sha256').update(code).digest('hex'),
    issuedAt: new Date(),
    revoked: false,
  })
  return code
}

export const recomputeWritten = async (attemptId: string) => {
  const attempt = await Attempt.findById(attemptId)
  if (!attempt) throw new HttpError(404, 'Attempt not found')
  const grades = await Grade.find({ attemptId })
  const written = attempt.questionSnapshots.filter((item) => item.type === 'written')
  const writtenScore = round2(grades.reduce((sum, grade) => sum + grade.awardedMarks, 0))
  const allGraded = written.every((item) => grades.some((grade) => grade.questionId === item.questionId))
  attempt.writtenScore = writtenScore
  attempt.totalScore = round2(attempt.objectiveScore + writtenScore)
  if (attempt.status !== 'in_progress') {
    attempt.gradingStatus = allGraded ? 'ready' : 'pending_subjective'
    if (allGraded && attempt.status !== 'expired') attempt.status = 'graded'
  }
  await attempt.save()
  return attempt
}

export const listGrading = async (user: SessionUser, examId: string) => {
  const exam = await loadOwnedExam(examId, user)
  const attempts = await Attempt.find({ examId, isSandbox: false, status: { $ne: 'in_progress' } }).sort({
    submittedAt: -1,
  })
  const candidates = await User.find({ _id: { $in: attempts.map((attempt) => attempt.candidateId) } })
  const byId = new Map(candidates.map((candidate) => [candidate._id.toString(), candidate]))
  const grades = await Grade.find({ attemptId: { $in: attempts.map((attempt) => attempt._id) } })
  const answers = await Answer.find({ attemptId: { $in: attempts.map((attempt) => attempt._id) } })

  return {
    examId,
    resultsPublished: exam.resultsPublished,
    attempts: attempts.map((attempt) => ({
      id: attempt._id.toString(),
      candidateId: attempt.candidateId.toString(),
      candidateName: byId.get(attempt.candidateId.toString())?.name ?? 'Unknown',
      candidateEmail: byId.get(attempt.candidateId.toString())?.email ?? '',
      status: attempt.status,
      gradingStatus: attempt.gradingStatus,
      objectiveScore: attempt.objectiveScore,
      writtenScore: attempt.writtenScore,
      totalScore: attempt.totalScore,
      totalMarks: attempt.questionSnapshots.reduce((sum, item) => sum + item.marks, 0),
      submittedAt: attempt.submittedAt,
      questions: attempt.questionSnapshots.map((snapshot) => ({
        questionId: snapshot.questionId,
        stem: snapshot.stem,
        type: snapshot.type,
        marks: snapshot.marks,
        correctChoiceIds: snapshot.correctChoiceIds,
        choices: snapshot.choices,
        answer: answers.find(
          (answer) =>
            answer.attemptId.toString() === attempt._id.toString() && answer.questionId === snapshot.questionId,
        ) ?? { choiceIds: [], text: '' },
      })),
      grades: grades
        .filter((grade) => grade.attemptId.toString() === attempt._id.toString())
        .map((grade) => ({
          questionId: grade.questionId,
          awardedMarks: grade.awardedMarks,
          comment: grade.comment,
        })),
    })),
  }
}

export const gradeWritten = async (
  user: SessionUser,
  attemptId: string,
  questionId: string,
  awardedMarks: number,
  comment: string,
) => {
  const attempt = await Attempt.findById(attemptId)
  if (!attempt || attempt.isSandbox) throw new HttpError(404, 'Attempt not found')
  await loadOwnedExam(attempt.examId.toString(), user)
  if (attempt.status === 'in_progress') throw new HttpError(400, 'This attempt is still in progress')
  const snapshot = attempt.questionSnapshots.find((item) => item.questionId === questionId)
  if (!snapshot || snapshot.type !== 'written') throw new HttpError(400, 'That question is not a written response')
  if (awardedMarks < 0 || awardedMarks > snapshot.marks) {
    throw new HttpError(400, `Marks must be between 0 and ${snapshot.marks}`)
  }
  await Grade.findOneAndUpdate(
    { attemptId, questionId },
    { $set: { awardedMarks, comment, graderId: user.id } },
    { upsert: true },
  )
  await recomputeWritten(attemptId)
  return listGrading(user, attempt.examId.toString())
}

export const publishResults = async (user: SessionUser, examId: string) => {
  const exam = await loadOwnedExam(examId, user)
  const attempts = await Attempt.find({ examId, isSandbox: false, status: { $ne: 'in_progress' } })
  const pending = attempts.filter((attempt) => attempt.gradingStatus !== 'ready')
  if (pending.length > 0) {
    throw new HttpError(400, 'Grade every written response before publishing results')
  }
  const codes: { attemptId: string; code: string }[] = []
  for (const attempt of attempts) {
    const code = await issueCode(attempt.id)
    codes.push({ attemptId: attempt.id, code })
  }
  exam.resultsPublished = true
  await exam.save()
  return { resultsPublished: true, issued: codes }
}

export const rememberCode = async (attemptId: string, code: string) => {
  const codeHash = createHash('sha256').update(code).digest('hex')
  await ReportVerification.findOneAndUpdate(
    { attemptId },
    { $setOnInsert: { attemptId, codeHash, issuedAt: new Date(), revoked: false } },
    { upsert: true },
  )
}
