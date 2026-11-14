/** Reglas puras de la predicación en la interfaz; el servidor vuelve a validar y sanear todo. */

/** Mismos límites que la API (`preaching-rules.ts`): se avisan antes de enviar, nunca se recorta en silencio. */
export const LIMITS = { topic: 160, passages: 20, passage: 80, notes: 4000, noteLines: 100 } as const

export type Span = { text: string; bold: boolean; underline: boolean }
export type NoteBlock = { kind: 'bullet' | 'text' | 'gap'; spans: Span[] }

/**
 * `**negrita**` y `__subrayado__` dentro de una línea. Un marcador sin pareja en la misma línea se muestra
 * tal cual: nunca se interpreta nada más (ni HTML ni enlaces).
 */
export function parseInline(line: string): Span[] {
  const spans: Span[] = []
  let bold = false
  let underline = false
  let text = ''
  const flush = () => {
    if (text) spans.push({ text, bold, underline })
    text = ''
  }
  let index = 0
  while (index < line.length) {
    const mark = line.startsWith('**', index) ? '**' : line.startsWith('__', index) ? '__' : null
    if (mark && ((mark === '**' ? bold : underline) || line.indexOf(mark, index + 2) > -1)) {
      flush()
      if (mark === '**') bold = !bold
      else underline = !underline
      index += 2
    } else {
      text += line[index]
      index += 1
    }
  }
  flush()
  return spans
}

/** Las notas, línea por línea: viñeta (`- `), texto o línea en blanco. */
export function parseNotes(notes: string): NoteBlock[] {
  return notes.split(/\r?\n/).map((line): NoteBlock => {
    if (line.trim() === '') return { kind: 'gap', spans: [] }
    return line.startsWith('- ') ? { kind: 'bullet', spans: parseInline(line.slice(2)) } : { kind: 'text', spans: parseInline(line) }
  })
}

export const passagesText = (passages: ReadonlyArray<string>) => passages.join('\n')
/** Una cita por línea, sin líneas vacías ni espacios repetidos; el texto no se interpreta. */
export const textPassages = (text: string) => text.split(/\r?\n/).map((line) => line.trim().replace(/\s+/g, ' ')).filter(Boolean)

export type PreachingForm = { preacherId: string | null; topic: string; passages: string; notes: string }
type Field = 'topic' | 'passages' | 'notes'

/** Campos que exceden un límite, para mostrar el error junto a cada uno. */
export function formIssues(form: PreachingForm): Partial<Record<Field, string>> {
  const issues: Partial<Record<Field, string>> = {}
  if (form.topic.trim().replace(/\s+/g, ' ').length > LIMITS.topic) issues.topic = `Máximo ${LIMITS.topic} caracteres.`
  const passages = textPassages(form.passages)
  if (passages.length > LIMITS.passages) issues.passages = `Máximo ${LIMITS.passages} citas.`
  else if (passages.some((passage) => passage.length > LIMITS.passage)) issues.passages = `Cada cita admite hasta ${LIMITS.passage} caracteres.`
  const notes = form.notes.trim()
  if (notes.length > LIMITS.notes) issues.notes = `Máximo ${LIMITS.notes} caracteres.`
  else if (notes.split(/\r?\n/).length > LIMITS.noteLines) issues.notes = `Máximo ${LIMITS.noteLines} líneas.`
  return issues
}
