import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'
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

  const status = typeof err.status === 'number' ? err.status : 500
  const message = err instanceof Error ? err.message : 'Internal server error'

  if (status >= 500) {
    logger.error(message, err)
  }

  res.status(status).json({
    success: false,
    error: { message },
  })
}