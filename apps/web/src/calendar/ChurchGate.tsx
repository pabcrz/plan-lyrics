import type { ReactNode } from 'react'
import { UserButton } from '@clerk/react'
import { Button, Notice } from '../ui'
import { ApiError, useChurch } from './api'
import type { Church } from './model'

/** Encabezado común: iglesia activa y cuenta. */
export function TopBar({ name }: { name?: string }) {
  return (
    <div className="flex min-h-14 items-center gap-3 border-b border-line px-4">
      <span className="grid size-8 place-items-center rounded-md bg-accent text-sm font-bold text-on-accent" aria-hidden="true">
        {name?.charAt(0).toUpperCase() ?? ''}
      </span>
      <span className="flex-1 font-semibold">{name ?? 'Plan & Lyrics'}</span>
      <UserButton />
    </div>
  )
}

/** Resuelve la iglesia activa (la decide el servidor) y muestra carga, vacío o error antes del contenido. */
export function ChurchGate({ children }: { children: (church: Church) => ReactNode }) {
  const church = useChurch()
  if (church.data) return <>{children(church.data)}</>
  const status = church.error instanceof ApiError ? church.error.status : 0
  return (
    <main className="min-h-dvh">
      <TopBar />
      <div className="grid gap-4 p-4">
        {church.isPending && <p role="status">Cargando tu iglesia…</p>}
        {status === 404 && <Notice title="Sin iglesia asignada">Tu cuenta todavía no pertenece a ninguna iglesia. Pide acceso a quien la administra.</Notice>}
        {status === 409 && <Notice title="Varias iglesias">Tu cuenta pertenece a más de una iglesia y elegir la activa aún no está disponible.</Notice>}
        {church.isError && status !== 404 && status !== 409 && (
          <>
            <Notice tone="warn" icon="alert" role="alert" title="No se pudo cargar tu iglesia">Revisa tu conexión e inténtalo de nuevo.</Notice>
            <Button variant="secondary" onClick={() => void church.refetch()}>Reintentar</Button>
          </>
        )}
      </div>
    </main>
  )
}
