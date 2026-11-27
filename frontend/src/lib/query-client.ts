import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError, notifyError } from './api-client'

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof ApiError) return
      if (error instanceof Error && error.message) {
        notifyError(error.message)
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.options.onError) return
      if (error instanceof Error && error.message) {
        notifyError(error.message)
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      retry: (count, error) => {
        if (error instanceof ApiError && error.status < 500) return false
        return count < 1
      },
      refetchOnWindowFocus: false,
    },
  },
})
