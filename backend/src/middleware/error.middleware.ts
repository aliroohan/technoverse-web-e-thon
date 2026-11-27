import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'
import { env } from '../config/index.js'
import { logger } from '../utils/logger.js'

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        details: err.flatten(),
      },
    })
    return
  }

  if (err && typeof err === 'object' && 'name' in err && err.name === 'CastError') {
    res.status(400).json({
      success: false,
      error: { message: 'Invalid identifier' },
    })
    return
  }

  const status = typeof err.status === 'number' ? err.status : 500
  const rawMessage = err instanceof Error ? err.message : 'Internal server error'

  if (status >= 500) {
    logger.error(rawMessage, err)
  }

  const message = status >= 500 && env.NODE_ENV === 'production' ? 'Internal server error' : rawMessage

  res.status(status).json({
    success: false,
    error: { message },
  })
}