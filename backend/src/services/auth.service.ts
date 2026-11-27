import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { env } from '../config/index.js'
import { HttpError } from '../lib/http-error.js'
import { User } from '../models/index.js'
import type { Role, SessionUser } from '../types/domain.js'

const TOKEN_SECONDS = 60 * 60 * 8

type TokenPayload = { sub: string; role: Role }

export const toSession = (user: { _id: { toString(): string }; name: string; email: string; role: Role }): SessionUser => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
})

export const signSession = (user: SessionUser) =>
  jwt.sign({ sub: user.id, role: user.role } satisfies TokenPayload, env.JWT_SECRET, {
    expiresIn: TOKEN_SECONDS,
  })

export const readSession = (token: string | undefined): TokenPayload => {
  if (!token) throw new HttpError(401, 'Sign in required')
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] })
    if (typeof payload === 'string' || typeof payload.sub !== 'string') {
      throw new HttpError(401, 'Sign in required')
    }
    const role = payload.role
    if (role !== 'admin' && role !== 'examiner' && role !== 'candidate') {
      throw new HttpError(401, 'Sign in required')
    }
    return { sub: payload.sub, role }
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(401, 'Sign in required')
  }
}

export const login = async (email: string, password: string) => {
  const user = await User.findOne({ email: email.toLowerCase().trim() })
  if (!user || !user.active) throw new HttpError(401, 'Email or password is incorrect')
  const match = await bcrypt.compare(password, user.passwordHash)
  if (!match) throw new HttpError(401, 'Email or password is incorrect')
  const session = toSession(user)
  return { session, token: signSession(session) }
}

export const loadSessionUser = async (token: string | undefined) => {
  const payload = readSession(token)
  const user = await User.findById(payload.sub)
  if (!user || !user.active) throw new HttpError(401, 'Sign in required')
  return toSession(user)
}

export const hashPassword = (password: string) => bcrypt.hash(password, 12)
