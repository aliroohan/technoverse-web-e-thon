import { Announcement, Answer, Attempt, Incident, User } from '../models/index.js'
import { redis, redisCall } from '../db/redis.js'
import type { SessionUser } from '../types/domain.js'
import { loadOwnedExam } from './access.js'

export const monitoringRoster = async (user: SessionUser, examId: string) => {
  await loadOwnedExam(examId, user)
  const attempts = await Attempt.find({ examId, isSandbox: false, status: 'in_progress' })
  const candidates = await User.find({ _id: { $in: attempts.map((attempt) => attempt.candidateId) } })
  const byId = new Map(candidates.map((candidate) => [candidate._id.toString(), candidate]))
  const answers = await Answer.find({ attemptId: { $in: attempts.map((attempt) => attempt._id) } })
  const seen = (await redisCall((client) => client.hgetall(`exam:${examId}:seen`))) ?? {}
  const seenMap = seen as Record<string, string>
  const now = Date.now()

  return attempts.map((attempt) => {
    const mine = answers.filter((answer) => answer.attemptId.toString() === attempt._id.toString())
    const answered = mine.filter((answer) => answer.choiceIds.length > 0 || answer.text.trim().length > 0).length
    const last = mine.reduce<Date | null>((latest, answer) => {
      if (!latest || answer.savedAt > latest) return answer.savedAt
      return latest
    }, null)
    const seenAt = Number(seenMap[attempt.id] ?? 0)
    return {
      attemptId: attempt.id,
      candidateName: byId.get(attempt.candidateId.toString())?.name ?? 'Unknown',
      answered,
      total: attempt.questionSnapshots.length,
      lastSavedAt: last,
      deadlineAt: attempt.deadlineAt,
      online: seenAt > 0 && now - seenAt < 30_000,
    }
  })
}

export const listIncidents = async (user: SessionUser, examId: string) => {
  await loadOwnedExam(examId, user)
  const incidents = await Incident.find({ examId }).sort({ at: -1 }).limit(200)
  return {
    notice: 'These signals are for review. They are not a finding of misconduct.',
    conclusive: false,
    incidents: incidents.map((incident) => ({
      id: incident._id.toString(),
      attemptId: incident.attemptId.toString(),
      type: incident.type,
      at: incident.at,
      note: incident.note,
      conclusive: false,
    })),
  }
}

export const postAnnouncement = async (user: SessionUser, examId: string, body: string) => {
  await loadOwnedExam(examId, user)
  const announcement = await Announcement.create({ examId, body, authorId: user.id, createdAt: new Date() })
  await redisCall((client) =>
    client.publish(
      `exam:${examId}:announce`,
      JSON.stringify({ id: announcement.id, body: announcement.body, createdAt: announcement.createdAt }),
    ),
  )
  return {
    id: announcement.id,
    body: announcement.body,
    createdAt: announcement.createdAt,
  }
}

export const redisClient = redis
