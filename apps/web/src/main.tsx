/// <reference types="vite/client" />
import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router'
import { ClerkApp } from './ClerkApp'
import './styles.css'

const client = new QueryClient()
// Página interna del sistema visual: solo existe en desarrollo.
const Reference = import.meta.env.DEV ? lazy(() => import('./ui/Reference')) : null

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={client}>
        <Routes>
          {Reference && (
            <Route path="/dev/ui" element={<Suspense fallback={null}><Reference /></Suspense>} />
          )}
          <Route path="*" element={<ClerkApp publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY} />} />
        </Routes>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
)
