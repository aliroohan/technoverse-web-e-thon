import { ApiError, apiRequest } from './api-client'
import type { Role, SessionUser } from '../types/domain'

export const fetchMe = async (): Promise<SessionUser | null> => {
  try {
    return await apiRequest<SessionUser>('/auth/me')
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

export const homeFor = (role: Role) => {
  if (role === 'admin') return '/admin/users'
  if (role === 'examiner') return '/examiner/exams'
  return '/candidate'
}
