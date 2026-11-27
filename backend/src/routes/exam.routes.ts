import { Router } from 'express'
import { z } from 'zod'
import { asAuthed, requireRole, requireUser } from '../middleware/auth.middleware.js'
import {
  getAttemptView,
  heartbeat,
  recordIncident,
  saveAnswer,
  saveScratchpad,
  startCandidateAttempt,
  startSandbox,
  submitAttempt,
} from '../services/attempt.service.js'
import {
  assignQuestion,
  assignQuestionsBulk,
  createExam,
  enrollCandidate,
  enrollCandidatesBulk,
  getExam,
  listCandidateExams,
  listExams,
  previewPapers,
  publishExam,
  unassignQuestion,
  unenrollCandidate,
  updateAssignment,
  updateExam,
} from '../services/exam.service.js'
import { gradeWritten, listGrading, publishResults } from '../services/grading.service.js'
import { importCandidates } from '../services/import.service.js'
import { listIncidents, monitoringRoster, postAnnouncement } from '../services/monitoring.service.js'
import { examAnalytics, questionAnalytics } from '../services/results.service.js'
import { asyncHandler } from '../utils/async-handler.js'

const settingsSchema = z.object({
  randomizeQuestions: z.boolean().optional(),
  randomizeChoices: z.boolean().optional(),
  fairPaper: z.boolean().optional(),
  questionCount: z.number().int().positive().nullable().optional(),
  difficultyBudget: z.number().positive().nullable().optional(),
  tolerance: z.number().nonnegative().optional(),
})

const examSchema = z.object({
  title: z.string().trim().min(3).max(160),
  instructions: z.string().trim().min(1).max(5000),
  windowStart: z.coerce.date(),
  windowEnd: z.coerce.date(),
  durationMinutes: z.number().int().positive().max(24 * 60),
  totalMarks: z.number().positive(),
  settings: settingsSchema.optional(),
})

export const examRouter = Router()

examRouter.get(
  '/mine',
  requireUser,
  requireRole('candidate'),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await listCandidateExams(asAuthed(req).user) })
  }),
)

examRouter.use(requireUser, requireRole('examiner', 'admin'))

examRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await listExams(asAuthed(req).user) })
  }),
)

examRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = examSchema.parse(req.body)
    res.status(201).json({ success: true, data: await createExam(asAuthed(req).user, body) })
  }),
)

examRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await getExam(asAuthed(req).user, String(req.params.id)) })
  }),
)

examRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = examSchema.partial().parse(req.body)
    res.json({ success: true, data: await updateExam(asAuthed(req).user, String(req.params.id), body) })
  }),
)

examRouter.post(
  '/:id/publish',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await publishExam(asAuthed(req).user, String(req.params.id)) })
  }),
)

examRouter.post(
  '/:id/questions',
  asyncHandler(async (req, res) => {
    const body = z.object({
      questionId: z.string().min(1),
      marks: z.number().positive().optional(),
      pinned: z.boolean().optional(),
    }).parse(req.body)
    res.json({ success: true, data: await assignQuestion(asAuthed(req).user, String(req.params.id), body) })
  }),
)

examRouter.post(
  '/:id/questions/bulk',
  asyncHandler(async (req, res) => {
    const body = z.object({
      questionIds: z.array(z.string().min(1)).min(1),
    }).parse(req.body)
    res.json({ success: true, data: await assignQuestionsBulk(asAuthed(req).user, String(req.params.id), body.questionIds) })
  }),
)

examRouter.patch(
  '/:id/questions/:questionId',
  asyncHandler(async (req, res) => {
    const body = z.object({ marks: z.number().positive().optional(), pinned: z.boolean().optional() }).parse(req.body)
    res.json({
      success: true,
      data: await updateAssignment(asAuthed(req).user, String(req.params.id), String(req.params.questionId), body),
    })
  }),
)

examRouter.delete(
  '/:id/questions/:questionId',
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: await unassignQuestion(asAuthed(req).user, String(req.params.id), String(req.params.questionId)),
    })
  }),
)

examRouter.post(
  '/:id/enrollments',
  asyncHandler(async (req, res) => {
    const body = z.object({ candidateId: z.string().min(1) }).parse(req.body)
    res.json({ success: true, data: await enrollCandidate(asAuthed(req).user, String(req.params.id), body.candidateId) })
  }),
)

examRouter.post(
  '/:id/enrollments/bulk',
  asyncHandler(async (req, res) => {
    const body = z.object({ candidateIds: z.array(z.string().min(1)).min(1) }).parse(req.body)
    res.json({ success: true, data: await enrollCandidatesBulk(asAuthed(req).user, String(req.params.id), body.candidateIds) })
  }),
)

examRouter.delete(
  '/:id/enrollments/:candidateId',
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: await unenrollCandidate(asAuthed(req).user, String(req.params.id), String(req.params.candidateId)),
    })
  }),
)

examRouter.post(
  '/:id/candidates/import',
  asyncHandler(async (req, res) => {
    const body = z.object({ format: z.enum(['csv', 'json']), content: z.string().min(1) }).parse(req.body)
    res.json({
      success: true,
      data: await importCandidates(asAuthed(req).user, body.format, body.content, String(req.params.id)),
    })
  }),
)

examRouter.post(
  '/:id/preview-papers',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await previewPapers(asAuthed(req).user, String(req.params.id)) })
  }),
)

examRouter.post(
  '/:id/sandbox',
  asyncHandler(async (req, res) => {
    res.status(201).json({ success: true, data: await startSandbox(asAuthed(req).user, String(req.params.id)) })
  }),
)

examRouter.get(
  '/:id/monitoring',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await monitoringRoster(asAuthed(req).user, String(req.params.id)) })
  }),
)

examRouter.get(
  '/:id/incidents',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await listIncidents(asAuthed(req).user, String(req.params.id)) })
  }),
)

examRouter.post(
  '/:id/announcements',
  asyncHandler(async (req, res) => {
    const body = z.object({ body: z.string().trim().min(1).max(500) }).parse(req.body)
    const announcement = await postAnnouncement(asAuthed(req).user, String(req.params.id), body.body)
    const io = req.app.get('io') as { to: (room: string) => { emit: (event: string, payload: unknown) => void } } | undefined
    io?.to(`exam:${String(req.params.id)}`).emit('announcement', announcement)
    res.status(201).json({ success: true, data: announcement })
  }),
)

examRouter.get(
  '/:id/grading',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await listGrading(asAuthed(req).user, String(req.params.id)) })
  }),
)

examRouter.post(
  '/:id/publish-results',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await publishResults(asAuthed(req).user, String(req.params.id)) })
  }),
)

examRouter.get(
  '/:id/analytics',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await examAnalytics(asAuthed(req).user, String(req.params.id)) })
  }),
)

examRouter.get(
  '/:id/question-analytics',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await questionAnalytics(asAuthed(req).user, String(req.params.id)) })
  }),
)

export const attemptRouter = Router()
attemptRouter.use(requireUser)

attemptRouter.post(
  '/start/:examId',
  requireRole('candidate'),
  asyncHandler(async (req, res) => {
    res.status(201).json({ success: true, data: await startCandidateAttempt(asAuthed(req).user, String(req.params.examId)) })
  }),
)

attemptRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await getAttemptView(asAuthed(req).user, String(req.params.id)) })
  }),
)

attemptRouter.put(
  '/:id/answers',
  asyncHandler(async (req, res) => {
    const body = z.object({
      questionId: z.string().min(1),
      choiceIds: z.array(z.string()).optional(),
      text: z.string().max(20000).optional(),
      flaggedForReview: z.boolean().optional(),
      expectedVersion: z.number().int().min(0).optional(),
    }).parse(req.body)
    res.json({ success: true, data: await saveAnswer(asAuthed(req).user, String(req.params.id), body) })
  }),
)

attemptRouter.post(
  '/:id/submit',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await submitAttempt(asAuthed(req).user, String(req.params.id)) })
  }),
)

attemptRouter.post(
  '/:id/heartbeat',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await heartbeat(asAuthed(req).user, String(req.params.id)) })
  }),
)

attemptRouter.put(
  '/:id/scratchpad',
  asyncHandler(async (req, res) => {
    const body = z.object({ text: z.string().max(20000) }).parse(req.body)
    res.json({ success: true, data: await saveScratchpad(asAuthed(req).user, String(req.params.id), body.text) })
  }),
)

attemptRouter.post(
  '/:id/incidents',
  asyncHandler(async (req, res) => {
    const body = z.object({
      type: z.enum(['disconnect', 'reconnect', 'blur', 'focus', 'autosave_failed']),
      note: z.string().max(300).optional(),
    }).parse(req.body)
    res.json({ success: true, data: await recordIncident(asAuthed(req).user, String(req.params.id), body.type, body.note) })
  }),
)

export const gradingRouter = Router()
gradingRouter.use(requireUser, requireRole('examiner', 'admin'))

gradingRouter.put(
  '/:attemptId/questions/:questionId',
  asyncHandler(async (req, res) => {
    const body = z.object({
      awardedMarks: z.number().min(0),
      comment: z.string().max(1000).optional(),
    }).parse(req.body)
    res.json({
      success: true,
      data: await gradeWritten(
        asAuthed(req).user,
        String(req.params.attemptId),
        String(req.params.questionId),
        body.awardedMarks,
        body.comment ?? '',
      ),
    })
  }),
)
