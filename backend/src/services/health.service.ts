import type { HealthStatus } from '../types/index.js'

export const getHealthStatus = (): HealthStatus => ({
  status: 'ok',
  uptime: process.uptime(),
  timestamp: new Date().toISOString(),
})