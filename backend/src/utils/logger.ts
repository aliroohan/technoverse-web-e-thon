import { env } from '../config/index.js'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const format = (level: LogLevel, message: string, meta?: unknown) => {
  const base = `[${new Date().toISOString()}] ${level.toUpperCase()}: ${message}`
  if (meta !== undefined) {
    return `${base} ${JSON.stringify(meta)}`
  }
  return base
}

export const logger = {
  debug: (message: string, meta?: unknown) => {
    if (env.NODE_ENV === 'development') {
      console.debug(format('debug', message, meta))
    }
  },
  info: (message: string, meta?: unknown) => console.info(format('info', message, meta)),
  warn: (message: string, meta?: unknown) => console.warn(format('warn', message, meta)),
  error: (message: string, meta?: unknown) => console.error(format('error', message, meta)),
}