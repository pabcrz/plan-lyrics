import { useEffect, useState } from 'react'
import { AppearanceSheet, Notice } from '../ui'
import { readAppearance, saveAppearance, setChurchAccent } from '../ui/appearance'
import { useChurch, useMyChurches } from './api'
import { useChurchColors } from './church-colors'

/** Iglesias de la persona con el color que las identifica en este dispositivo. */
export function useChurchChoices() {
  const mine = (useMyChurches().data ?? []).filter((item) => item.role)
  const colors = useChurchColors(mine.map((item) => item.id))
  return { choices: mine.map((item) => ({ id: item.id, name: item.name, accent: colors.toneId(item.id) })), set: colors.set, colors, several: mine.length > 1 }
}

/** Guarda el color de la iglesia activa; con «Según la iglesia» además lo aplica a toda la aplicación. */
export function ChurchAccentSync() {
  const activeId = useChurch().data?.id
  const { colors } = useChurchChoices()
  const accent = activeId ? colors.toneId(activeId) : undefined
  useEffect(() => { if (accent) setChurchAccent(accent) }, [accent])
  return null
}

/**
 * Inicial de la iglesia en la que se trabaja, junto a su nombre en el encabezado: con varias iglesias lleva el color de la iglesia aunque la
 * aplicación use un color fijo, así siempre se sabe en cuál se está. Con una sola, el del tema.
 */
export function ChurchBadge({ name }: { name?: string }) {
  const church = useChurch().data
  const { several, colors } = useChurchChoices()
  const look = several && church ? 'tone border border-[color:var(--tone-dot)] bg-[var(--tone-bg)] text-[var(--tone-fg)]' : 'bg-accent text-on-accent'
  return (
    <span aria-hidden="true" data-church-badge="" style={several && church ? colors.style(church.id) : undefined} className={`grid size-8 flex-none place-items-center rounded-md text-sm font-bold ${look}`}>
      {name?.charAt(0).toUpperCase() ?? ''}
    </span>
  )
}

/** Hoja de apariencia con la opción de color por iglesia cuando la persona tiene varias. */
export function ChurchAppearanceSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { choices, set, several } = useChurchChoices()
  return <AppearanceSheet open={open} onClose={onClose} churches={several ? choices : []} onChurchAccent={(id, accent) => set(id, accent)} />
}

const SEEN = 'plan-lyrics.seen.church-color'
const seen = () => { try { return localStorage.getItem(SEEN) !== null } catch { return true } }
const markSeen = () => { try { localStorage.setItem(SEEN, '1') } catch { /* sin almacenamiento, se vuelve a ofrecer */ } }

/** Se avisa una sola vez, a quien tiene varias iglesias, que la aplicación puede tomar el color de cada una. */
export function ChurchColorNotice() {
  const { several } = useChurchChoices()
  const [hidden, setHidden] = useState(seen)
  if (!several || hidden || readAppearance().byChurch) return null
  const close = () => { markSeen(); setHidden(true) }
  return (
    <Notice icon="palette" title="Un color para cada iglesia">
      Puedes hacer que toda la aplicación cambie de color según la iglesia en la que estés. Siempre verás el nombre de la iglesia arriba, y los colores se eligen en Apariencia.
      <div className="mt-2 flex gap-4">
        <button type="button" onClick={() => { saveAppearance({ ...readAppearance(), byChurch: true }); close() }} className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-accent underline">Activarlo</button>
        <button type="button" onClick={close} className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-text-2 underline">Ahora no</button>
      </div>
    </Notice>
  )
}
