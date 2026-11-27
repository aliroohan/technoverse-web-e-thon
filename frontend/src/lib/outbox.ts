export type OutboxItem = {
  questionId: string
  choiceIds?: string[]
  text?: string
  flaggedForReview?: boolean
}

const key = (attemptId: string) => `holdfast-outbox:${attemptId}`

export const readOutbox = (attemptId: string): OutboxItem[] => {
  const raw = localStorage.getItem(key(attemptId))
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as OutboxItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const writeOutbox = (attemptId: string, items: OutboxItem[]) => {
  if (items.length === 0) localStorage.removeItem(key(attemptId))
  else localStorage.setItem(key(attemptId), JSON.stringify(items))
}

export const enqueueOutbox = (attemptId: string, item: OutboxItem) => {
  const items = readOutbox(attemptId).filter((row) => row.questionId !== item.questionId)
  items.push(item)
  writeOutbox(attemptId, items)
}
