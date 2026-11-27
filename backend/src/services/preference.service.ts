import { WorkspacePreference } from '../models/index.js'
import type { SessionUser } from '../types/domain.js'

const defaults = { fontScale: 'md' as const, contrast: 'default' as const, navigator: 'side' as const }

export const getPreferences = async (user: SessionUser) => {
  const row = await WorkspacePreference.findOne({ userId: user.id })
  if (!row) return defaults
  return { fontScale: row.fontScale, contrast: row.contrast, navigator: row.navigator }
}

export const savePreferences = async (
  user: SessionUser,
  input: { fontScale?: 'sm' | 'md' | 'lg'; contrast?: 'default' | 'high'; navigator?: 'side' | 'bottom' },
) => {
  const row = await WorkspacePreference.findOneAndUpdate(
    { userId: user.id },
    { $set: input },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  )
  return { fontScale: row.fontScale, contrast: row.contrast, navigator: row.navigator }
}
