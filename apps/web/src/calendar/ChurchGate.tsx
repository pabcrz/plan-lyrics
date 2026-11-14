import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { UserButton } from '@clerk/react'
import { Button, Icon, Notice, Sheet, Tabbar } from '../ui'
import { AccountsLink } from '../access/AccessLinks'
import { ApiError, useChurch } from './api'
import type { Church } from './model'

/** Encabezado común: iglesia activa y cuenta. */
export function TopBar({ name, settings, share }: { name?: string; settings?: boolean; share?: boolean }) {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-14 items-center gap-3 border-b border-line px-4">
      <span className="grid size-8 place-items-center rounded-md bg-accent text-sm font-bold text-on-accent" aria-hidden="true">
        {name?.charAt(0).toUpperCase() ?? ''}
      </span>
      <span className="flex-1 font-semibold">{name ?? 'Plan & Lyrics'}</span>
      {share && <Button variant="quiet" icon aria-label="Compartir" onClick={() => void navigate('/compartir')}><Icon name="share" /></Button>}
      {settings && <Button variant="quiet" onClick={() => void navigate('/ajustes')}>Ajustes</Button>}
      <UserButton />
    </div>
  )
}

/** Navegación inferior principal: Calendario, Nuevo (solo quien edita) y Personas. */
export function MainTabbar({ church, current }: { church: Pick<Church, 'canEdit'>; current: 'calendar' | 'people' }) {
  const navigate = useNavigate()
  const [choosing, setChoosing] = useState(false)
  const option = (label: string, hint: string, path: string) => (
    <button type="button" onClick={() => void navigate(path)}
      className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 border-0 border-b border-line bg-transparent px-4 text-left last:border-b-0 hover:bg-surface-2">
      <span className="font-semibold">{label}<small className="block font-normal text-text-3">{hint}</small></span>
      <Icon name="right" />
    </button>
  )
  return (
    <div className="sticky bottom-0">
      <Tabbar label="Principal" current={current} onSelect={(id) => void navigate(id === 'people' ? '/personas' : '/')}
        items={[{ id: 'calendar', label: 'Calendario', icon: 'calendar' }, { id: 'people', label: 'Personas', icon: 'users' }]}
        action={church.canEdit ? { label: 'Nuevo', icon: 'plus', onAction: () => setChoosing(true) } : undefined} />
      <Sheet open={choosing} onClose={() => setChoosing(false)} title="Nuevo">
        <div className="overflow-hidden rounded-lg border border-line">
          {option('Servicio individual', 'Una fecha, con su director.', '/servicios/nuevo')}
          {option('Lote mensual', 'Varios servicios de un mes con una lista de directores.', '/servicios/lote')}
        </div>
      </Sheet>
    </div>
  )
}

/** Encabezado de una pantalla secundaria; vuelve al calendario salvo que se indique otro destino. */
export function PageHeader({ title, back = '/', backLabel = 'Volver al calendario' }: { title: string; back?: string; backLabel?: string }) {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-14 items-center gap-1 border-b border-line px-2">
      <Button variant="quiet" icon aria-label={backLabel} onClick={() => void navigate(back)}><Icon name="right" className="-scale-x-100" /></Button>
      <h1 className="m-0 font-display text-lg font-bold">{title}</h1>
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
        {status === 404 && <AccountsLink />}
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
