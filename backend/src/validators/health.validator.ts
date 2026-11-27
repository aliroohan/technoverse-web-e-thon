import { z } from 'zod'

export const healthQuerySchema = z.object({
  verbose: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
})

export type HealthQuery = z.infer<typeof healthQuerySchema>