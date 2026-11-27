import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { snapshotHasKey, toCandidateQuestion } from './serializers.js'
import type { QuestionSnapshot } from '../types/domain.js'

const snapshot: QuestionSnapshot = {
  questionId: 'q1',
  order: 0,
  stem: 'Pick one',
  type: 'single',
  choices: [
    { id: 'a', text: 'Yes' },
    { id: 'b', text: 'No' },
  ],
  correctChoiceIds: ['a'],
  marks: 2,
  category: 'graphs',
  difficulty: 'easy',
  weight: 1,
}

describe('toCandidateQuestion', () => {
  it('strips the answer key', () => {
    const view = toCandidateQuestion(snapshot)
    assert.equal(snapshotHasKey(view), false)
    assert.equal(view.stem, 'Pick one')
    assert.equal(view.choices.length, 2)
  })
})
