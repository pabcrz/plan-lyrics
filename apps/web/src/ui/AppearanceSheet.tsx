import { useState } from 'react'
import { accents, modes, readAppearance, saveAppearance, type Accent, type Appearance } from './appearance'
import { Segmented } from './Segmented'
import { Sheet } from './Sheet'

/** Colores de muestra de cada acento (el mismo tono que usa el tema). */
const swatch: Record<(typeof accents)[number]['value'], string> = {
  salvia: 'oklch(0.6 0.085 178)', indigo: 'oklch(0.6 0.15 272)', ocre: 'oklch(0.6 0.105 62)', azul: 'oklch(0.6 0.11 235)', granate: 'oklch(0.55 0.13 15)',
}

/** Una iglesia de la persona y el color que la identifica; solo se ofrece con dos o más. */
export type ChurchChoice = { id: string; name: string; accent: Accent }

export function AppearanceSheet({ open, onClose, churches = [], onChurchAccent }: {
  open: boolean; onClose: () => void; churches?: ReadonlyArray<ChurchChoice>; onChurchAccent?: (id: string, accent: Accent) => void
}) {
  const [appearance, setAppearance] = useState<Appearance>(readAppearance)
  const change = (patch: Partial<Appearance>) => { const next = { ...readAppearance(), ...patch }; setAppearance(next); saveAppearance(next) }
  const several = churches.length > 1 && onChurchAccent !== undefined
  const byChurch = several && appearance.byChurch
  const swatches = (selected: Accent, pick: (accent: Accent) => void, name: string) => (
    <div role="group" aria-label={name} className="flex flex-wrap gap-2">
      {accents.map((accent) => (
        <button key={accent.value} type="button" aria-pressed={selected === accent.value} onClick={() => pick(accent.value)}
          className="flex min-h-touch cursor-pointer items-center gap-2 rounded-md border border-line-strong bg-surface px-3 text-sm font-semibold aria-pressed:border-accent aria-pressed:bg-accent-soft">
          <span aria-hidden="true" className="size-4 rounded-full" style={{ background: swatch[accent.value] }} />{accent.label}
        </button>
      ))}
    </div>
  )
  return (
    <Sheet open={open} onClose={onClose} title="Apariencia">
      <div className="grid gap-5">
        <Segmented label="Modo" value={appearance.mode} onChange={(mode) => change({ mode })} options={modes} />
        {several && (
          <Segmented label="Color de la aplicación" value={appearance.byChurch ? 'church' : 'fixed'} onChange={(value) => change({ byChurch: value === 'church' })}
            options={[{ value: 'fixed', label: 'Fijo' }, { value: 'church', label: 'Según la iglesia' }]} />
        )}
        {byChurch ? (
          <fieldset className="m-0 grid gap-3 border-0 p-0">
            <legend className="mb-1.5 text-sm font-semibold">Color de cada iglesia</legend>
            <p className="m-0 text-[0.8125rem] text-text-3">Al cambiar de iglesia, toda la aplicación toma su color. El nombre de la iglesia siempre se ve arriba.</p>
            {churches.map((church) => (
              <div key={church.id} className="grid gap-1.5">
                <span className="text-sm font-medium">{church.name}</span>
                {swatches(church.accent, (accent) => onChurchAccent?.(church.id, accent), `Color de ${church.name}`)}
              </div>
            ))}
          </fieldset>
        ) : (
          <fieldset className="m-0 grid gap-2 border-0 p-0">
            <legend className="mb-1.5 text-sm font-semibold">{several ? 'Color fijo' : 'Color'}</legend>
            {swatches(appearance.accent, (accent) => change({ accent }), 'Color')}
          </fieldset>
        )}
        <p className="m-0 text-[0.8125rem] text-text-3">Se guarda en este dispositivo y solo cambia cómo lo ves tú.</p>
      </div>
    </Sheet>
  )
}
