import { createServer } from 'node:http'
import { createApp } from './app.js'
import { env } from './config/index.js'
import { registerJobs } from './jobs/index.js'
import { registerQueues } from './queues/index.js'
import { createSocketServer } from './sockets/index.js'
import { logger } from './utils/logger.js'

const app = createApp()
const httpServer = createServer(app)

createSocketServer(httpServer)
registerJobs()
registerQueues()

httpServer.listen(env.PORT, () => {
  logger.info(`API listening on http://localhost:${env.PORT}`)
})