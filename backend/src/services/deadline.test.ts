import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { computeDeadline, isPastDeadline } from './deadline.js'

describe('computeDeadline', () => {
  it('clamps a long duration to the window end', () => {
    const start = new Date('2026-11-27T10:00:00Z')
    const windowEnd = new Date('2026-11-27T10:30:00Z')
    assert.equal(computeDeadline(start, 60, windowEnd).toISOString(), windowEnd.toISOString())
  })

  it('uses duration when the window is longer', () => {
    const start = new Date('2026-11-27T10:00:00Z')
    const windowEnd = new Date('2026-11-27T14:00:00Z')
    assert.equal(computeDeadline(start, 30, windowEnd).toISOString(), '2026-11-27T10:30:00.000Z')
  })

  it('does not treat the deadline as past at the exact instant', () => {
    const deadline = new Date('2026-11-27T10:30:00Z')
    assert.equal(isPastDeadline(deadline, deadline), false)
    assert.equal(isPastDeadline(deadline, new Date(deadline.getTime() + 1)), true)
  })
})
