import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { scoreObjective } from './marking.js'

describe('scoreObjective', () => {
  it('awards full marks for an exact single-choice match', () => {
    assert.equal(
      scoreObjective({ type: 'single', correctChoiceIds: ['a'], marks: 2, choiceIds: ['a'] }),
      2,
    )
  })

  it('awards nothing for a wrong single choice', () => {
    assert.equal(
      scoreObjective({ type: 'single', correctChoiceIds: ['a'], marks: 2, choiceIds: ['b'] }),
      0,
    )
  })

  it('gives partial credit for multiple-select and floors at zero', () => {
    assert.equal(
      scoreObjective({
        type: 'multi',
        correctChoiceIds: ['a', 'b'],
        marks: 4,
        choiceIds: ['a', 'b', 'c'],
      }),
      2,
    )
    assert.equal(
      scoreObjective({
        type: 'multi',
        correctChoiceIds: ['a', 'b'],
        marks: 4,
        choiceIds: ['c', 'd'],
      }),
      0,
    )
  })

  it('leaves written questions for a human', () => {
    assert.equal(scoreObjective({ type: 'written', correctChoiceIds: [], marks: 10, choiceIds: [] }), null)
  })
})
