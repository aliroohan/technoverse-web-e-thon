import type { Server as HttpServer } from 'node:http'
import { Server } from 'socket.io'
import { env } from '../config/index.js'
import { readSession } from '../services/auth.service.js'
import { recordIncident } from '../services/attempt.service.js'
import { logger } from '../utils/logger.js'

const cookieValue = (header: string | undefined, name: string) => {
  if (!header) return undefined
  const parts = header.split(';')
  for (const part of parts) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return undefined
}

export const createSocketServer = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: env.CLIENT_ORIGIN, credentials: true },
  })

  io.use((socket, next) => {
    try {
      const token = cookieValue(socket.handshake.headers.cookie, env.COOKIE_NAME)
      const session = readSession(token)
      socket.data.userId = session.sub
      socket.data.role = session.role
      next()
    } catch (error) {
      next(error instanceof Error ? error : new Error('Unauthorized'))
    }
  })

  io.on('connection', (socket) => {
    socket.on('exam:join', (examId: string) => {
      if (typeof examId === 'string' && examId.length > 0) void socket.join(`exam:${examId}`)
    })

    socket.on('attempt:join', (attemptId: string) => {
      if (typeof attemptId !== 'string') return
      void socket.join(`attempt:${attemptId}`)
      if (socket.data.role === 'candidate') {
        void recordIncident(
          { id: socket.data.userId as string, role: 'candidate', name: '', email: '' },
          attemptId,
          'reconnect',
        ).catch(() => undefined)
      }
    })

    socket.on('disconnect', () => {
      logger.debug('Socket disconnected', { socketId: socket.id })
    })
  })

  return io
}
