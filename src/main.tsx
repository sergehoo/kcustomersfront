import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import './styles.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: (count, error) => count < 1 && !(error instanceof Error && /401|403|404/.test(error.message)), staleTime: 60_000 },
    mutations: { retry: false },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
