import {
  ClerkFailed, ClerkLoaded, ClerkLoading, ClerkProvider,
  Show, SignInButton,
} from '@clerk/react'
import { App } from './App'
import { ProductRoutes } from './calendar/ProductRoutes'

export function ClerkApp({ publishableKey }: { publishableKey?: string }) {
  const key = publishableKey?.trim()
  if (!key) {
    return <App authentication={<p role="status">Clerk pendiente: configurá VITE_CLERK_PUBLISHABLE_KEY.</p>} />
  }
  // Only public identifiers belong in Vite. This checks configuration, not identity.
  if (!/^pk_(test|live)_[A-Za-z0-9+/=_-]+$/.test(key)) {
    return <App authentication={<p role="alert">Configuración de Clerk inválida: usá únicamente una clave publicable.</p>} />
  }

  return (
    <ClerkProvider publishableKey={key} afterSignOutUrl="/">
      <Show when="signed-in"><ProductRoutes /></Show>
      <ClerkLoading><App authentication={<p role="status">Cargando autenticación…</p>} /></ClerkLoading>
      <ClerkFailed><App authentication={<p role="alert">No se pudo cargar Clerk. Recargá la página para reintentar.</p>} /></ClerkFailed>
      <ClerkLoaded>
        <Show when="signed-out">
          <App authentication={
            <SignInButton mode="modal">
              <button type="button" className="min-h-11 rounded border px-4 py-2">Iniciar sesión</button>
            </SignInButton>
          } />
        </Show>
      </ClerkLoaded>
    </ClerkProvider>
  )
}
