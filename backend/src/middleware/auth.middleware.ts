import type { NextFunction, Request, Response } from 'express'
import { env } from '../config/index.js'
import { HttpError } from '../lib/http-error.js'
import { loadSessionUser } from '../services/auth.service.js'
import type { Role, SessionUser } from '../types/domain.js'

export type AuthedRequest = Request & { user: SessionUser }

export const requireUser = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.[env.COOKIE_NAME] as string | undefined
    ;(req as AuthedRequest).user = await loadSessionUser(token)
    next()
  } catch (error) {
    next(error)
  }
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as AuthedRequest).user
    if (!user) {
      next(new HttpError(401, 'Sign in required'))
      return
    }
    if (!roles.includes(user.role)) {
      next(new HttpError(403, 'You do not have permission to do that'))
      return
    }
    next()
  }

export const asAuthed = (req: Request) => req as AuthedRequest
