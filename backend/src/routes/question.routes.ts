import { Router } from 'express'
import { z } from 'zod'
import { asAuthed, requireRole, requireUser } from '../middleware/auth.middleware.js'
import { importQuestions } from '../services/import.service.js'
import { createQuestion, deleteQuestion, getQuestion, listQuestions, updateQuestion } from '../services/exam.service.js'
import { difficulties, questionTypes } from '../types/domain.js'
import { asyncHandler } from '../utils/async-handler.js'

const writeSchema = z.object({
  stem: z.string().trim().min(3),
  type: z.enum(questionTypes),
  category: z.string().trim().min(2),
  difficulty: z.enum(difficulties),
  marks: z.number().positive(),
  choices: z.array(z.object({ text: z.string().trim().min(1) })).default([]),
  correctIndexes: z.array(z.number().int().nonnegative()).default([]),
})

const importSchema = z.object({
  format: z.enum(['csv', 'json']),
  content: z.string().min(1),
})

export const questionRouter = Router()
questionRouter.use(requireUser, requireRole('examiner', 'admin'))

questionRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await listQuestions(asAuthed(req).user) })
  }),
)

questionRouter.post(
  '/import',
  asyncHandler(async (req, res) => {
    const body = importSchema.parse(req.body)
    res.json({ success: true, data: await importQuestions(asAuthed(req).user, body.format, body.content) })
  }),
)

questionRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = writeSchema.parse(req.body)
    res.status(201).json({ success: true, data: await createQuestion(asAuthed(req).user, body) })
  }),
)

questionRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await getQuestion(asAuthed(req).user, String(req.params.id)) })
  }),
)

questionRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = writeSchema.partial().parse(req.body)
    res.json({ success: true, data: await updateQuestion(asAuthed(req).user, String(req.params.id), body) })
  }),
)

questionRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await deleteQuestion(asAuthed(req).user, String(req.params.id))
    res.json({ success: true, data: { deleted: true } })
  }),
)
