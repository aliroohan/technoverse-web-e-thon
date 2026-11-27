export const computeDeadline = (startedAt: Date, durationMinutes: number, windowEnd: Date) => {
  const byDuration = new Date(startedAt.getTime() + durationMinutes * 60_000)
  return byDuration < windowEnd ? byDuration : windowEnd
}

export const isPastDeadline = (deadlineAt: Date, serverNow = new Date()) => serverNow.getTime() > deadlineAt.getTime()
