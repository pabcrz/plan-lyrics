import { Button, Icon } from './ui'
import { useOnline, useUpdate } from './pwa'

/** Avisos de la aplicación instalada: versión nueva disponible y falta de conexión. */
export function StatusBars() {
  const { available, update } = useUpdate()
  const online = useOnline()
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
          <span className="min-w-0 flex-1">Sin conexión. Ves lo último guardado en este dispositivo; los cambios se hacen con conexión.</span>
        </div>
      )}
    </>
  )
}
