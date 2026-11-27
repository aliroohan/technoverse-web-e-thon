import { Redis, type Redis as RedisClient } from 'ioredis'
import { env } from '../config/index.js'
import { logger } from '../utils/logger.js'

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 2,
  lazyConnect: true,
  enableOfflineQueue: false,
})

redis.on('error', (error: Error) => {
  logger.warn('Redis error', { message: error.message })
})

export const connectRedis = async () => {
  if (redis.status === 'ready') return
  await redis.connect()
  logger.info('Redis connected')
}

export const redisCall = async <T>(fn: (client: RedisClient) => Promise<T>): Promise<T | null> => {
  try {
    if (redis.status !== 'ready') return null
    return await fn(redis)
  } catch (error) {
    logger.warn('Redis command failed', {
      message: error instanceof Error ? error.message : 'unknown',
    })
    return null
  }
}
