import type { RequestHandler } from 'express'
import { getHealthStatus } from '../services/health.service.js'
import type { HealthQuery } from '../validators/health.validator.js'
import { asyncHandler } from '../utils/async-handler.js'

export const getHealth: RequestHandler = asyncHandler(async (req, res) => {
  const { verbose } = req.query as unknown as HealthQuery
  const health = getHealthStatus()

  res.json({
    success: true,
    data: verbose ? { ...health, environment: process.env.NODE_ENV ?? 'development' } : health,
  })
})