import { toast } from 'react-toastify'
import type { ApiErrorResponse, ApiResponse } from '../types/api'

const apiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

/** Socket.IO host. Empty when the API is same-origin through the Vite proxy. */
export const socketOrigin = apiBase.startsWith('http') ? apiBase.replace(/\/api$/, '') : undefined

type RequestOptions = RequestInit & {
  params?: Record<string, string | number | boolean | undefined>
  silent?: boolean
  toastOnError?: boolean
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export const notifyError = (message: string) => {
  toast.error(message, { toastId: `err:${message}` })
}

export const notifySuccess = (message: string) => {
  toast.success(message, { toastId: `ok:${message}` })
}

const isGeneralErrorStatus = (status: number, path: string) => {
  if (status === 0 || status >= 500 || status === 403) return true
  if (status === 401 && !path.startsWith('/auth/login')) return true
  return false
}

const buildUrl = (path: string, params?: RequestOptions['params']) => {
  const url = new URL(path.startsWith('http') ? path : `${apiBase}${path}`, window.location.origin)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers, silent, toastOnError, ...init } = options
  let response: Response
  try {
    response = await fetch(buildUrl(path, params), {
      ...init,
      credentials: 'include',
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
    })
  } catch {
    const message = 'Network error. Please check your connection.'
    if (!silent) notifyError(message)
    throw new ApiError(0, message)
  }

  const text = await response.text()
  let body: ApiResponse<T> | ApiErrorResponse | null = null
  if (text) {
    try {
      body = JSON.parse(text) as ApiResponse<T> | ApiErrorResponse
    } catch {
      const message =
        'The API did not return JSON. Set VITE_API_URL to the backend origin, including /api, and redeploy the frontend.'
      if (!silent) notifyError(message)
      throw new ApiError(response.status, message)
    }
  }

  if (!response.ok || !body || !body.success) {
    const message = body && !body.success ? body.error.message : `Request failed (${response.status})`
    if (!silent && (toastOnError || isGeneralErrorStatus(response.status, path))) {
      notifyError(message)
    }
    throw new ApiError(response.status, message)
  }

  return body.data
}

export async function downloadPdf(path: string, filename: string) {
  let response: Response
  try {
    response = await fetch(buildUrl(path), { credentials: 'include' })
  } catch {
    const message = 'Could not download PDF. Check your connection.'
    notifyError(message)
    throw new ApiError(0, message)
  }
  if (!response.ok) {
    const text = await response.text()
    let message = `Request failed (${response.status})`
    try {
      const body = JSON.parse(text) as ApiErrorResponse
      if (!body.success) message = body.error.message
    } catch {
      /* keep the status message */
    }
    notifyError(message)
    throw new ApiError(response.status, message)
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
  notifySuccess('Report downloaded.')
}
