import { z } from 'zod'
import { isoDate } from './service-rules.js'

/** Pure rules of the ministry links; the routes only add access and persistence around them. */

export const LINK_DAYS = 30
export const RANGE_DAYS_MAX = 366
export const versions = ['PRAISE', 'PREACHING', 'FULL', 'CONGREGATION'] as const
export type ShareVersion = (typeof versions)[number]
export type LinkStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED'
export type Blocks = { keys: boolean; notes: boolean; people: boolean }

const DAY = 86_400_000
const time = (date: string) => Date.parse(`${date}T00:00:00Z`)

/** Calendar arithmetic on `YYYY-MM-DD` dates: a date carries no time zone, so there is no daylight saving to cross. */
export const addDays = (date: string, days: number) => new Date(time(date) + days * DAY).toISOString().slice(0, 10)
export const daysBetween = (from: string, to: string) => Math.round((time(to) - time(from)) / DAY)

/** A link is active from its creation until 30 days after the date of the last service it includes. */
export const validUntil = (lastServiceDate: string) => addDays(lastServiceDate, LINK_DAYS)
/** A reactivation lasts another 30 days, counted from the day it is done. */
export const reactivationEnd = (today: string) => addDays(today, LINK_DAYS)

type Lifecycle = { revoked: boolean; activeUntil: string }

/** `today` is the church's calendar day (America/Mexico_City): the last valid day counts through its end. */
export function linkStatus(link: Lifecycle, today: string): LinkStatus {
  if (link.revoked) return 'REVOKED'
  return today <= link.activeUntil ? 'ACTIVE' : 'EXPIRED'
}

/**
 * A deactivated link (expired or revoked) can be activated again. Product leaves open whether a reactivated link
 * can be reactivated again; the strictest reading applies: a link is reactivated at most once.
 */
export function reactivation(link: Lifecycle & { reactivated: boolean }, today: string): 'ok' | 'active' | 'used' {
  if (linkStatus(link, today) === 'ACTIVE') return 'active'
  return link.reactivated ? 'used' : 'ok'
}

const id = z.string().trim().min(1).max(64)
const blocksBody = z.strictObject({ keys: z.boolean().optional(), notes: z.boolean().optional(), people: z.boolean().optional() })

// The church is never part of the body: it is always the caller's active church.
export const newLinkBody = z.strictObject({
  version: z.enum(versions),
  scope: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('service'), serviceId: id }),
    z.strictObject({ kind: z.literal('range'), from: isoDate, to: isoDate }),
  ]).refine(scope => scope.kind === 'service' || (scope.from <= scope.to && daysBetween(scope.from, scope.to) < RANGE_DAYS_MAX)),
  blocks: blocksBody.optional(),
})
export type NewLinkBody = z.infer<typeof newLinkBody>

/**
 * Tones and BPM are off by default, notes are off by default, and who directs or preaches is on. A block the
 * version cannot show (notes in «alabanza», tones in «predicación») is refused when asked for, never ignored.
 * The congregation version takes none.
 */
export function effectiveBlocks(version: ShareVersion, asked: z.infer<typeof blocksBody> | undefined): Blocks | null {
  // The congregation view is fixed: nothing optional, so nothing can be asked for. Who preaches is a setting of the church.
  if (version === 'CONGREGATION') return asked?.keys || asked?.notes || asked?.people ? null : { keys: false, notes: false, people: false }
  const blocks = { keys: asked?.keys ?? false, notes: asked?.notes ?? false, people: asked?.people ?? true }
  if ((version === 'PRAISE' && blocks.notes) || (version === 'PREACHING' && blocks.keys)) return null
  return blocks
}
