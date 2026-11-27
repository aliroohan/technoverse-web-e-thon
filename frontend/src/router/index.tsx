import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { DashboardLayout } from '../layouts/DashboardLayout'
import { fetchMe, homeFor } from '../lib/session'
import { AdminResultPaperPage } from '../pages/AdminResultPaperPage'
import { AdminStudentLogPage } from '../pages/AdminStudentLogPage'
import { AdminUsersPage } from '../pages/AdminUsersPage'
import { CandidateHomePage } from '../pages/CandidateHomePage'
import { CandidatesPage } from '../pages/CandidatesPage'
import { ExamDeskPage } from '../pages/ExamDeskPage'
import { ExamListPage } from '../pages/ExamListPage'
import { ExamRunnerPage } from '../pages/ExamRunnerPage'
import { LoginPage } from '../pages/LoginPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { QuestionBankPage } from '../pages/QuestionBankPage'
import { ResultPage } from '../pages/ResultPage'
import { VerifyPage } from '../pages/VerifyPage'
import type { Role, SessionUser } from '../types/domain'

export type RouterContext = {
  queryClient: QueryClient
  user: SessionUser | null
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
  notFoundComponent: NotFoundPage,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData({ queryKey: ['me'], queryFn: fetchMe })
    if (user) throw redirect({ to: homeFor(user.role) })
  },
  component: LoginPage,
})

const verifyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/verify/$code',
  component: VerifyPage,
})

const authedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'authed',
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData({ queryKey: ['me'], queryFn: fetchMe })
    if (!user) throw redirect({ to: '/login' })
    return { user }
  },
  component: () => <Outlet />,
})

const dashboardRoute = createRoute({
  getParentRoute: () => authedRoute,
  id: 'dashboard',
  component: DashboardLayout,
})

const guard =
  (role: Role) =>
  ({ context }: { context: RouterContext }) => {
    if (context.user?.role !== role) {
      throw redirect({ to: context.user ? homeFor(context.user.role) : '/login' })
    }
  }

const indexRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/',
  beforeLoad: ({ context }) => {
    if (!context.user) throw redirect({ to: '/login' })
    throw redirect({ to: homeFor(context.user.role) })
  },
})

const adminRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/admin/users',
  beforeLoad: guard('admin'),
  component: AdminUsersPage,
})

const adminLogsRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/admin/logs',
  beforeLoad: guard('admin'),
  component: AdminStudentLogPage,
})

const adminLogPaperRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/admin/logs/$examId',
  beforeLoad: guard('admin'),
  component: AdminResultPaperPage,
})

const examsRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/examiner/exams',
  beforeLoad: guard('examiner'),
  component: ExamListPage,
})

const examDeskRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/examiner/exams/$examId',
  beforeLoad: guard('examiner'),
  component: ExamDeskPage,
})

const questionsRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/examiner/questions',
  beforeLoad: guard('examiner'),
  component: QuestionBankPage,
})

const candidatesRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/examiner/candidates',
  beforeLoad: guard('examiner'),
  component: CandidatesPage,
})

const candidateRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/candidate',
  beforeLoad: guard('candidate'),
  component: CandidateHomePage,
})

const resultRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/candidate/results/$attemptId',
  beforeLoad: guard('candidate'),
  component: ResultPage,
})

const runnerRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/exam/$attemptId',
  component: ExamRunnerPage,
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  verifyRoute,
  authedRoute.addChildren([
    runnerRoute,
    dashboardRoute.addChildren([
      indexRoute,
      adminRoute,
      adminLogsRoute,
      adminLogPaperRoute,
      examsRoute,
      examDeskRoute,
      questionsRoute,
      candidatesRoute,
      candidateRoute,
      resultRoute,
    ]),
  ]),
])

export const router = createRouter({
  routeTree,
  context: { queryClient: undefined as unknown as QueryClient, user: null },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
