import { Attempt, Enrollment, Exam, Grade, ReportVerification, User } from '../models/index.js'
import { HttpError } from '../lib/http-error.js'
import type { SessionUser } from '../types/domain.js'
import { loadOwnedExam } from './access.js'
import { round2, writtenAwaitingMark } from './marking.js'

export const myResults = async (user: SessionUser) => {
  const attempts = await Attempt.find({
    candidateId: user.id,
    isSandbox: false,
    status: { $ne: 'in_progress' },
  }).sort({ submittedAt: -1 })
  const exams = await Exam.find({ _id: { $in: attempts.map((attempt) => attempt.examId) }, resultsPublished: true })
  const published = new Set(exams.map((exam) => exam._id.toString()))
  const codes = await ReportVerification.find({ attemptId: { $in: attempts.map((attempt) => attempt._id) } })
  const codeByAttempt = new Map(codes.map((row) => [row.attemptId.toString(), row.code]))

  return attempts
    .filter((attempt) => published.has(attempt.examId.toString()) && !writtenAwaitingMark(attempt))
    .map((attempt) => {
      const exam = exams.find((item) => item._id.toString() === attempt.examId.toString())
      return {
        attemptId: attempt.id,
        examId: attempt.examId.toString(),
        title: exam?.title ?? 'Examination',
        totalScore: attempt.totalScore,
        totalMarks: attempt.questionSnapshots.reduce((sum, item) => sum + item.marks, 0),
        submittedAt: attempt.submittedAt,
        verificationCode: codeByAttempt.get(attempt.id) ?? null,
      }
    })
}

export const resultDetail = async (user: SessionUser, attemptId: string) => {
  const attempt = await Attempt.findById(attemptId)
  if (!attempt || attempt.isSandbox) throw new HttpError(404, 'Result not found')
  const exam = await Exam.findById(attempt.examId)
  if (!exam) throw new HttpError(404, 'Result not found')

  const isOwner = user.role !== 'candidate' && (user.role === 'admin' || exam.examinerId.toString() === user.id)
  const isSelf = attempt.candidateId.toString() === user.id
  if (!isOwner && !isSelf) throw new HttpError(404, 'Result not found')
  if (isSelf && !exam.resultsPublished) throw new HttpError(403, 'Results have not been published')
  if (isSelf && writtenAwaitingMark(attempt)) {
    throw new HttpError(403, 'Your written answers have not been marked yet')
  }
  if (user.role === 'examiner' && exam.examinerId.toString() !== user.id) {
    throw new HttpError(403, 'You cannot access this examination')
  }

  const grades = await Grade.find({ attemptId })
  const verification = await ReportVerification.findOne({ attemptId })
  const candidate = await User.findById(attempt.candidateId)

  return {
    attemptId: attempt.id,
    examTitle: exam.title,
    candidateName: isOwner || isSelf ? candidate?.name : undefined,
    totalScore: attempt.totalScore,
    objectiveScore: attempt.objectiveScore,
    writtenScore: attempt.writtenScore,
    totalMarks: attempt.questionSnapshots.reduce((sum, item) => sum + item.marks, 0),
    submittedAt: attempt.submittedAt,
    teacherComment: attempt.teacherComment ?? '',
    verificationCode:
      exam.resultsPublished && !writtenAwaitingMark(attempt) ? (verification?.code ?? null) : null,
    questions: attempt.questionSnapshots.map((snapshot) => {
      const grade = grades.find((item) => item.questionId === snapshot.questionId)
      return {
        questionId: snapshot.questionId,
        stem: snapshot.stem,
        type: snapshot.type,
        marks: snapshot.marks,
        awarded: snapshot.type === 'written' ? (grade?.awardedMarks ?? null) : undefined,
        comment: grade?.comment ?? '',
      }
    }),
  }
}

export const examAnalytics = async (user: SessionUser, examId: string) => {
  const exam = await loadOwnedExam(examId, user)
  const enrollments = await Enrollment.countDocuments({ examId })
  const attempts = await Attempt.find({ examId, isSandbox: false, status: { $ne: 'in_progress' } })
  const scores = attempts.map((attempt) => attempt.totalScore)
  const mean = scores.length ? round2(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0
  const buckets = [
    { label: '0–39%', count: 0 },
    { label: '40–59%', count: 0 },
    { label: '60–79%', count: 0 },
    { label: '80–100%', count: 0 },
  ]
  for (const attempt of attempts) {
    const total = attempt.questionSnapshots.reduce((sum, item) => sum + item.marks, 0) || 1
    const ratio = attempt.totalScore / total
    const index = ratio < 0.4 ? 0 : ratio < 0.6 ? 1 : ratio < 0.8 ? 2 : 3
    const bucket = buckets[index]
    if (bucket) bucket.count += 1
  }
  const candidates = await User.find({ _id: { $in: attempts.map((attempt) => attempt.candidateId) } })
  const byId = new Map(candidates.map((candidate) => [candidate._id.toString(), candidate]))

  return {
    examId,
    title: exam.title,
    enrolled: enrollments,
    submitted: attempts.length,
    completion: enrollments ? round2(attempts.length / enrollments) : 0,
    mean,
    distribution: buckets,
    candidates: attempts.map((attempt) => ({
      attemptId: attempt.id,
      name: byId.get(attempt.candidateId.toString())?.name ?? 'Unknown',
      totalScore: attempt.totalScore,
      totalMarks: attempt.questionSnapshots.reduce((sum, item) => sum + item.marks, 0),
      status: attempt.status,
    })),
  }
}

export const questionAnalytics = async (user: SessionUser, examId: string) => {
  await loadOwnedExam(examId, user)
  const attempts = await Attempt.find({ examId, isSandbox: false, status: { $ne: 'in_progress' } })
  if (attempts.length === 0) {
    return { empty: true, notice: 'No finalized submissions yet.', questions: [] }
  }

  const { Answer } = await import('../models/index.js')
  const answers = await Answer.find({ attemptId: { $in: attempts.map((attempt) => attempt._id) } })
  const { Grade } = await import('../models/index.js')
  const grades = await Grade.find({ attemptId: { $in: attempts.map((attempt) => attempt._id) } })

  const grouped = new Map<
    string,
    { stem: string; type: string; presented: number; skipped: number; incorrect: number; awarded: number[]; marks: number }
  >()

  for (const attempt of attempts) {
    for (const snapshot of attempt.questionSnapshots) {
      const row = grouped.get(snapshot.questionId) ?? {
        stem: snapshot.stem,
        type: snapshot.type,
        presented: 0,
        skipped: 0,
        incorrect: 0,
        awarded: [],
        marks: snapshot.marks,
      }
      row.presented += 1
      const answer = answers.find(
        (item) => item.attemptId.toString() === attempt.id && item.questionId === snapshot.questionId,
      )
      const skipped =
        snapshot.type === 'written'
          ? !answer || answer.text.trim().length === 0
          : !answer || answer.choiceIds.length === 0
      if (skipped) row.skipped += 1
      else if (snapshot.type !== 'written') {
        const correct = new Set(snapshot.correctChoiceIds)
        const selected = answer?.choiceIds ?? []
        const exact =
          selected.length === correct.size && selected.every((choiceId) => correct.has(choiceId))
        if (!exact) row.incorrect += 1
      } else {
        const grade = grades.find(
          (item) => item.attemptId.toString() === attempt.id && item.questionId === snapshot.questionId,
        )
        if (grade) row.awarded.push(grade.awardedMarks)
      }
      grouped.set(snapshot.questionId, row)
    }
  }

  return {
    empty: false,
    notice: null,
    questions: [...grouped.entries()].map(([questionId, row]) => {
      const answered = row.presented - row.skipped
      return {
        questionId,
        stem: row.stem,
        type: row.type,
        presented: row.presented,
        skipped: row.skipped,
        incorrect: row.type === 'written' ? null : row.incorrect,
        empiricalDifficulty: row.type === 'written' || answered === 0 ? null : round2(row.incorrect / answered),
        averageAwarded:
          row.type === 'written' && row.awarded.length
            ? round2(row.awarded.reduce((sum, value) => sum + value, 0) / row.awarded.length)
            : null,
      }
    }),
  }
}
