import { createServer } from 'node:http'
import { createApp } from './app.js'
import { env } from './config/index.js'
import { connectMongo } from './db/mongoose.js'
import { connectRedis } from './db/redis.js'
import { registerJobs } from './jobs/index.js'
import { registerQueues } from './queues/index.js'
import { createSocketServer } from './sockets/index.js'
import { logger } from './utils/logger.js'

const main = async () => {
  await connectMongo()
  try {
    await connectRedis()
  } catch (error) {
    logger.warn('Redis unavailable, continuing with Mongo as the record', {
      message: error instanceof Error ? error.message : 'unknown',
    })
  }

  const app = createApp()
  const httpServer = createServer(app)
  const io = createSocketServer(httpServer)
  app.set('io', io)
  registerJobs()
  registerQueues()

  httpServer.listen(env.PORT, () => {
    logger.info(`Holdfast API listening on http://localhost:${env.PORT}`)
  })
}

void main()
