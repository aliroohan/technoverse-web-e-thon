import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { queryClient } from '../lib/query-client'
import { router } from '../router'

type AppProvidersProps = {
  children?: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children ?? <RouterProvider router={router} />}
      <ToastContainer
        position="bottom-right"
        autoClose={5500}
        newestOnTop
        closeOnClick
        pauseOnHover
        pauseOnFocusLoss
        theme="light"
      />
    </QueryClientProvider>
  )
}
