import { createHash, randomBytes } from 'node:crypto'
import { Answer, Attempt, Enrollment, Grade, ReportVerification, User } from '../models/index.js'
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

const resultsReleaseBlock = async (examId: string, publication: string) => {
  if (publication !== 'published') return 'Publish the examination before releasing results'
  const [attempts, enrollments] = await Promise.all([
    Attempt.find({ examId, isSandbox: false }),
    Enrollment.find({ examId }),
  ])
  if (enrollments.length === 0) return 'Release results after every enrolled candidate has finished'
  const byCandidate = new Map(attempts.map((attempt) => [attempt.candidateId.toString(), attempt]))
  const unsolved = enrollments.some((row) => {
    const attempt = byCandidate.get(row.candidateId.toString())
    return !attempt || attempt.status === 'in_progress'
  })
  if (unsolved || attempts.some((attempt) => attempt.status === 'in_progress')) {
    return 'Release results after every enrolled candidate has finished'
  }
  if (attempts.some((attempt) => attempt.gradingStatus !== 'ready')) {
    return 'Grade every written response before publishing results'
  }
  return null
}

export const listGrading = async (user: SessionUser, examId: string) => {
  const exam = await loadOwnedExam(examId, user)
  const publishBlockReason = await resultsReleaseBlock(examId, exam.publication)
  const attempts = await Attempt.find({ examId, isSandbox: false, status: { $ne: 'in_progress' } }).sort({
    submittedAt: -1,
  })
  const candidates = await User.find({ _id: { $in: attempts.map((attempt) => attempt.candidateId) } })
  const byId = new Map(candidates.map((candidate) => [candidate._id.toString(), candidate]))
  const grades = await Grade.find({ attemptId: { $in: attempts.map((attempt) => attempt._id) } })
  const answers = await Answer.find({ attemptId: { $in: attempts.map((attempt) => attempt._id) } })
  const verifications = await ReportVerification.find({ attemptId: { $in: attempts.map((attempt) => attempt._id) } })
  const codeByAttempt = new Map(verifications.map((row) => [row.attemptId.toString(), row.code]))

  return {
    examId,
    resultsPublished: exam.resultsPublished,
    canPublishResults: publishBlockReason === null && !exam.resultsPublished,
    publishBlockReason,
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
      verificationCode: exam.resultsPublished ? (codeByAttempt.get(attempt._id.toString()) ?? null) : null,
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
  const exam = await loadOwnedExam(attempt.examId.toString(), user)
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
  const updated = await recomputeWritten(attemptId)
  if (exam.resultsPublished && updated.gradingStatus === 'ready') await issueCode(attemptId)
  return listGrading(user, attempt.examId.toString())
}

export const publishResults = async (user: SessionUser, examId: string) => {
  const exam = await loadOwnedExam(examId, user)
  const blocked = await resultsReleaseBlock(examId, exam.publication)
  if (blocked) throw new HttpError(400, blocked)
  const attempts = await Attempt.find({ examId, isSandbox: false, status: { $ne: 'in_progress' } })
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
