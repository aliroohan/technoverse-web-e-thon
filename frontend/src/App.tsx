import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { queryClient } from './lib/query-client'
import { router } from './router'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} context={{ queryClient, user: null }} />
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
