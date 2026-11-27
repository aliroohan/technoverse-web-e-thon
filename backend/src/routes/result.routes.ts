import { Router } from 'express'
import { asAuthed, requireUser } from '../middleware/auth.middleware.js'
import { getPreferences, savePreferences } from '../services/preference.service.js'
import { reportPdf, verifyReport } from '../services/report.service.js'
import { myResults, resultDetail } from '../services/results.service.js'
import { asyncHandler } from '../utils/async-handler.js'
import { z } from 'zod'

export const resultRouter = Router()

resultRouter.get('/verify/:code', asyncHandler(async (req, res) => {
  res.json({ success: true, data: await verifyReport(String(req.params.code)) })
}))

resultRouter.get(
  '/me',
  requireUser,
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await myResults(asAuthed(req).user) })
  }),
)

resultRouter.get(
  '/:attemptId',
  requireUser,
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await resultDetail(asAuthed(req).user, String(req.params.attemptId)) })
  }),
)

export const reportRouter = Router()
reportRouter.get(
  '/:attemptId/pdf',
  requireUser,
  asyncHandler(async (req, res) => {
    const report = await reportPdf(asAuthed(req).user, String(req.params.attemptId))
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`)
    res.send(report.buffer)
  }),
)

export const preferenceRouter = Router()
preferenceRouter.use(requireUser)

preferenceRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await getPreferences(asAuthed(req).user) })
  }),
)

preferenceRouter.put(
  '/',
  asyncHandler(async (req, res) => {
    const body = z.object({
      fontScale: z.enum(['sm', 'md', 'lg']).optional(),
      contrast: z.enum(['default', 'high']).optional(),
      navigator: z.enum(['side', 'bottom']).optional(),
    }).parse(req.body)
    res.json({ success: true, data: await savePreferences(asAuthed(req).user, body) })
  }),
)
