import { useSyncExternalStore } from 'react'
import { notifyManager, useQueryClient, type Query } from '@tanstack/react-query'
import { Button, Icon } from './ui'
import { useOnline, useSwitchBlocked, useUpdate } from './pwa'

/** Hay algo guardado en pantalla cuyo último intento de actualizar falló. */
const stale = (query: Query) => query.state.status === 'error' && query.state.data !== undefined

/** Avisos de la aplicación instalada: versión nueva disponible y falta de conexión. */
export function StatusBars() {
  const { available, update } = useUpdate()
  const online = useOnline()
  const blocked = useSwitchBlocked()
  const client = useQueryClient()
  const outdated = useSyncExternalStore((listener) => client.getQueryCache().subscribe(notifyManager.batchCalls(listener)), () => client.getQueryCache().getAll().some(stale))
  return (
    <>
      {available && (
        <div role="status" className="flex items-center gap-3 border-b border-line bg-accent-soft px-4 py-2 text-sm text-accent-soft-text">
          <Icon name="info" className="flex-none" />
          <span className="min-w-0 flex-1">Hay una versión nueva de Plan &amp; Lyrics.</span>
          <Button variant="primary" onClick={update}>Actualizar</Button>
        </div>
      )}
      {!online && (
        <div role="status" className="flex items-center gap-3 border-b border-line bg-surface-2 px-4 py-2 text-sm text-text-2">
          <Icon name="info" className="flex-none" />
          <span className="min-w-0 flex-1">Sin conexión. Ves lo último guardado en este dispositivo; los cambios se hacen con conexión.{blocked && ' Para cambiar de iglesia necesitas conexión.'}</span>
        </div>
      )}
      {online && outdated && (
        <div role="status" className="flex items-center gap-3 border-b border-line bg-surface-2 px-4 py-2 text-sm text-text-2">
          <Icon name="info" className="flex-none" />
          <span className="min-w-0 flex-1">No se pudo actualizar. Ves lo último guardado.</span>
          <Button variant="secondary" onClick={() => void client.refetchQueries({ predicate: stale })}>Reintentar</Button>
        </div>
      )}
    </>
  )
}
