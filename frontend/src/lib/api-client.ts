import type { ApiErrorResponse, ApiResponse } from '../types/api'

const apiBase = 'http://localhost:3000/api'

type RequestOptions = RequestInit & {
  params?: Record<string, string | number | boolean | undefined>
}

const buildUrl = (path: string, params?: RequestOptions['params']) => {
  const url = new URL(path.startsWith('http') ? path : `${apiBase}${path}`, window.location.origin)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value))
      }
    }
  }
  return url.toString()
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers, ...init } = options
  const response = await fetch(buildUrl(path, params), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  })

  const body = (await response.json()) as ApiResponse<T> | ApiErrorResponse

  if (!response.ok || !body.success) {
    const message = !body.success ? body.error.message : `Request failed (${response.status})`
    throw new Error(message)
  }

  return body.data
}