import { getConnInfo } from '@hono/node-server/conninfo'
import { Hono, type Context } from 'hono'
import { safeErrorCode } from './errors.js'
import type { PrismaClient } from './generated/prisma/client.ts'
import { createLimiter, type Limiter } from './rate-limit.js'
import { todayInZone } from './service-rules.js'
import { linkStatus, type ShareVersion } from './share-rules.js'
import { hashToken, isTokenShape } from './share-token.js'

const day = (date: Date) => date.toISOString().slice(0, 10)

type Link = {
  churchId: string; version: ShareVersion; fromDate: Date; toDate: Date; serviceId: string | null
  showKeys: boolean; showNotes: boolean; showPeople: boolean; activeUntil: Date
  church: { name: string; usesPreaching: boolean; congregationShowsPreacher: boolean }
}
type Row = {
  date: Date; slot: string; time?: string | null
  director?: { person: { name: string } }
  setlist?: Array<{ moment: string | null; key?: string | null; song: { title: string; author: string } | null }>
  preaching?: { topic: string; passages: string[]; notes?: string; preacher?: { person: { name: string } } | null } | null
}

/**
 * What a link shows, and nothing more. The query itself only asks for the fields the version and the blocks
 * include, and the answer is built field by field: no internal ids, no links of songs, nothing of other churches
 * (every query is filtered by the church the link belongs to). Preaching follows the church's switch: while it is
 * off, nothing of it is shown even if it was stored.
 */
export async function buildView(db: PrismaClient, link: Link) {
  const praise = link.version !== 'PREACHING'
  const preaching = (link.version === 'PREACHING' || link.version === 'FULL') && link.church.usesPreaching
  const full = link.version === 'FULL'
  // The congregation view: the praise side only, and, when the church turns it on, just the preacher and the topic.
  const congregation = link.version === 'CONGREGATION'
  const preacherAndTopic = congregation && link.church.usesPreaching && link.church.congregationShowsPreacher
  const rows = await db.service.findMany({
    where: { churchId: link.churchId, status: { not: 'CANCELLED' }, ...(link.serviceId ? { id: link.serviceId } : { date: { gte: link.fromDate, lte: link.toDate } }) },
    orderBy: [{ date: 'asc' }, { slot: 'asc' }],
    select: {
      date: true, slot: true,
      ...(full ? { time: true } : {}),
      ...(praise && link.showPeople ? { director: { select: { person: { select: { name: true } } } } } : {}),
      ...(praise ? { setlist: { orderBy: { position: 'asc' }, select: { moment: true, ...(link.showKeys ? { key: true } : {}), song: { select: { title: true, author: true } } } } } : {}),
      ...(preaching ? { preaching: { select: {
        topic: true, passages: true,
        ...(link.showNotes ? { notes: true } : {}),
        ...(link.showPeople ? { preacher: { select: { person: { select: { name: true } } } } } : {}),
      } } } : {}),
      ...(preacherAndTopic ? { preaching: { select: { topic: true, preacher: { select: { person: { select: { name: true } } } } } } } : {}),
    },
  }) as unknown as Row[]
  // «No hay culto» belongs to every range, not to a single service.
  const closed = link.serviceId ? [] : await db.closedDate.findMany({
    where: { churchId: link.churchId, date: { gte: link.fromDate, lte: link.toDate } }, orderBy: { date: 'asc' }, select: { date: true, reason: true },
  })
  return {
    version: link.version, church: link.church.name, activeUntil: day(link.activeUntil),
    blocks: { keys: praise && link.showKeys, notes: preaching && link.showNotes, people: link.showPeople },
    services: rows.map(row => ({
      date: day(row.date), slot: row.slot,
      ...(full ? { time: row.time ?? null } : {}),
      ...(row.director ? { director: row.director.person.name } : {}),
      ...(row.setlist ? { setlist: row.setlist.map(entry => entry.song
        ? { kind: 'SONG', title: entry.song.title, author: entry.song.author, ...(link.showKeys ? { key: entry.key ?? null } : {}) }
        : { kind: 'MOMENT', name: entry.moment }) } : {}),
      ...(preacherAndTopic ? { preaching: row.preaching ? {
        ...(row.preaching.preacher ? { preacher: row.preaching.preacher.person.name } : {}),
        ...(row.preaching.topic ? { topic: row.preaching.topic } : {}),
      } : null } : {}),
      ...(preaching ? { preaching: row.preaching ? {
        topic: row.preaching.topic, passages: row.preaching.passages,
        ...(row.preaching.preacher ? { preacher: row.preaching.preacher.person.name } : {}),
        ...(link.showNotes ? { notes: row.preaching.notes ?? '' } : {}),
      } : null } : {}),
    })),
    closedDates: closed.map(row => ({ date: day(row.date), reason: row.reason })),
  }
}

const clientKey = (c: Context) => { try { return getConnInfo(c).remote.address ?? 'unknown' } catch { return 'unknown' } }

/**
 * The only unauthenticated route: `GET /api/public/links/:token`. A token that does not exist, is expired or was
 * revoked answers the same `404`, so the response never says which. Every answer, errors included, is private
 * (`no-store`), not indexable and without referrer, and the number of requests per address is limited.
 */
export function publicShareRoutes(db: PrismaClient | undefined, now: () => Date, limiter: Limiter = createLimiter({ limit: 120, windowMs: 60_000 })) {
  const routes = new Hono()
  routes.use('/api/public/*', async (c, next) => {
    await next()
    c.header('Cache-Control', 'no-store')
    c.header('X-Robots-Tag', 'noindex, nofollow, noarchive')
    c.header('Referrer-Policy', 'no-referrer')
  })
  routes.get('/api/public/links/:token', async c => {
    if (!limiter(clientKey(c))) { c.header('Retry-After', '60'); return c.json({ error: 'Too many requests' }, 429) }
    const token = c.req.param('token')
    if (!isTokenShape(token)) return c.json({ error: 'Not found' }, 404)
    if (!db) return c.json({ error: 'Access unavailable' }, 503)
    try {
      const link = await db.shareLink.findUnique({ where: { tokenHash: hashToken(token) }, select: {
        churchId: true, version: true, fromDate: true, toDate: true, serviceId: true, showKeys: true, showNotes: true, showPeople: true,
        activeUntil: true, revokedAt: true, church: { select: { name: true, usesPreaching: true, congregationShowsPreacher: true } },
      } })
      if (!link || linkStatus({ revoked: link.revokedAt !== null, activeUntil: day(link.activeUntil) }, todayInZone(now())) !== 'ACTIVE') return c.json({ error: 'Not found' }, 404)
      return c.json(await buildView(db, link))
    } catch (error) {
      console.error(JSON.stringify({ event: 'public_link_failed', code: safeErrorCode(error) }))
      return c.json({ error: 'Access unavailable' }, 503)
    }
  })
  return routes
}
