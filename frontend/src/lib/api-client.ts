import type { ApiErrorResponse, ApiResponse } from '../types/api'

const apiBase = '/api'

type RequestOptions = RequestInit & {
  params?: Record<string, string | number | boolean | undefined>
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
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
  const { params, headers, ...init } = options
  const response = await fetch(buildUrl(path, params), {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
  })

  const text = await response.text()
  const body = text ? (JSON.parse(text) as ApiResponse<T> | ApiErrorResponse) : null

  if (!response.ok || !body || !body.success) {
    const message = body && !body.success ? body.error.message : `Request failed (${response.status})`
    throw new ApiError(response.status, message)
  }

  return body.data
}

export async function downloadPdf(path: string, filename: string) {
  const response = await fetch(buildUrl(path), { credentials: 'include' })
  if (!response.ok) {
    const text = await response.text()
    let message = `Request failed (${response.status})`
    try {
      const body = JSON.parse(text) as ApiErrorResponse
      if (!body.success) message = body.error.message
    } catch {
      /* keep the status message */
    }
    throw new ApiError(response.status, message)
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
