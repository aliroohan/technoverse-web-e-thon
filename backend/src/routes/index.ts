import { Router } from 'express'
import { adminRouter } from './admin.routes.js'
import { attemptRouter, examRouter, gradingRouter } from './exam.routes.js'
import { authRouter } from './auth.routes.js'
import { healthRouter } from './health.routes.js'
import { preferenceRouter, reportRouter, resultRouter } from './result.routes.js'
import { questionRouter } from './question.routes.js'
import { candidateRouter, userRouter } from './user.routes.js'

export const apiRouter = Router()

apiRouter.use('/health', healthRouter)
apiRouter.use('/auth', authRouter)
apiRouter.use('/admin', adminRouter)
apiRouter.use('/candidates', candidateRouter)
apiRouter.use('/users', userRouter)
apiRouter.use('/questions', questionRouter)
apiRouter.use('/exams', examRouter)
apiRouter.use('/attempts', attemptRouter)
apiRouter.use('/grading', gradingRouter)
apiRouter.use('/results', resultRouter)
apiRouter.use('/reports', reportRouter)
apiRouter.use('/preferences', preferenceRouter)
