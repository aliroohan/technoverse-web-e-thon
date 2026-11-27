import { config as loadEnv } from 'dotenv'
import { z } from 'zod'

loadEnv()

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/holdfast'),
  REDIS_URL: z.string().min(1).default('redis://127.0.0.1:6379'),
  JWT_SECRET: z.string().min(8).default('dev-only-change-me'),
  COOKIE_NAME: z.string().min(1).default('holdfast_session'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

if (parsed.data.NODE_ENV === 'production' && (parsed.data.JWT_SECRET === 'dev-only-change-me' || parsed.data.JWT_SECRET.length < 16)) {
  console.error('JWT_SECRET must be set to a strong secret (>= 16 chars) in production')
  process.exit(1)
}

export const env = parsed.data
