import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { env } from './config/index.js'
import { errorHandler } from './middleware/error.middleware.js'
import { notFoundHandler } from './middleware/not-found.middleware.js'
import { apiRouter } from './routes/index.js'

export const createApp = () => {
  const app = express()

  app.use(helmet())
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      credentials: true,
    }),
  )
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))

  app.get('/', (_req, res) => {
    res.json({
      success: true,
      data: { name: 'web-e-thon-api', version: '0.0.1' },
    })
  })

  app.use('/api', apiRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}