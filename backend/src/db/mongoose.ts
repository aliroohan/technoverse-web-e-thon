import mongoose from 'mongoose'
import { env } from '../config/index.js'
import { logger } from '../utils/logger.js'

export const connectMongo = async () => {
  mongoose.set('strictQuery', true)
  await mongoose.connect(env.MONGODB_URI)
  logger.info('MongoDB connected')
}
