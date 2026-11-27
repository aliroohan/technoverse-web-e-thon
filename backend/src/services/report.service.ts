import { createHash } from 'node:crypto'
import PDFDocument from 'pdfkit'
import { Answer, Attempt, Exam, Grade, ReportVerification, User } from '../models/index.js'
import { HttpError } from '../lib/http-error.js'
import type { SessionUser } from '../types/domain.js'
import { issueCode } from './grading.service.js'
import { scoreObjective } from './marking.js'

const pdfBuffer = (draw: (doc: InstanceType<typeof PDFDocument>) => void) =>
  new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 56, size: 'A4' })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    draw(doc)
    doc.end()
  })

export const reportPdf = async (user: SessionUser, attemptId: string) => {
  const attempt = await Attempt.findById(attemptId)
  if (!attempt || attempt.isSandbox || attempt.status === 'in_progress') {
    throw new HttpError(404, 'Report not found')
  }
  const exam = await Exam.findById(attempt.examId)
  if (!exam) throw new HttpError(404, 'Report not found')
  const isExaminer = user.role !== 'candidate' && (user.role === 'admin' || exam.examinerId.toString() === user.id)
  const isSelf = attempt.candidateId.toString() === user.id
  if (!isExaminer && !(isSelf && exam.resultsPublished)) throw new HttpError(404, 'Report not found')

  const candidate = await User.findById(attempt.candidateId)
  const answers = await Answer.find({ attemptId })
  const grades = await Grade.find({ attemptId })
  const code = exam.resultsPublished ? await issueCode(attempt.id) : null

  const buffer = await pdfBuffer((doc) => {
    doc.fontSize(22).text('Holdfast result report', { align: 'left' })
    doc.moveDown(0.4)
    doc.fontSize(11).fillColor('#4a433a').text(exam.resultsPublished ? 'Issued report' : 'Draft — not issued')
    doc.fillColor('#1c1915')
    doc.moveDown()
    doc.fontSize(14).text(exam.title)
    doc.moveDown(0.4)
    doc.fontSize(11)
    doc.text(`Candidate: ${candidate?.name ?? 'Candidate'}`)
    doc.text(`Score: ${attempt.totalScore} / ${attempt.questionSnapshots.reduce((sum, item) => sum + item.marks, 0)}`)
    doc.text(`Submitted: ${attempt.submittedAt?.toISOString() ?? '—'}`)
    if (code) doc.text(`Verification code: ${code}`)
    doc.moveDown()
    doc.fontSize(12).text('Questions')
    doc.moveDown(0.4)
    for (const snapshot of [...attempt.questionSnapshots].sort((a, b) => a.order - b.order)) {
      const answer = answers.find((item) => item.questionId === snapshot.questionId)
      const grade = grades.find((item) => item.questionId === snapshot.questionId)
      const objective = scoreObjective({
        type: snapshot.type,
        correctChoiceIds: snapshot.correctChoiceIds,
        marks: snapshot.marks,
        choiceIds: answer?.choiceIds ?? [],
      })
      const awarded = snapshot.type === 'written' ? (grade?.awardedMarks ?? 'ungraded') : (objective ?? 0)
      doc.fontSize(11).text(`${snapshot.order + 1}. ${snapshot.stem}`)
      doc.fontSize(10).fillColor('#4a433a').text(`Awarded ${awarded} / ${snapshot.marks}`)
      doc.fillColor('#1c1915')
      doc.moveDown(0.4)
    }
    doc.moveDown()
    doc.fontSize(9).fillColor('#4a433a').text('Verify this report at the Holdfast verify page. The public page does not show the candidate email or the script.')
  })

  return { filename: `holdfast-${attempt.id}.pdf`, buffer }
}

export const verifyReport = async (code: string) => {
  const codeHash = createHash('sha256').update(code.trim().toLowerCase()).digest('hex')
  const row = await ReportVerification.findOne({ codeHash })
  if (!row) throw new HttpError(404, 'No report matches that code')
  const attempt = await Attempt.findById(row.attemptId)
  const exam = attempt ? await Exam.findById(attempt.examId) : null
  if (!attempt || !exam) throw new HttpError(404, 'No report matches that code')
  const totalMarks = attempt.questionSnapshots.reduce((sum, item) => sum + item.marks, 0)
  return {
    examTitle: exam.title,
    totalScore: attempt.totalScore,
    totalMarks,
    issuedAt: row.issuedAt,
    status: row.revoked ? 'revoked' : 'valid',
  }
}
