import { Exam } from '../models/index.js'
import { HttpError } from '../lib/http-error.js'
import type { SessionUser } from '../types/domain.js'

export const loadOwnedExam = async (examId: string, user: SessionUser) => {
  const exam = await Exam.findById(examId)
  if (!exam) throw new HttpError(404, 'Examination not found')
  if (user.role === 'admin') return exam
  if (user.role === 'examiner' && exam.examinerId.toString() === user.id) return exam
  throw new HttpError(403, 'You cannot access this examination')
}
