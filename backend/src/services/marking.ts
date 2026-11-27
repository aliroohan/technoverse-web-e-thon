import type { QuestionSnapshot } from '../types/domain.js'

export type MarkInput = {
  type: QuestionSnapshot['type']
  correctChoiceIds: string[]
  marks: number
  choiceIds: string[]
}

/** A paper with a written question stays hidden until the examiner has marked every one. */
export const writtenAwaitingMark = (attempt: {
  questionSnapshots: { type: string }[]
  gradingStatus?: string | null
}) => attempt.questionSnapshots.some((item) => item.type === 'written') && attempt.gradingStatus !== 'ready'

/** Objective score. Written questions return null until a human grades them. */
export const scoreObjective = (input: MarkInput): number | null => {
  if (input.type === 'written') return null

  const correct = new Set(input.correctChoiceIds)
  const selected = new Set(input.choiceIds)

  if (input.type === 'single') {
    const only = [...selected]
    const match =
      only.length === 1 && correct.size === 1 && only[0] !== undefined && correct.has(only[0])
    return match ? input.marks : 0
  }

  if (correct.size === 0) return 0

  let correctSelected = 0
  let wrongSelected = 0
  for (const id of selected) {
    if (correct.has(id)) correctSelected += 1
    else wrongSelected += 1
  }

  const raw = ((correctSelected - wrongSelected) / correct.size) * input.marks
  return Math.max(0, round2(raw))
}

export const round2 = (value: number) => Math.round(value * 100) / 100
