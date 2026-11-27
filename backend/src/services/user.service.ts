import { User } from '../models/index.js'
import { HttpError } from '../lib/http-error.js'
import type { Role, SessionUser } from '../types/domain.js'
import { hashPassword } from './auth.service.js'

const publicUser = (user: { _id: { toString(): string }; name: string; email: string; role: Role; active: boolean }) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  active: user.active,
})

export const listUsers = async (role?: Role) => {
  const users = await User.find(role ? { role } : {}).sort({ name: 1 })
  return users.map(publicUser)
}

const CANDIDATE_PASSWORD = 'Candidate123!'

export const createCandidate = async (input: { name: string; email: string }) => {
  const user = await createUser({
    name: input.name,
    email: input.email,
    password: CANDIDATE_PASSWORD,
    role: 'candidate',
  })
  return { ...user, passwordNote: `New candidates can sign in with ${CANDIDATE_PASSWORD}` }
}

export const createUser = async (input: { name: string; email: string; password: string; role: Role }) => {
  const existing = await User.findOne({ email: input.email.toLowerCase() })
  if (existing) throw new HttpError(409, 'An account with that email already exists')
  const user = await User.create({
    name: input.name,
    email: input.email,
    passwordHash: await hashPassword(input.password),
    role: input.role,
    active: true,
  })
  return publicUser(user)
}

export const updateUser = async (
  actor: SessionUser,
  userId: string,
  input: { name?: string; role?: Role; active?: boolean; password?: string },
) => {
  const user = await User.findById(userId)
  if (!user) throw new HttpError(404, 'User not found')
  if (actor.id === userId && input.active === false) throw new HttpError(400, 'You cannot deactivate yourself')
  if (input.name !== undefined) user.name = input.name
  if (input.role !== undefined) user.role = input.role
  if (input.active !== undefined) user.active = input.active
  if (input.password) user.passwordHash = await hashPassword(input.password)
  await user.save()
  return publicUser(user)
}
