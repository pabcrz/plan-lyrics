/// <reference types="vite/client" />
import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router'
import { ClerkApp } from './ClerkApp'
import { PublicLinkPage } from './share/PublicLinkPage'
import { watchInstall } from './install'
import { persistCache, restoreCache } from './offline-cache'
import { registerServiceWorker } from './pwa'
import { SongbookPage } from './share/SongbookPage'
import { initAppearance } from './ui'
import './styles.css'

initAppearance()
watchInstall()
registerServiceWorker()

// Lo precargado para leer sin conexión no se descarta a los 5 minutos por no estar en pantalla.
const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })
restoreCache(client)
persistCache(client)
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
