import { esMX } from '@clerk/localizations'
import {
  ClerkFailed, ClerkLoaded, ClerkLoading, ClerkProvider,
  Show, SignInButton, useUser,
} from '@clerk/react'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { claimCache, forgetCache, hasOfflineData } from './offline-cache'
import { App } from './App'
import { ProductRoutes } from './calendar/ProductRoutes'

const signInClass = 'min-h-touch-lg cursor-pointer rounded-md border-0 bg-accent px-6 text-base font-semibold text-on-accent hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-55'

/** Sin una clave válida no hay con qué iniciar sesión: la persona ve el botón apagado y el motivo queda en la consola de quien despliega. */
function Unconfigured({ reason }: { reason: string }) {
  console.warn(reason)
  return <App authentication={<button type="button" disabled className={signInClass}>Iniciar sesión</button>} />
}

/** La caché guardada solo sirve a la cuenta que la creó: se reclama al iniciar sesión y se borra al cerrarla. */
function CacheOwner() {
  const client = useQueryClient()
  const { user } = useUser()
  useEffect(() => { if (user) claimCache(client, user.id) }, [client, user])
  return null
}
function ForgetCache() {
  const client = useQueryClient()
  useEffect(() => { forgetCache(); client.clear() }, [client])
  return null
}

export function ClerkApp({ publishableKey }: { publishableKey?: string }) {
  const key = publishableKey?.trim()
  if (!key) return <Unconfigured reason="Clerk pendiente: configura VITE_CLERK_PUBLISHABLE_KEY." />
  // Only public identifiers belong in Vite. This checks configuration, not identity.
  if (!/^pk_(test|live)_[A-Za-z0-9+/=_-]+$/.test(key)) return <Unconfigured reason="Configuración de Clerk inválida: usa únicamente una clave publicable." />

  return (
    <ClerkProvider publishableKey={key} afterSignOutUrl="/" localization={esMX}>
      <Show when="signed-in"><CacheOwner /><ProductRoutes /></Show>
      <ClerkLoading><App authentication={<p role="status">Cargando autenticación…</p>} /></ClerkLoading>
      {/* Sin Clerk (por ejemplo, sin red) pero con datos guardados: se abre en solo lectura con lo último visto. */}
      <ClerkFailed>{hasOfflineData() ? <ProductRoutes /> : <App authentication={<p role="alert">No se pudo cargar Clerk. Recargá la página para reintentar.</p>} />}</ClerkFailed>
      <ClerkLoaded>
        <Show when="signed-out">
          <ForgetCache />
          <App authentication={
            <SignInButton mode="modal">
              <button type="button" className={signInClass}>Iniciar sesión</button>
            </SignInButton>
          } />
        </Show>
      </ClerkLoaded>
    </ClerkProvider>
  )
}
