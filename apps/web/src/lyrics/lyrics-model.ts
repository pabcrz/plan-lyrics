/** Tipos de sección que nombra el producto; el servidor vuelve a validarlos. */
export type SectionKind = 'INTRO' | 'VERSE' | 'CHORUS' | 'BRIDGE' | 'OUTRO' | 'CLOSING'

export const kinds: ReadonlyArray<{ value: SectionKind; label: string }> = [
  { value: 'INTRO', label: 'Intro' },
  { value: 'VERSE', label: 'Estrofa' },
  { value: 'CHORUS', label: 'Coro' },
  { value: 'BRIDGE', label: 'Puente' },
  { value: 'OUTRO', label: 'Outro' },
  { value: 'CLOSING', label: 'Cierre' },
]

export const kindLabel = (kind: SectionKind) => kinds.find((item) => item.value === kind)?.label ?? kind

/** Mismos límites que la API (`LYRICS_LIMITS`). */
export const limits = { maxSections: 60, maxText: 4000, maxLabel: 60, maxRepeat: 8 } as const

export type Section = { kind: SectionKind; label: string | null; text: string; repeat: number }
export type Lyrics = { version: number; published: boolean; canEdit: boolean; sections: Section[] }

/** Sección en edición: `key` identifica la tarjeta aunque cambie de lugar. */
export type DraftSection = { key: string; kind: SectionKind; label: string; text: string; repeat: number }

let counter = 0
export const newKey = () => `s${(counter += 1)}`

export const toDraft = (sections: Section[]): DraftSection[] =>
  sections.map((section) => ({ key: newKey(), kind: section.kind, label: section.label ?? '', text: section.text, repeat: section.repeat }))

export const blankSection = (): DraftSection => ({ key: newKey(), kind: 'VERSE', label: '', text: '', repeat: 1 })

/** El servidor rechaza los caracteres de control salvo el salto de línea: una tabulación pegada pasa a ser un espacio. */
export function cleanText(text: string) {
  return [...text.replace(/\r\n?/g, '\n')].map((char) => { const code = char.charCodeAt(0); return code === 0x7f || (code < 0x20 && code !== 0x0a) ? ' ' : char }).join('')
}

export const hasText = (section: DraftSection) => cleanText(section.text).trim() !== ''

/** Cuerpo del reemplazo completo; sin secciones no se puede publicar. */
export function toBody(version: number, sections: DraftSection[], published: boolean) {
  return {
    version,
    published: published && sections.length > 0,
    sections: sections.map((section): Section => ({ kind: section.kind, label: cleanText(section.label).trim() || null, text: cleanText(section.text), repeat: section.repeat })),
  }
}

/** ¿Hay cambios respecto a lo cargado? Compara el contenido, no las claves de las tarjetas. */
export function changed(initial: { sections: Section[]; published: boolean }, sections: DraftSection[], published: boolean) {
  const body = toBody(0, sections, published)
  const before = initial.sections
  if (body.published !== initial.published || body.sections.length !== before.length) return true
  return body.sections.some((section, index) => {
    const original = before[index]
    return section.kind !== original.kind || section.repeat !== original.repeat || section.text !== original.text || section.label !== (original.label?.trim() || null)
  })
}

export function moveItem<T>(items: T[], from: number, to: number) {
  const next = [...items]
  next.splice(to, 0, ...next.splice(from, 1))
  return next
}

/** Estado de navegación que deja el setlist: título de la canción y a dónde volver (solo rutas internas). */
export type LyricsNav = { title?: string; back?: string; saved?: boolean }

export function navState(state: unknown): LyricsNav {
  if (typeof state !== 'object' || state === null) return {}
  const { title, back, saved } = state as Record<string, unknown>
  return {
    title: typeof title === 'string' && title.trim() ? title.slice(0, 200) : undefined,
    back: typeof back === 'string' && /^\/(?![/\\])/.test(back) ? back : undefined,
    saved: saved === true,
  }
}
