import { z } from 'zod'

export const LYRICS_LIMITS = { maxSections: 60, maxText: 4000, maxLabel: 60, maxRepeat: 8 } as const

/** Producto, etapa 2: intro, estrofa/verso, coro, puente, outro y cierre. */
export const SECTION_KINDS = ['INTRO', 'VERSE', 'CHORUS', 'BRIDGE', 'OUTRO', 'CLOSING'] as const

// Control characters other than the line break are refused (the text is later rendered by other clients).
const hasControl = (value: string) => [...value].some(char => { const code = char.charCodeAt(0); return code === 0x7f || (code < 0x20 && code !== 0x0a) })

const text = z.string()
  .transform(value => value.replace(/\r\n?/g, '\n').split('\n').map(line => line.trim()).join('\n').trim())
  .pipe(z.string().min(1).max(LYRICS_LIMITS.maxText).refine(value => !hasControl(value)))

// An empty label means «no label».
const label = z.string()
  .transform(value => value.trim().replace(/\s+/g, ' ') || null)
  .pipe(z.string().max(LYRICS_LIMITS.maxLabel).refine(value => !hasControl(value)).nullable())

const section = z.strictObject({
  kind: z.enum(SECTION_KINDS),
  label: label.nullish().transform(value => value ?? null),
  text,
  repeat: z.number().int().min(1).max(LYRICS_LIMITS.maxRepeat).default(1),
})

/**
 * Replaces the whole lyrics of a song. `version` is the one the client read (0 when none exists yet); the sections,
 * in order, are the order of the song. `published` is optional: absent keeps the stored value (false for a new lyrics).
 */
export const lyricsBody = z.strictObject({
  version: z.number().int().min(0),
  sections: z.array(section).max(LYRICS_LIMITS.maxSections),
  published: z.boolean().optional(),
}).refine(body => body.published !== true || body.sections.length > 0)

export type LyricsBody = z.infer<typeof lyricsBody>
export type StoredLyrics = { published: boolean; sections: Array<{ kind: (typeof SECTION_KINDS)[number]; label: string | null; text: string; repeat: number; position: number }> }

/**
 * What the public view may show of a lyrics: only a published one, and only the fields below. A missing lyrics,
 * an unpublished one and a published one without sections are indistinguishable (`null`).
 */
export function publicLyrics(lyrics: StoredLyrics | null | undefined) {
  if (!lyrics?.published || lyrics.sections.length === 0) return null
  return [...lyrics.sections].sort((a, b) => a.position - b.position).map(item => ({ kind: item.kind, label: item.label, text: item.text, repeat: item.repeat }))
}
