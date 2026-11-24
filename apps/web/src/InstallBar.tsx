import { Button, Icon } from './ui'
import { useInstall } from './install'

/** Franja para instalar la aplicación en el dispositivo; se puede posponer y desaparece sola una vez instalada. */
export function InstallBar() {
  const { offer, install, postpone } = useInstall()
  if (!offer) return null
  return (
    <div role="region" aria-label="Instalar la aplicación" className="flex items-center gap-3 border-b border-line bg-accent-soft px-4 py-2 text-sm text-accent-soft-text">
      <Icon name="home" className="flex-none" />
      <span className="min-w-0 flex-1">
        {offer === 'prompt'
          ? 'Instala Plan & Lyrics en tu dispositivo: se abre como una app y carga más rápido.'
          : 'Para instalar Plan & Lyrics, toca Compartir y luego «Añadir a pantalla de inicio».'}
      </span>
      {offer === 'prompt' && <Button variant="primary" onClick={() => void install()}>Instalar</Button>}
      <Button variant="quiet" onClick={postpone}>Ahora no</Button>
    </div>
  )
}
