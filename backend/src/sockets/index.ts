import type { Server as HttpServer } from 'node:http'
import { Server } from 'socket.io'
import { env } from '../config/index.js'
import { logger } from '../utils/logger.js'

export const createSocketServer = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_ORIGIN,
      methods: ['GET', 'POST'],
    },
  })

  io.on('connection', (socket) => {
    logger.debug('Socket connected', { socketId: socket.id })

    socket.on('ping', () => {
      socket.emit('pong', { at: new Date().toISOString() })
    })

    socket.on('disconnect', () => {
      logger.debug('Socket disconnected', { socketId: socket.id })
    })
  })

  return io
}