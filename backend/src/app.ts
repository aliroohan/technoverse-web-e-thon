import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { env } from './config/index.js'
import { errorHandler } from './middleware/error.middleware.js'
import { notFoundHandler } from './middleware/not-found.middleware.js'
import { apiRouter } from './routes/index.js'
import { verifyReport } from './services/report.service.js'
import { asyncHandler } from './utils/async-handler.js'

export const createApp = () => {
  const app = express()

  app.use(helmet())
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }))
  app.use(cookieParser())
  app.use(express.json({ limit: '1mb' }))

  app.get('/', (_req, res) => {
    res.json({ success: true, data: { name: 'holdfast', version: '1.0.0' } })
  })

  app.get(
    '/api/verify/:code',
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await verifyReport(String(req.params.code)) })
    }),
  )

  app.use('/api', apiRouter)
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
