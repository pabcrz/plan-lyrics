/// <reference types="vite/client" />
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router'
import { ClerkApp } from './ClerkApp'
import './styles.css'

const client = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={client}>
        <ClerkApp publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY} />
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
)
