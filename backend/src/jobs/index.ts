import { expireDueAttempts } from '../services/attempt.service.js'
import { logger } from '../utils/logger.js'

export const registerJobs = () => {
  setInterval(() => {
    void expireDueAttempts()
      .then((count) => {
        if (count > 0) logger.info('Finalized attempts at deadline', { count })
      })
      .catch((error: unknown) => {
        logger.error('Expiry sweep failed', { message: error instanceof Error ? error.message : 'unknown' })
      })
  }, 15_000)
}
