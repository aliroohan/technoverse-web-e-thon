import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { paperWeight, selectPaper, type PaperItem } from './fair-paper.js'

const pool: PaperItem[] = [
  { questionId: 'w', category: 'graphs', weight: 2, pinned: true, order: 0 },
  { questionId: 'e1', category: 'graphs', weight: 1, pinned: false, order: 1 },
  { questionId: 'e2', category: 'sorting', weight: 1, pinned: false, order: 2 },
  { questionId: 'm1', category: 'graphs', weight: 2, pinned: false, order: 3 },
  { questionId: 'm2', category: 'sorting', weight: 2, pinned: false, order: 4 },
  { questionId: 'm3', category: 'complexity', weight: 2, pinned: false, order: 5 },
  { questionId: 'h1', category: 'graphs', weight: 3, pinned: false, order: 6 },
  { questionId: 'h2', category: 'sorting', weight: 3, pinned: false, order: 7 },
]

describe('selectPaper', () => {
  it('keeps the pinned question and lands near the difficulty budget', () => {
    const paper = selectPaper(
      pool,
      {
        fairPaper: true,
        questionCount: 4,
        difficultyBudget: 6,
        tolerance: 1,
        randomizeQuestions: false,
      },
      () => 0.4,
    )
    assert.equal(paper.some((item) => item.questionId === 'w'), true)
    assert.equal(paper.length, 4)
    const sampled = paper.filter((item) => item.questionId !== 'w')
    assert.ok(Math.abs(paperWeight(sampled) - 6) <= 1)
  })

  it('can produce two different sets with the same budget', () => {
    const settings = {
      fairPaper: true,
      questionCount: 4,
      difficultyBudget: 6,
      tolerance: 1,
      randomizeQuestions: true,
    }
    const first = selectPaper(pool, settings, seeded(1)).map((item) => item.questionId).join(',')
    const second = selectPaper(pool, settings, seeded(9)).map((item) => item.questionId).join(',')
    assert.notEqual(first, second)
  })
})

const seeded = (seed: number) => {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}
