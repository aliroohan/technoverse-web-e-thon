import type { QuestionSnapshot } from '../types/domain.js'

export type PublicChoice = { id: string; text: string }

export type CandidateQuestion = {
  questionId: string
  order: number
  stem: string
  type: QuestionSnapshot['type']
  choices: PublicChoice[]
  marks: number
  category: string
  difficulty: QuestionSnapshot['difficulty']
}

export const toCandidateQuestion = (snapshot: QuestionSnapshot): CandidateQuestion => ({
  questionId: snapshot.questionId,
  order: snapshot.order,
  stem: snapshot.stem,
  type: snapshot.type,
  choices: snapshot.choices.map((choice) => ({ id: choice.id, text: choice.text })),
  marks: snapshot.marks,
  category: snapshot.category,
  difficulty: snapshot.difficulty,
})

export const snapshotHasKey = (value: unknown) =>
  JSON.stringify(value).includes('correctChoiceIds')
