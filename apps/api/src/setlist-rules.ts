import { z } from 'zod'

export const MAX_ENTRIES = 100
/** Moves every position out of the way while a setlist is renumbered (never reached by MAX_ENTRIES). */
export const POSITION_OFFSET = 1000

const text = (max: number) => z.string().transform(value => value.trim().replace(/\s+/g, ' ')).pipe(z.string().min(1).max(max))

// Identity of a song is title + author. Neither the church nor lyrics or chords are part of the body.
export const newSongBody = z.strictObject({ title: text(120), author: text(120) })
export const songSearch = z.string().max(120)

const contextualKey = z.string().regex(/^(C|C#|D|Eb|E|F|F#|G|Ab|A|Bb|B)m?$/)

const REFERENCE_HOSTS = ['youtube.com', 'youtu.be', 'spotify.com']
/** A manual reference link: http(s) to YouTube or Spotify (any subdomain), without credentials. */
export function isReferenceLink(value: string) {
  if (value.length > 500) return false
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
    if (url.username || url.password) return false
    return REFERENCE_HOSTS.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))
  } catch { return false }
}
// An empty link means «no link».
const link = z.string().trim().transform(value => value || null).pipe(z.string().refine(isReferenceLink).nullable())

const place = z.number().int().min(0).max(MAX_ENTRIES - 1)
export const addEntryBody = z.union([
  z.strictObject({ songId: z.string().trim().min(1).max(64), key: contextualKey.nullish(), link: link.nullish(), position: place.optional() }),
  z.strictObject({ moment: text(60), position: place.optional() }),
])
export const entryPatch = z.strictObject({ key: contextualKey.nullable().optional(), link: link.optional(), moment: text(60).optional() })
  .refine(body => body.key !== undefined || body.link !== undefined || body.moment !== undefined)
export const orderBody = z.strictObject({
  version: z.number().int().min(0),
  entryIds: z.array(z.string().min(1).max(64)).min(1).max(MAX_ENTRIES).refine(ids => new Set(ids).size === ids.length),
})

/** The list with `item` inserted at `position` (at the end when absent or out of range). */
export function placeAt<T>(list: readonly T[], item: T, position?: number): T[] {
  const next = [...list]
  next.splice(position === undefined ? next.length : Math.min(position, next.length), 0, item)
  return next
}

/** True when both lists hold exactly the same ids, in any order. */
export function sameIds(current: readonly string[], proposed: readonly string[]) {
  return current.length === proposed.length && new Set(proposed).size === proposed.length && proposed.every(id => current.includes(id))
}
