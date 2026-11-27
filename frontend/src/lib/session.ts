import { ApiError, apiRequest } from './api-client'
import type { Role, SessionUser } from '../types/domain'

export const fetchMe = async (): Promise<SessionUser | null> => {
  try {
    return await apiRequest<SessionUser>('/auth/me', { silent: true })
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

const TAB_SESSION_KEY = 'holdfast-tab-session'
let fallbackTabId: string | null = null

export const getTabSessionId = () => {
  try {
    let id = window.sessionStorage.getItem(TAB_SESSION_KEY)
    if (!id) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
      window.sessionStorage.setItem(TAB_SESSION_KEY, id)
    }
    return id
  } catch {
    if (!fallbackTabId) {
      fallbackTabId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
    }
    return fallbackTabId
  }
}
