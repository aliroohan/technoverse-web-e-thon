export type ApiResponse<T> = {
  success: true
  data: T
}

export type ApiErrorResponse = {
  success: false
  error: {
    message: string
    details?: unknown
  }
}

export type HealthStatus = {
  status: 'ok'
  uptime: number
  timestamp: string
}