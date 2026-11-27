import { Router } from 'express'
import { getHealth } from '../controllers/health.controller.js'
import { validate } from '../middleware/validate.middleware.js'
import { healthQuerySchema } from '../validators/health.validator.js'

export const healthRouter = Router()

healthRouter.get('/', validate(healthQuerySchema, 'query'), getHealth)