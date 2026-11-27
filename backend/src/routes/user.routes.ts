import { Router } from 'express'
import { z } from 'zod'
import { asAuthed, requireRole, requireUser } from '../middleware/auth.middleware.js'
import { createUser, listUsers, updateUser } from '../services/user.service.js'
import { roles } from '../types/domain.js'
import { asyncHandler } from '../utils/async-handler.js'

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email(),
  password: z.string().min(8).max(80),
  role: z.enum(roles),
})

const updateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  role: z.enum(roles).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).max(80).optional(),
})

export const userRouter = Router()
userRouter.use(requireUser)

userRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = asAuthed(req).user
    const role = z.enum(roles).optional().parse(req.query.role)
    if (user.role === 'examiner') {
      res.json({ success: true, data: await listUsers('candidate') })
      return
    }
    if (user.role !== 'admin') {
      res.status(403).json({ success: false, error: { message: 'You do not have permission to do that' } })
      return
    }
    res.json({ success: true, data: await listUsers(role) })
  }),
)

userRouter.use(requireRole('admin'))

userRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body)
    res.status(201).json({ success: true, data: await createUser(body) })
  }),
)

userRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = updateSchema.parse(req.body)
    res.json({ success: true, data: await updateUser(asAuthed(req).user, String(req.params.id), body) })
  }),
)
