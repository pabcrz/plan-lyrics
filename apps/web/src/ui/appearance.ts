/** Apariencia por persona y por dispositivo: acento y modo, guardados en el navegador y aplicados en <html>. */
export const accents = [
  { value: 'azul', label: 'Azul' },
  { value: 'salvia', label: 'Salvia' },
  { value: 'indigo', label: 'Índigo' },
  { value: 'ocre', label: 'Ocre' },
  { value: 'granate', label: 'Granate' },
] as const
export const modes = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
] as const

export type Accent = (typeof accents)[number]['value']
export type Mode = (typeof modes)[number]['value']
/** `byChurch`: el color de toda la aplicación sigue a la iglesia activa; si no, `accent` es fijo para todas. */
export type Appearance = { accent: Accent; mode: Mode; byChurch: boolean }

const KEY = 'plan-lyrics.appearance'
const fallback: Appearance = { accent: 'azul', mode: 'system', byChurch: false }
const CHURCH_KEY = 'plan-lyrics.churchAccent'
const valid = <T extends string>(options: ReadonlyArray<{ value: T }>, value: unknown): value is T => options.some((option) => option.value === value)

/** El almacenamiento puede faltar o fallar (modo privado): sin él se usa la apariencia predeterminada. */
export function readAppearance(): Appearance {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Appearance> | null
    return { accent: valid(accents, stored?.accent) ? stored.accent : fallback.accent, mode: valid(modes, stored?.mode) ? stored.mode : fallback.mode, byChurch: stored?.byChurch === true }
  } catch {
    return fallback
  }
}

const prefersDark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches

/** Último color de iglesia que se usó en este dispositivo: la app arranca ya con él, sin esperar a saber cuál es la iglesia activa. */
function lastChurchAccent(): Accent | undefined {
  try { const stored = localStorage.getItem(CHURCH_KEY); return valid(accents, stored) ? stored : undefined } catch { return undefined }
}

export const effectiveAccent = ({ accent, byChurch }: Appearance): Accent => (byChurch ? lastChurchAccent() ?? accent : accent)

/** Guarda el color de la iglesia activa y, si la persona eligió «Según la iglesia», lo aplica. */
export function setChurchAccent(accent: Accent) {
  try { localStorage.setItem(CHURCH_KEY, accent) } catch { /* sin almacenamiento solo cambia en esta sesión */ }
  applyAppearance(readAppearance())
}

export function applyAppearance(appearance: Appearance) {
  const { mode } = appearance
  const root = document.documentElement
  root.dataset.accent = effectiveAccent(appearance)
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
