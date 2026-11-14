import { z } from 'zod'
import { isoDate } from './service-rules.js'

/** Pure rules of the preaching section; the routes only add access and persistence around them. */

export const TOPIC_MAX = 160
export const PASSAGES_MAX = 20
export const PASSAGE_MAX = 80
export const NOTES_MAX = 4000
export const NOTE_LINES_MAX = 100

// Control characters (except the line break), zero-width marks and bidirectional overrides carry no text
// and can disguise it: they are dropped before anything is stored.
function visible(char: string) {
  const code = char.codePointAt(0)!
  if (code === 0x0a) return true
  if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) return false
  return !(code >= 0x200b && code <= 0x200f) && !(code >= 0x202a && code <= 0x202e) && !(code >= 0x2060 && code <= 0x2064) && !(code >= 0x2066 && code <= 0x2069) && code !== 0xfeff
}
const cleaned = (text: string) => Array.from(text.replace(/\r\n?/g, '\n').replace(/\t/g, ' ')).filter(visible).join('')

/** One line of plain text: no line breaks, repeated spaces collapsed. */
export const singleLine = (text: string) => cleaned(text).replace(/\s+/g, ' ').trim()

/**
 * Notes keep the minimal format and nothing else: each line is trimmed, a bullet is a line that starts with `- `,
 * and a run of blank lines becomes one. Markers (`**bold**`, `__underline__`) stay as typed: the interface reads
 * them, the server never turns notes into markup.
 */
export function cleanNotes(text: string): string {
  const lines: string[] = []
  for (const raw of cleaned(text).split('\n')) {
    const line = raw.replace(/[^\S\n]+/g, ' ').trim()
    if (line === '' && (lines.length === 0 || lines[lines.length - 1] === '')) continue
    lines.push(line)
  }
  while (lines[lines.length - 1] === '') lines.pop()
  return lines.join('\n')
}

/** Bible references: one per line, plain text. Empty lines are dropped; the order is kept. */
export const cleanPassages = (items: readonly string[]) => items.flatMap(item => item.split(/\r?\n/)).map(singleLine).filter(Boolean)

const id = z.string().trim().min(1).max(64)

// The church is never part of the body: it is always the caller's active church. The whole section is replaced.
export const preachingBody = z.strictObject({
  preacherId: id.nullable(),
  topic: z.string().max(2000).transform(singleLine).pipe(z.string().max(TOPIC_MAX)),
  passages: z.array(z.string().max(2000)).max(60).transform(cleanPassages)
    .pipe(z.array(z.string().max(PASSAGE_MAX)).max(PASSAGES_MAX)),
  notes: z.string().max(20_000).transform(cleanNotes)
    .pipe(z.string().max(NOTES_MAX).refine(value => value === '' || value.split('\n').length <= NOTE_LINES_MAX)),
})
export type PreachingBody = z.infer<typeof preachingBody>

export const swapPreachingBody = z.strictObject({ first: id, second: id })

/** A section with nothing in it is not stored. */
export const isEmptyPreaching = (body: PreachingBody) =>
  body.preacherId === null && body.topic === '' && body.passages.length === 0 && body.notes === ''

/**
 * Notes are internal: whoever administers or edits services reads them, and so does the person assigned to
 * preach that service when they have an account. Being a preacher never grants more than that.
 */
export function canSeeNotes(viewer: { canEdit: boolean; personId: string | null }, preacherId: string | null) {
  return viewer.canEdit || (viewer.personId !== null && viewer.personId === preacherId)
}

/** Range of the printable document: real dates in order, at most a year (the same cap as a shared link). */
export const documentRange = z.strictObject({ from: isoDate, to: isoDate })
  .refine(range => range.from <= range.to && (Date.parse(range.to) - Date.parse(range.from)) / 86_400_000 < 366)
