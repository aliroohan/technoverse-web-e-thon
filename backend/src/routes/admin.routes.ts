import { Router } from 'express'
import { z } from 'zod'
import { asAuthed, requireRole, requireUser } from '../middleware/auth.middleware.js'
import {
  getAdminPaperDetail,
  listAdminPapers,
  listStudentLogs,
  setExamResultsPublication,
  setVerificationRevoked,
  updateAdminAttemptResult,
} from '../services/admin.service.js'
import { asyncHandler } from '../utils/async-handler.js'

const pagingSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(8),
  search: z.string().max(120).optional(),
})

const papersQuerySchema = pagingSchema.extend({
  examId: z.string().optional(),
  examinerId: z.string().optional(),
})

const logSchema = pagingSchema.extend({
  candidateId: z.string().optional(),
  examId: z.string().optional(),
  type: z.enum(['disconnect', 'reconnect', 'blur', 'focus', 'autosave_failed']).optional(),
})

export const adminRouter = Router()
adminRouter.use(requireUser, requireRole('admin'))

adminRouter.get(
  '/papers',
  asyncHandler(async (req, res) => {
    const query = papersQuerySchema.parse(req.query)
    res.json({
      success: true,
      data: await listAdminPapers({
        page: query.page,
        limit: query.limit,
        search: query.search,
        examId: query.examId || undefined,
        examinerId: query.examinerId || undefined,
      }),
    })
  }),
)

adminRouter.get(
  '/papers/:examId',
  asyncHandler(async (req, res) => {
    const query = pagingSchema.parse(req.query)
    res.json({ success: true, data: await getAdminPaperDetail(String(req.params.examId), query) })
  }),
)

adminRouter.post(
  '/papers/:examId/results-publication',
  asyncHandler(async (req, res) => {
    const body = z.object({ published: z.boolean() }).parse(req.body)
    res.json({
      success: true,
      data: await setExamResultsPublication(asAuthed(req).user, String(req.params.examId), body.published),
    })
  }),
)

adminRouter.patch(
  '/attempts/:attemptId/result',
  asyncHandler(async (req, res) => {
    const body = z.object({
      teacherComment: z.string().max(1000).optional(),
      objectiveScore: z.number().min(0).optional(),
      writtenGrades: z
        .array(
          z.object({
            questionId: z.string().min(1),
            awardedMarks: z.number().min(0),
            comment: z.string().max(1000).default(''),
          }),
        )
        .optional(),
    }).parse(req.body)
    res.json({
      success: true,
      data: await updateAdminAttemptResult(asAuthed(req).user, String(req.params.attemptId), body),
    })
  }),
)

adminRouter.patch(
  '/attempts/:attemptId/verification',
  asyncHandler(async (req, res) => {
    const body = z.object({ revoked: z.boolean() }).parse(req.body)
    res.json({
      success: true,
      data: await setVerificationRevoked(String(req.params.attemptId), body.revoked),
    })
  }),
)

adminRouter.get(
  '/student-logs',
  asyncHandler(async (req, res) => {
    const query = logSchema.parse(req.query)
    res.json({
      success: true,
      data: await listStudentLogs({
        page: query.page,
        limit: query.limit,
        candidateId: query.candidateId || undefined,
        examId: query.examId || undefined,
        incidentType: query.type,
        search: query.search,
      }),
    })
  }),
)
