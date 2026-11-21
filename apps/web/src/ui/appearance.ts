/** Apariencia por persona y por dispositivo: acento y modo, guardados en el navegador y aplicados en <html>. */
export const accents = [
  { value: 'salvia', label: 'Salvia' },
  { value: 'indigo', label: 'Índigo' },
  { value: 'ocre', label: 'Ocre' },
  { value: 'azul', label: 'Azul' },
  { value: 'granate', label: 'Granate' },
] as const
export const modes = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
] as const

export type Accent = (typeof accents)[number]['value']
export type Mode = (typeof modes)[number]['value']
export type Appearance = { accent: Accent; mode: Mode }

const KEY = 'plan-lyrics.appearance'
const fallback: Appearance = { accent: 'salvia', mode: 'system' }
const valid = <T extends string>(options: ReadonlyArray<{ value: T }>, value: unknown): value is T => options.some((option) => option.value === value)

/** El almacenamiento puede faltar o fallar (modo privado): sin él se usa la apariencia predeterminada. */
export function readAppearance(): Appearance {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Appearance> | null
    return { accent: valid(accents, stored?.accent) ? stored.accent : fallback.accent, mode: valid(modes, stored?.mode) ? stored.mode : fallback.mode }
  } catch {
    return fallback
  }
}

const prefersDark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches

export function applyAppearance({ accent, mode }: Appearance) {
  const root = document.documentElement
  root.dataset.accent = accent
  root.dataset.mode = mode === 'system' ? (prefersDark() ? 'dark' : 'light') : mode
}

export function saveAppearance(appearance: Appearance) {
  try { localStorage.setItem(KEY, JSON.stringify(appearance)) } catch { /* se aplica igual en esta sesión */ }
  applyAppearance(appearance)
}

/** Aplica lo guardado al arrancar y sigue al sistema mientras el modo sea «Sistema». */
export function initAppearance() {
  applyAppearance(readAppearance())
  if (typeof matchMedia === 'function') matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyAppearance(readAppearance()))
}
