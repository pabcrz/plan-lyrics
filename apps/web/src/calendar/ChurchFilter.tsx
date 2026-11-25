import { useState, useSyncExternalStore } from 'react'
import { Icon, Notice, Sheet } from '../ui'
import { cx } from '../ui/cx'
import { CHURCH_TONES, toneStyle, useChurchColors } from './church-colors'

type Item = { id: string; name: string }

/**
 * Filtro del inicio para quien está en varias iglesias: «Todas» reúne los próximos servicios de todas; elegir una iglesia la convierte
 * en la iglesia activa de toda la aplicación. El color de cada iglesia solo existe en «Todas», para reconocerlas de un vistazo.
 */
export function ChurchFilter({ churches, activeId, all, onAll, onPick }: {
  churches: ReadonlyArray<Item>; activeId: string | undefined; all: boolean; onAll: () => void; onPick: (id: string) => void
}) {
  const colors = useChurchColors(churches.map((item) => item.id))
  const [coloring, setColoring] = useState(false)
  const chip = 'inline-flex min-h-11 flex-none cursor-pointer items-center gap-2 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap'
  return (
    <>
      <div className="flex min-w-0 items-center gap-1.5">
        <div role="group" aria-label="Iglesia" className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-1">
          <button type="button" aria-pressed={all} onClick={onAll}
            className={cx(chip, all ? 'border-accent bg-accent text-on-accent' : 'border-line-strong bg-surface text-text hover:bg-surface-2')}>Todas</button>
          {churches.map((item) => {
            const active = !all && item.id === activeId
            return (
              <button key={item.id} type="button" aria-pressed={active} onClick={() => onPick(item.id)}
                className={cx(chip, active ? 'border-accent bg-accent text-on-accent' : 'border-line-strong bg-surface text-text hover:bg-surface-2')}>
                {all && <span aria-hidden="true" className="tone size-2.5 flex-none rounded-full bg-[var(--tone-dot)]" style={colors.style(item.id)} />}
                {item.name}
              </button>
            )
          })}
        </div>
        {all && (
          <button type="button" aria-label="Colores de las iglesias" title="Colores de las iglesias" onClick={() => setColoring(true)}
            className="grid size-11 flex-none cursor-pointer place-items-center rounded-full border border-line-strong bg-surface text-text hover:bg-surface-2"><Icon name="palette" width={18} height={18} /></button>
        )}
      </div>
      <Sheet open={coloring} onClose={() => setColoring(false)} title="Color de cada iglesia">
        <div className="grid gap-4">
          <p className="m-0 text-sm text-text-2">Cada iglesia toma el color de uno de los temas de la aplicación en la vista «Todas», para reconocerla de un vistazo. Se guarda en este dispositivo.</p>
          {churches.map((item) => (
            <div key={item.id} role="group" aria-label={`Color de ${item.name}`} className="grid gap-2">
              <span className="font-semibold">{item.name}</span>
              <div className="flex flex-wrap gap-2">
                {CHURCH_TONES.map((tone) => {
                  const chosen = colors.toneId(item.id) === tone.id
                  return (
                    <button key={tone.id} type="button" aria-label={tone.name} aria-pressed={chosen} onClick={() => colors.set(item.id, tone.id)}
                      className={cx('tone inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 bg-[var(--tone-bg)] px-3.5 text-sm font-semibold text-[var(--tone-fg)]', chosen ? 'border-[var(--tone-ink)]' : 'border-transparent')}
                      style={toneStyle(tone)}>
                      <span aria-hidden="true" className="size-3 rounded-full bg-[var(--tone-dot)]" />{tone.name}{chosen && <Icon name="check" width={16} height={16} />}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </Sheet>
    </>
  )
}

const SEEN = 'plan-lyrics.seen.church-switch'
// Al cambiar de iglesia el inicio se vuelve a montar mientras carga la nueva: el aviso vive fuera del componente para no perderse.
let pending = false
const listeners = new Set<() => void>()
const setPending = (value: boolean) => { pending = value; listeners.forEach((listener) => listener()) }

/** Se avisa una sola vez, al elegir una iglesia por primera vez, que toda la aplicación pasa a ser de esa iglesia. */
export function useSwitchNotice() {
  const shown = useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener) } }, () => pending)
  return {
    shown,
    announce: () => {
      try { if (localStorage.getItem(SEEN) !== null) return; localStorage.setItem(SEEN, '1') } catch { return }
      setPending(true)
    },
    dismiss: () => setPending(false),
  }
}

export function SwitchNotice({ name, onClose }: { name: string; onClose: () => void }) {
  return (
    <Notice icon="info" title={`Ahora trabajas en ${name}`}>
      El calendario, las canciones, las personas, las predicaciones, compartir, participaciones y ajustes son de esta iglesia. «Todas» solo reúne los próximos servicios y no cambia en cuál estás.
      <div className="mt-2"><button type="button" onClick={onClose} className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-accent underline">Entendido</button></div>
    </Notice>
  )
}
