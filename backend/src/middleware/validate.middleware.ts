import type { NextFunction, Request, Response } from 'express'
import type { ZodTypeAny } from 'zod'

type ValidationTarget = 'body' | 'query' | 'params'

export const validate =
  (schema: ZodTypeAny, target: ValidationTarget = 'body') =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target])
    if (!result.success) {
      next(result.error)
      return
    }
    if (target === 'query') {
      Object.defineProperty(req, 'query', {
        value: result.data,
        writable: true,
        configurable: true,
      })
    } else {
      req[target] = result.data
    }
    next()
  }