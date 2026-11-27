import type { LifecycleState } from '../types/domain.js'

export const lifecycleOf = (
  publication: 'draft' | 'published',
  windowStart: Date,
  windowEnd: Date,
  now = new Date(),
): LifecycleState => {
  if (publication === 'draft') return 'draft'
  if (now < windowStart) return 'published'
  if (now > windowEnd) return 'completed'
  return 'ongoing'
}
