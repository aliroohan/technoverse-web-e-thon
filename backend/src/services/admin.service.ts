import {
  Attempt,
  Enrollment,
  Exam,
  ExamQuestion,
  Grade,
  Incident,
  Question,
  ReportVerification,
  User,
} from '../models/index.js'
import { HttpError } from '../lib/http-error.js'
import type { SessionUser } from '../types/domain.js'
import { publicExam } from './exam.service.js'
import { publishResults, recomputeWritten } from './grading.service.js'
import { round2 } from './marking.js'

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const listAdminPapers = async (input: {
  page: number
  limit: number
  search?: string
  examId?: string
  examinerId?: string
}) => {
  const page = Math.max(1, input.page)
  const limit = Math.min(50, Math.max(1, input.limit))
  const search = input.search?.trim() ?? ''

  const allExams = await Exam.find({}).sort({ updatedAt: -1 })
  const allExaminerIds = [...new Set(allExams.map((exam) => exam.examinerId.toString()))]
  const allExaminers = await User.find({ _id: { $in: allExaminerIds } }).sort({ name: 1 })
  const allExaminerById = new Map(allExaminers.map((u) => [u._id.toString(), u]))

  const filtered = allExams.filter((exam) => {
    if (input.examId && exam._id.toString() !== input.examId) return false
    if (input.examinerId && exam.examinerId.toString() !== input.examinerId) return false
    if (search) {
      const term = search.toLowerCase()
      const examinerName = allExaminerById.get(exam.examinerId.toString())?.name.toLowerCase() ?? ''
      if (!exam.title.toLowerCase().includes(term) && !examinerName.includes(term)) return false
    }
    return true
  })

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const safePage = Math.min(page, totalPages)
  const exams = filtered.slice((safePage - 1) * limit, safePage * limit)

  const examIds = exams.map((exam) => exam._id)

  const [questionCounts, enrollmentCounts, attemptCounts] = await Promise.all([
    ExamQuestion.aggregate<{ _id: { toString(): string }; count: number }>([
      { $match: { examId: { $in: examIds } } },
      { $group: { _id: '$examId', count: { $sum: 1 } } },
    ]),
    Enrollment.aggregate<{ _id: { toString(): string }; count: number }>([
      { $match: { examId: { $in: examIds } } },
      { $group: { _id: '$examId', count: { $sum: 1 } } },
    ]),
    Attempt.aggregate<{ _id: { toString(): string }; count: number }>([
      { $match: { examId: { $in: examIds }, isSandbox: false } },
      { $group: { _id: '$examId', count: { $sum: 1 } } },
    ]),
  ])

  const qCountByExam = new Map(questionCounts.map((r) => [r._id.toString(), r.count]))
  const enrCountByExam = new Map(enrollmentCounts.map((r) => [r._id.toString(), r.count]))
  const subCountByExam = new Map(attemptCounts.map((r) => [r._id.toString(), r.count]))

  return {
    items: exams.map((exam) => {
      const examiner = allExaminerById.get(exam.examinerId.toString())
      const id = exam._id.toString()
      return {
        ...publicExam(exam),
        examinerName: examiner?.name ?? 'Unknown',
        examinerEmail: examiner?.email ?? '',
        questionCount: qCountByExam.get(id) ?? 0,
        enrolledCount: enrCountByExam.get(id) ?? 0,
        submittedCount: subCountByExam.get(id) ?? 0,
      }
    }),
    filters: {
      papers: allExams.map((exam) => ({ id: exam._id.toString(), title: exam.title })),
      examiners: allExaminers.map((u) => ({ id: u._id.toString(), name: u.name })),
    },
    page: safePage,
    limit,
    total,
    totalPages,
  }
}

export const getAdminPaperDetail = async (
  examId: string,
  input: { page: number; limit: number; search?: string },
) => {
  const exam = await Exam.findById(examId)
  if (!exam) throw new HttpError(404, 'Examination not found')

  const [examiner, links, attempts] = await Promise.all([
    User.findById(exam.examinerId),
    ExamQuestion.find({ examId }).sort({ order: 1 }),
    Attempt.find({ examId, isSandbox: false }).sort({ submittedAt: -1, startedAt: -1 }),
  ])

  const questions = await Question.find({ _id: { $in: links.map((link) => link.questionId) } })
  const questionById = new Map(questions.map((q) => [q._id.toString(), q]))

  const candidateIds = [...new Set(attempts.map((row) => row.candidateId.toString()))]
  const candidates = await User.find({ _id: { $in: candidateIds } })
  const candidateById = new Map(candidates.map((u) => [u._id.toString(), u]))

  const attemptIds = attempts.map((a) => a._id)
  const [grades, verifications] = await Promise.all([
    Grade.find({ attemptId: { $in: attemptIds } }),
    ReportVerification.find({ attemptId: { $in: attemptIds } }),
  ])

  const graderIds = [...new Set(grades.map((g) => g.graderId.toString()))]
  const graders = await User.find({ _id: { $in: graderIds } })
  const graderById = new Map(graders.map((u) => [u._id.toString(), u]))

  const verificationByAttempt = new Map(verifications.map((v) => [v.attemptId.toString(), v]))

  const allStudents = attempts.map((attempt) => {
    const candidateId = attempt.candidateId.toString()
    const student = candidateById.get(candidateId)
    const attemptGrades = grades.filter((g) => g.attemptId.toString() === attempt._id.toString())
    const orderedSnapshots = [...attempt.questionSnapshots].sort((a, b) => a.order - b.order)
    const writtenQuestions = orderedSnapshots
      .filter((s) => s.type === 'written')
      .map((s) => {
        const grade = attemptGrades.find((g) => g.questionId === s.questionId)
        return {
          questionId: s.questionId,
          order: s.order,
          stem: s.stem,
          marks: s.marks,
          awardedMarks: grade ? grade.awardedMarks : null,
          comment: grade?.comment ?? '',
          graderName: grade ? (graderById.get(grade.graderId.toString())?.name ?? 'Examiner') : null,
        }
      })

    const questionComments = attemptGrades
      .filter((g) => g.comment.trim().length > 0)
      .map((g) => {
        const snap = orderedSnapshots.find((s) => s.questionId === g.questionId)
        return {
          questionId: g.questionId,
          order: snap?.order ?? 0,
          stem: snap?.stem ?? 'Question',
          awardedMarks: g.awardedMarks,
          maxMarks: snap?.marks ?? 0,
          comment: g.comment,
          graderName: graderById.get(g.graderId.toString())?.name ?? 'Examiner',
        }
      })
      .sort((a, b) => a.order - b.order)

    const ver = verificationByAttempt.get(attempt._id.toString())
    const maxMarks = attempt.questionSnapshots.reduce((sum, item) => sum + item.marks, 0)

    return {
      attemptId: attempt._id.toString(),
      candidateId,
      candidateName: student?.name ?? 'Unknown',
      candidateEmail: student?.email ?? '',
      status: attempt.status,
      gradingStatus: attempt.gradingStatus ?? null,
      objectiveScore: attempt.objectiveScore,
      writtenScore: attempt.writtenScore,
      totalScore: attempt.totalScore,
      totalMarks: maxMarks,
      submittedAt: attempt.submittedAt,
      teacherComment: attempt.teacherComment ?? '',
      writtenQuestions,
      questionComments,
      verification: ver ? { code: ver.code, revoked: ver.revoked, issuedAt: ver.issuedAt } : null,
    }
  })

  const term = input.search?.trim().toLowerCase() ?? ''
  const filteredStudents = term
    ? allStudents.filter(
        (s) => s.candidateName.toLowerCase().includes(term) || s.candidateEmail.toLowerCase().includes(term),
      )
    : allStudents

  const page = Math.max(1, input.page)
  const limit = Math.min(50, Math.max(1, input.limit))
  const total = filteredStudents.length
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const safePage = Math.min(page, totalPages)
  const pagedStudents = filteredStudents.slice((safePage - 1) * limit, safePage * limit)

  return {
    exam: {
      ...publicExam(exam),
      examinerName: examiner?.name ?? 'Unknown',
      examinerEmail: examiner?.email ?? '',
    },
    questions: links.map((link) => {
      const q = questionById.get(link.questionId.toString())
      return {
        id: link._id.toString(),
        questionId: link.questionId.toString(),
        stem: q?.stem ?? 'Missing question',
        type: q?.type ?? 'written',
        category: q?.category ?? '',
        difficulty: q?.difficulty ?? 'medium',
        choices: q?.choices ?? [],
        correctChoiceIds: q?.correctChoiceIds ?? [],
        marks: link.marks,
        pinned: link.pinned,
        order: link.order,
      }
    }),
    students: {
      items: pagedStudents,
      page: safePage,
      limit,
      total,
      totalPages,
    },
  }
}

export const updateAdminAttemptResult = async (
  actor: SessionUser,
  attemptId: string,
  input: {
    teacherComment?: string
    objectiveScore?: number
    writtenGrades?: { questionId: string; awardedMarks: number; comment: string }[]
  },
) => {
  const attempt = await Attempt.findById(attemptId)
  if (!attempt || attempt.isSandbox) throw new HttpError(404, 'Attempt not found')
  if (attempt.status === 'in_progress') {
    throw new HttpError(400, 'Cannot manage results while attempt is still in progress')
  }

  if (input.writtenGrades) {
    for (const item of input.writtenGrades) {
      const snapshot = attempt.questionSnapshots.find((s) => s.questionId === item.questionId)
      if (!snapshot || snapshot.type !== 'written') {
        throw new HttpError(400, 'Grades can only be assigned to written questions')
      }
      if (item.awardedMarks < 0 || item.awardedMarks > snapshot.marks) {
        throw new HttpError(400, `Marks must be between 0 and ${snapshot.marks}`)
      }
      await Grade.findOneAndUpdate(
        { attemptId, questionId: item.questionId },
        { $set: { awardedMarks: item.awardedMarks, comment: item.comment, graderId: actor.id } },
        { upsert: true },
      )
    }
  }

  if (input.objectiveScore !== undefined) {
    const maxObjective = attempt.questionSnapshots
      .filter((s) => s.type !== 'written')
      .reduce((sum, s) => sum + s.marks, 0)
    if (input.objectiveScore < 0 || input.objectiveScore > maxObjective) {
      throw new HttpError(400, `Objective score must be between 0 and ${maxObjective}`)
    }
    attempt.objectiveScore = round2(input.objectiveScore)
  }

  if (input.teacherComment !== undefined) {
    attempt.teacherComment = input.teacherComment.trim()
  }

  await attempt.save()
  const updated = await recomputeWritten(attemptId)
  return {
    attemptId: updated.id,
    objectiveScore: updated.objectiveScore,
    writtenScore: updated.writtenScore,
    totalScore: updated.totalScore,
    status: updated.status,
    gradingStatus: updated.gradingStatus,
    teacherComment: updated.teacherComment ?? '',
  }
}

export const setExamResultsPublication = async (actor: SessionUser, examId: string, published: boolean) => {
  if (published) {
    return publishResults(actor, examId)
  }
  const exam = await Exam.findById(examId)
  if (!exam) throw new HttpError(404, 'Examination not found')
  exam.resultsPublished = false
  await exam.save()
  return { resultsPublished: false, issued: [] }
}

export const setVerificationRevoked = async (attemptId: string, revoked: boolean) => {
  const row = await ReportVerification.findOne({ attemptId })
  if (!row) throw new HttpError(404, 'No verification code has been issued for this attempt')
  row.revoked = revoked
  await row.save()
  return { attemptId, code: row.code, revoked: row.revoked }
}

export const listStudentLogs = async (input: {
  page: number
  limit: number
  candidateId?: string
  examId?: string
  incidentType?: string
  search?: string
}) => {
  const page = Math.max(1, input.page)
  const limit = Math.min(50, Math.max(1, input.limit))
  const search = input.search?.trim().toLowerCase() ?? ''

  let candidateIdsFilter: string[] | null = null
  let examIdsFilter: string[] | null = null

  if (input.candidateId) candidateIdsFilter = [input.candidateId]
  if (input.examId) examIdsFilter = [input.examId]

  if (search) {
    const regex = { $regex: escapeRegex(search), $options: 'i' }
    const [matchedUsers, matchedExams] = await Promise.all([
      User.find({ $or: [{ name: regex }, { email: regex }] }).select('_id'),
      Exam.find({ title: regex }).select('_id'),
    ])
    const matchedUserIds = matchedUsers.map((u) => u._id.toString())
    const matchedExamIds = matchedExams.map((e) => e._id.toString())

    // Match attempts/incidents where EITHER student matches OR exam matches
    const attemptOr: Record<string, unknown>[] = []
    if (matchedUserIds.length > 0) attemptOr.push({ candidateId: { $in: matchedUserIds } })
    if (matchedExamIds.length > 0) attemptOr.push({ examId: { $in: matchedExamIds } })

    if (attemptOr.length === 0) {
      return {
        notice: 'These signals are for review. They are not a finding of misconduct.',
        attempts: { items: [], page: 1, limit, total: 0, totalPages: 1 },
        incidents: { items: [], page: 1, limit, total: 0, totalPages: 1 },
      }
    }
  }

  const attemptFilter: Record<string, unknown> = { isSandbox: false }
  if (candidateIdsFilter) attemptFilter.candidateId = { $in: candidateIdsFilter }
  if (examIdsFilter) attemptFilter.examId = { $in: examIdsFilter }

  const allMatchingAttempts = await Attempt.find(attemptFilter).sort({ startedAt: -1 })
  const allAttemptUsers = await User.find({
    _id: { $in: [...new Set(allMatchingAttempts.map((a) => a.candidateId.toString()))] },
  })
  const allAttemptExams = await Exam.find({
    _id: { $in: [...new Set(allMatchingAttempts.map((a) => a.examId.toString()))] },
  })
  const userById = new Map(allAttemptUsers.map((u) => [u._id.toString(), u]))
  const examById = new Map(allAttemptExams.map((e) => [e._id.toString(), e]))

  const searchedAttempts = search
    ? allMatchingAttempts.filter((attempt) => {
        const student = userById.get(attempt.candidateId.toString())
        const exam = examById.get(attempt.examId.toString())
        return (
          (student?.name.toLowerCase().includes(search) ?? false) ||
          (student?.email.toLowerCase().includes(search) ?? false) ||
          (exam?.title.toLowerCase().includes(search) ?? false)
        )
      })
    : allMatchingAttempts

  const attemptTotal = searchedAttempts.length
  const attemptTotalPages = Math.max(1, Math.ceil(attemptTotal / limit))
  const attemptPage = Math.min(page, attemptTotalPages)
  const pagedAttempts = searchedAttempts.slice((attemptPage - 1) * limit, attemptPage * limit)

  const pagedAttemptIds = pagedAttempts.map((a) => a._id)
  const incidentCounts = await Incident.aggregate<{ _id: { toString(): string }; count: number }>([
    { $match: { attemptId: { $in: pagedAttemptIds } } },
    { $group: { _id: '$attemptId', count: { $sum: 1 } } },
  ])
  const countByAttempt = new Map(incidentCounts.map((r) => [r._id.toString(), r.count]))

  // Incidents filtered by matching attempts & optional incidentType
  const allowedAttemptIds = searchedAttempts.map((a) => a._id)
  const incidentFilter: Record<string, unknown> = { attemptId: { $in: allowedAttemptIds } }
  if (input.incidentType) incidentFilter.type = input.incidentType

  const incidentTotal = await Incident.countDocuments(incidentFilter)
  const incidentTotalPages = Math.max(1, Math.ceil(incidentTotal / limit))
  const incidentPage = Math.min(page, incidentTotalPages)
  const pagedIncidents = await Incident.find(incidentFilter)
    .sort({ at: -1 })
    .skip((incidentPage - 1) * limit)
    .limit(limit)

  const attemptById = new Map(searchedAttempts.map((a) => [a._id.toString(), a]))

  return {
    notice: 'These signals are for review. They are not a finding of misconduct.',
    attempts: {
      items: pagedAttempts.map((attempt) => {
        const student = userById.get(attempt.candidateId.toString())
        const exam = examById.get(attempt.examId.toString())
        return {
          attemptId: attempt._id.toString(),
          examId: attempt.examId.toString(),
          examTitle: exam?.title ?? 'Examination',
          candidateId: attempt.candidateId.toString(),
          candidateName: student?.name ?? 'Unknown',
          candidateEmail: student?.email ?? '',
          status: attempt.status,
          gradingStatus: attempt.gradingStatus ?? null,
          startedAt: attempt.startedAt,
          deadlineAt: attempt.deadlineAt,
          submittedAt: attempt.submittedAt,
          totalScore: attempt.totalScore,
          totalMarks: attempt.questionSnapshots.reduce((sum, s) => sum + s.marks, 0),
          incidentCount: countByAttempt.get(attempt._id.toString()) ?? 0,
        }
      }),
      page: attemptPage,
      limit,
      total: attemptTotal,
      totalPages: attemptTotalPages,
    },
    incidents: {
      items: pagedIncidents.map((incident) => {
        const attempt = attemptById.get(incident.attemptId.toString())
        const student = attempt ? userById.get(attempt.candidateId.toString()) : undefined
        const exam = examById.get(incident.examId.toString())
        return {
          id: incident._id.toString(),
          attemptId: incident.attemptId.toString(),
          examId: incident.examId.toString(),
          examTitle: exam?.title ?? 'Examination',
          candidateId: attempt?.candidateId.toString() ?? '',
          candidateName: student?.name ?? 'Unknown',
          candidateEmail: student?.email ?? '',
          type: incident.type,
          at: incident.at,
          note: incident.note,
          conclusive: false,
        }
      }),
      page: incidentPage,
      limit,
      total: incidentTotal,
      totalPages: incidentTotalPages,
    },
  }
}
