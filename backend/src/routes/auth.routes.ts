import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import { env } from '../config/index.js'
import { asAuthed, requireUser } from '../middleware/auth.middleware.js'
import { login } from '../services/auth.service.js'
import { asyncHandler } from '../utils/async-handler.js'

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
})

const loginAttempts = new Map<string, number[]>()
const RATE_WINDOW_MS = 5 * 60 * 1000
const RATE_LIMIT = 20

const loginRateLimit: RequestHandler = (req, res, next) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : ''
  const key = `${req.ip ?? 'unknown'}:${email}`
  const now = Date.now()
  const recent = (loginAttempts.get(key) ?? []).filter((ts) => now - ts < RATE_WINDOW_MS)
  if (recent.length >= RATE_LIMIT) {
    res.status(429).json({
      success: false,
      error: { message: 'Too many login attempts. Please wait a few minutes and try again.' },
    })
    return
  }
  recent.push(now)
  loginAttempts.set(key, recent)
  next()
}

const cookieOptions = {
  httpOnly: true,
  sameSite: (env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  secure: env.NODE_ENV === 'production',
  maxAge: 8 * 60 * 60 * 1000,
  path: '/',
}

export const authRouter = Router()

authRouter.post(
  '/login',
  loginRateLimit,
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body)
    const result = await login(body.email, body.password)
    res.cookie(env.COOKIE_NAME, result.token, cookieOptions)
    res.json({ success: true, data: result.session })
  }),
)

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(env.COOKIE_NAME, {
    httpOnly: true,
    path: '/',
    sameSite: cookieOptions.sameSite,
    secure: cookieOptions.secure,
  })
  res.json({ success: true, data: { loggedOut: true } })
})

authRouter.get(
  '/me',
  requireUser,
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: asAuthed(req).user })
  }),
)
