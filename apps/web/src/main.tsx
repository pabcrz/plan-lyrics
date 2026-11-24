/// <reference types="vite/client" />
import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router'
import { ClerkApp } from './ClerkApp'
import { PublicLinkPage } from './share/PublicLinkPage'
import { SongbookPage } from './share/SongbookPage'
import { initAppearance } from './ui'
import './styles.css'

initAppearance()

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
          {/* Vista pública de un enlace del ministerio: sin Clerk ni sesión. */}
          <Route path="/m/:token" element={<PublicLinkPage />} />
          {/* Cancionero público: letras publicadas, sin Clerk ni sesión. */}
          <Route path="/cancionero" element={<SongbookPage />} />
          <Route path="*" element={<ClerkApp publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY} />} />
        </Routes>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
)
