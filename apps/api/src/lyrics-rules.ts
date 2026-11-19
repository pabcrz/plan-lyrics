import { z } from 'zod'
import { CHORD_LIMITS, parseChordPro, parseKey, planTransposition, transposeChordPro } from './chord-rules.js'

export const LYRICS_LIMITS = { maxSections: 60, maxText: 4000, maxLabel: 60, maxRepeat: 8 } as const

/** Producto, etapa 2: intro, estrofa/verso, coro, puente, outro y cierre. */
export const SECTION_KINDS = ['INTRO', 'VERSE', 'CHORUS', 'BRIDGE', 'OUTRO', 'CLOSING'] as const

// Control characters other than the line break are refused (the text is later rendered by other clients).
const hasControl = (value: string) => [...value].some(char => { const code = char.charCodeAt(0); return code === 0x7f || (code < 0x20 && code !== 0x0a) })

const normalize = (value: string) => value.replace(/\r\n?/g, '\n').split('\n').map(line => line.trim()).join('\n').trim()
const text = z.string()
  .transform(normalize)
  .pipe(z.string().min(1).max(LYRICS_LIMITS.maxText).refine(value => !hasControl(value)))

// An empty label means «no label».
const label = z.string()
  .transform(value => value.trim().replace(/\s+/g, ' ') || null)
  .pipe(z.string().max(LYRICS_LIMITS.maxLabel).refine(value => !hasControl(value)).nullable())

/**
 * A section may carry its chords inline (`chordPro`, ChordPro marks like `[Am]`). The clean `text` is then derived from
 * it, and a `text` that is also sent must be exactly that: the two can never disagree. A chordPro without any mark is
 * stored as plain text (`null`). Omitting `chordPro` (`undefined`) is not the same as sending `null`: a client that
 * does not know about chords keeps the ones its unchanged text already has (see `lyrics.ts`), `null` removes them.
 */
const section = z.strictObject({
  kind: z.enum(SECTION_KINDS),
  label: label.nullish().transform(value => value ?? null),
  text: z.string().optional(),
  chordPro: z.string().nullish(),
  repeat: z.number().int().min(1).max(LYRICS_LIMITS.maxRepeat).default(1),
}).transform((value, context) => {
  const fail = () => { context.addIssue({ code: 'custom', message: 'Invalid section' }); return z.NEVER }
  let chordPro: string | null | undefined = value.chordPro === null ? null : undefined
  let candidate = value.text
  if (value.chordPro !== undefined && value.chordPro !== null) {
    const source = normalize(value.chordPro)
    const parsed = parseChordPro(source)
    if (!source || source.length > CHORD_LIMITS.maxChordPro || hasControl(source) || !parsed.ok) return fail()
    const derived = normalize(parsed.text)
    if (value.text !== undefined && normalize(value.text) !== derived) return fail()
    candidate = derived
    chordPro = parsed.chords.length > 0 ? source : null
  }
  const clean = text.safeParse(candidate)
  return clean.success ? { kind: value.kind, label: value.label, text: clean.data, chordPro, repeat: value.repeat } : fail()
})

const lyricsKey = z.string().refine(value => parseKey(value) !== null)

/**
 * Replaces the whole lyrics of a song. `version` is the one the client read (0 when none exists yet); the sections,
 * in order, are the order of the song. `published` is optional: absent keeps the stored value (false for a new lyrics).
 */
export const lyricsBody = z.strictObject({
  version: z.number().int().min(0),
  sections: z.array(section).max(LYRICS_LIMITS.maxSections),
  published: z.boolean().optional(),
  // The tonality of the chorded text (internal data, never public). Absent keeps the stored one; null clears it.
  key: lyricsKey.nullable().optional(),
}).refine(body => body.published !== true || body.sections.length > 0)

export type LyricsBody = z.infer<typeof lyricsBody>
export type StoredLyrics = { published: boolean; key?: string | null; sections: Array<{ kind: (typeof SECTION_KINDS)[number]; label: string | null; text: string; chordPro?: string | null; repeat: number; position: number }> }

/**
 * What the public view may show of a lyrics: only a published one, and only the fields below. A missing lyrics,
 * an unpublished one and a published one without sections are indistinguishable (`null`).
 */
export function publicLyrics(lyrics: StoredLyrics | null | undefined) {
  if (!lyrics?.published || lyrics.sections.length === 0) return null
  return [...lyrics.sections].sort((a, b) => a.position - b.position).map(item => ({ kind: item.kind, label: item.label, text: item.text, repeat: item.repeat }))
}

/**
 * Optional transposition of a read: `semitones` (a signed integer) or `toKey`, never both. Only these two query
 * parameters are looked at; nothing asked is `request: null`.
 */
export function transposeQuery(query: Record<string, string | undefined>) {
  const parsed = z.strictObject({
    semitones: z.string().regex(/^-?\d{1,2}$/).transform(Number).optional(),
    toKey: z.string().refine(value => parseKey(value) !== null).optional(),
  }).refine(value => value.semitones === undefined || value.toKey === undefined)
    .safeParse({ semitones: query.semitones, toKey: query.toKey })
  if (!parsed.success) return { ok: false as const }
  const { semitones, toKey } = parsed.data
  return { ok: true as const, request: semitones !== undefined ? { semitones } : toKey !== undefined ? { toKey } : null }
}

/**
 * The chords and the key of a lyrics moved as requested, as a pure calculation (nothing is stored). `null` when it
 * cannot be done (a target key without a stored one, or of another mode). Stored chords were validated when saved:
 * finding an invalid one is a defect, not a client error, so it throws.
 */
export function transposeLyrics<T extends { chordPro: string | null }>(key: string | null, sections: T[], request: { semitones?: number; toKey?: string }) {
  const plan = planTransposition(key, request, sections.flatMap(item => item.chordPro === null ? [] : [item.chordPro]))
  if (!plan.ok) return null
  return {
    key: plan.key, semitones: plan.semitones,
    sections: sections.map(item => {
      if (item.chordPro === null) return item
      const moved = transposeChordPro(item.chordPro, plan.semitones, plan.spelling)
      if (moved === null) throw new Error('Stored chords are invalid')
      return { ...item, chordPro: moved }
    }),
  }
}
