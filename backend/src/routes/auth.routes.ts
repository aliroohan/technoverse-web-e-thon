import { Router } from 'express'
import { z } from 'zod'
import { env } from '../config/index.js'
import { asAuthed, requireUser } from '../middleware/auth.middleware.js'
import { login } from '../services/auth.service.js'
import { asyncHandler } from '../utils/async-handler.js'

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
})

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.NODE_ENV === 'production',
  maxAge: 8 * 60 * 60 * 1000,
  path: '/',
}

export const authRouter = Router()

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body)
    const result = await login(body.email, body.password)
    res.cookie(env.COOKIE_NAME, result.token, cookieOptions)
    res.json({ success: true, data: result.session })
  }),
)

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(env.COOKIE_NAME, { path: '/' })
  res.json({ success: true, data: { loggedOut: true } })
})

authRouter.get(
  '/me',
  requireUser,
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: asAuthed(req).user })
  }),
)
