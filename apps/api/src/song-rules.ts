import type { PrismaClient } from './generated/prisma/client.ts'

export type RepeatRule = { unit: 'WEEKS' | 'SERVICES'; amount: number }
type Tx = Pick<PrismaClient, 'service' | 'setlistEntry'>

const DAY = 86_400_000
const days = (date: string) => Date.parse(`${date}T00:00:00Z`) / DAY

/**
 * The strict repetition rule. A song is blocked for a service when it is used in another service of the same church
 * (cancelled ones never count) that is too close, before or after:
 * - `WEEKS`: closer than `amount` weeks by calendar date (the hour never matters);
 * - `SERVICES`: within the `amount` services right before or right after it. With 2: sung on Friday, the next Sunday
 *   and the next Friday are blocked and the Sunday after that is free.
 * `services` are the church's non-cancelled services in order; `uses` the dates and ids where the song is sung.
 * Returns the date of the closest conflicting use, or `null` when the song is free.
 */
export function repeatConflict(rule: RepeatRule, target: { id: string; date: string }, services: ReadonlyArray<{ id: string; date: string }>, uses: ReadonlyArray<{ serviceId: string; date: string }>): string | null {
  const others = uses.filter(use => use.serviceId !== target.id)
  if (rule.unit === 'WEEKS') {
    const close = others.filter(use => Math.abs(days(use.date) - days(target.date)) < rule.amount * 7)
    return close.length === 0 ? null : close.sort((a, b) => Math.abs(days(a.date) - days(target.date)) - Math.abs(days(b.date) - days(target.date)))[0]!.date
  }
  const at = services.findIndex(service => service.id === target.id)
  if (at < 0) return null
  const near = new Map(services.slice(Math.max(0, at - rule.amount), at + rule.amount + 1).filter(service => service.id !== target.id).map(service => [service.id, service.date]))
  const hit = others.filter(use => near.has(use.serviceId)).map(use => use.date)
  return hit.length === 0 ? null : hit.sort((a, b) => Math.abs(days(a) - days(target.date)) - Math.abs(days(b) - days(target.date)))[0]!
}

/** For a service of the church: which of the songs the rule blocks, with the date of the conflicting use. Empty when the rule is off or the service is cancelled. */
export async function blockedSongs(db: Tx, church: { churchId: string; songRepeat: RepeatRule | null }, serviceId: string, songIds: ReadonlyArray<string>): Promise<Map<string, string>> {
  const blocked = new Map<string, string>()
  if (!church.songRepeat || songIds.length === 0) return blocked
  const services = (await db.service.findMany({ where: { churchId: church.churchId, status: { not: 'CANCELLED' } }, orderBy: [{ date: 'asc' }, { slot: 'asc' }], select: { id: true, date: true } }))
    .map(service => ({ id: service.id, date: service.date.toISOString().slice(0, 10) }))
  const target = services.find(service => service.id === serviceId)
  if (!target) return blocked
  const entries = await db.setlistEntry.findMany({ where: { songId: { in: [...songIds] }, service: { churchId: church.churchId, status: { not: 'CANCELLED' } } }, select: { songId: true, serviceId: true, service: { select: { date: true } } } })
  const bySong = new Map<string, Array<{ serviceId: string; date: string }>>()
  for (const entry of entries) bySong.set(entry.songId!, [...(bySong.get(entry.songId!) ?? []), { serviceId: entry.serviceId, date: entry.service.date.toISOString().slice(0, 10) }])
  for (const [songId, uses] of bySong) {
    const conflict = repeatConflict(church.songRepeat, target, services, uses)
    if (conflict) blocked.set(songId, conflict)
  }
  return blocked
}
