import { useState } from 'react'
import { accents, modes, readAppearance, saveAppearance, type Appearance } from './appearance'
import { Segmented } from './Segmented'
import { Sheet } from './Sheet'

/** Colores de muestra de cada acento (el mismo tono que usa el tema). */
const swatch: Record<(typeof accents)[number]['value'], string> = {
  salvia: 'oklch(0.6 0.085 178)', indigo: 'oklch(0.6 0.15 272)', ocre: 'oklch(0.6 0.105 62)', azul: 'oklch(0.6 0.11 235)', granate: 'oklch(0.55 0.13 15)',
}

export function AppearanceSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [appearance, setAppearance] = useState<Appearance>(readAppearance)
  const change = (patch: Partial<Appearance>) => { const next = { ...appearance, ...patch }; setAppearance(next); saveAppearance(next) }
  return (
    <Sheet open={open} onClose={onClose} title="Apariencia">
      <div className="grid gap-5">
        <Segmented label="Modo" value={appearance.mode} onChange={(mode) => change({ mode })} options={modes} />
        <fieldset className="m-0 grid gap-2 border-0 p-0">
          <legend className="mb-1.5 text-sm font-semibold">Color</legend>
          <div className="flex flex-wrap gap-2">
            {accents.map((accent) => (
              <button key={accent.value} type="button" aria-pressed={appearance.accent === accent.value} onClick={() => change({ accent: accent.value })}
                className="flex min-h-touch cursor-pointer items-center gap-2 rounded-md border border-line-strong bg-surface px-3 text-sm font-semibold aria-pressed:border-accent aria-pressed:bg-accent-soft">
                <span aria-hidden="true" className="size-4 rounded-full" style={{ background: swatch[accent.value] }} />{accent.label}
              </button>
            ))}
          </div>
        </fieldset>
        <p className="m-0 text-[0.8125rem] text-text-3">Se guarda en este dispositivo y solo cambia cómo lo ves tú.</p>
      </div>
    </Sheet>
  )
}
