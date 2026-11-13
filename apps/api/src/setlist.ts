import { Hono } from 'hono'
import type { PrismaClient } from './generated/prisma/client.ts'
import { safeErrorCode } from './errors.js'
import { guarded } from './active-guard.js'
import { MAX_ENTRIES, POSITION_OFFSET, addEntryBody, entryPatch, orderBody, placeAt, sameIds } from './setlist-rules.js'
import { canEditLibrary } from './songs.js'
import type { Active } from './services.js'
import { requireSession, type SessionConfig, type SessionEnvironment } from './session.js'

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]

const entrySelect = { id: true, moment: true, key: true, link: true, song: { select: { id: true, title: true, author: true } } } as const

/** The setlist as the client sees it: the array order is the order, and the version guards reordering. */
async function readSetlist(db: Pick<PrismaClient, 'service'>, church: Active, serviceId: string, canCreateSongs: boolean) {
  const service = await db.service.findFirst({
    where: { id: serviceId, churchId: church.churchId },
    select: { id: true, title: true, date: true, slot: true, time: true, status: true, setlistVersion: true, setlist: { orderBy: { position: 'asc' }, select: entrySelect } },
  })
  if (!service) return null
  return {
    service: { id: service.id, title: service.title, date: service.date.toISOString().slice(0, 10), slot: service.slot, time: service.time, status: service.status },
    version: service.setlistVersion, canEdit: church.canEdit, canCreateSongs,
    entries: service.setlist.map(entry => ({ id: entry.id, kind: entry.song ? 'SONG' : 'MOMENT', song: entry.song, moment: entry.moment, key: entry.key, link: entry.link })),
  }
}

/** Serializes every change of one setlist: the service row (of the caller's church) is locked until commit. */
async function lockService(tx: Tx, churchId: string, serviceId: string) {
  const rows = await tx.$queryRaw<Array<{ setlistVersion: number }>>`SELECT "setlistVersion" FROM "Service" WHERE id = ${serviceId} AND "churchId" = ${churchId} FOR UPDATE`
  return rows[0] ?? null
}

/**
 * Rewrites positions as 0..n-1 following `ids`. Two phases because positions are unique: first every row moves
 * out of range, then each takes its final value, so no statement ever collides with a row not yet moved.
 */
async function renumber(tx: Tx, serviceId: string, ids: string[]) {
  await tx.$executeRaw`UPDATE "SetlistEntry" SET "position" = "position" + ${POSITION_OFFSET} WHERE "serviceId" = ${serviceId}`
  const positions = ids.map((_, index) => index)
  await tx.$executeRaw`UPDATE "SetlistEntry" e SET "position" = v.pos FROM unnest(${ids}::text[], ${positions}::int[]) AS v(id, pos) WHERE e.id = v.id AND e."serviceId" = ${serviceId}`
}

const currentIds = async (tx: Tx, serviceId: string) =>
  (await tx.setlistEntry.findMany({ where: { serviceId }, orderBy: { position: 'asc' }, select: { id: true } })).map(entry => entry.id)
const bump = (tx: Tx, serviceId: string) => tx.service.update({ where: { id: serviceId }, data: { setlistVersion: { increment: 1 } }, select: { id: true } })

export function setlistRoutes(config: SessionConfig, db?: PrismaClient) {
  const routes = new Hono<SessionEnvironment>()
  for (const path of ['/api/services/:serviceId/setlist', '/api/services/:serviceId/setlist/*']) {
    routes.use(path, requireSession(config))
    routes.use(path, async (c, next) => { await next(); c.header('Cache-Control', 'no-store') })
  }

  const respond = async (c: import('hono').Context<SessionEnvironment>, db: PrismaClient, church: Active, serviceId: string, status: 200 | 201 = 200) => {
    const setlist = await readSetlist(db, church, serviceId, await canEditLibrary(db, c.get('clerkSubject')))
    return setlist ? c.json(setlist, status) : c.json({ error: 'Not found' }, 404)
  }
  const stale = (c: import('hono').Context<SessionEnvironment>, version: number) => c.json({ error: 'Setlist changed', version }, 409)

  // Everyone in the church reads; the service is always looked up through the caller's church.
  routes.get('/api/services/:serviceId/setlist', guarded(db, 'setlist_read_failed', (c, db, church) => respond(c, db, church, c.req.param('serviceId')!)))

  routes.post('/api/services/:serviceId/setlist/entries', guarded(db, 'setlist_add_failed', async (c, db, church) => {
    if (!church.canEdit) return c.json({ error: 'Forbidden' }, 403)
    const serviceId = c.req.param('serviceId')!
    const body = addEntryBody.safeParse(await c.req.json().catch(() => undefined))
    if (!body.success) return c.json({ error: 'Invalid request' }, 400)
    const result = await db.$transaction(async tx => {
      if (!await lockService(tx, church.churchId, serviceId)) return 'missing' as const
      const ids = await currentIds(tx, serviceId)
      if (ids.length >= MAX_ENTRIES) return 'full' as const
      const { position, ...fields } = body.data
      let data: { moment: string } | { songId: string; key: string | null; link: string | null }
      if ('songId' in fields) {
        if (!await tx.song.findUnique({ where: { id: fields.songId }, select: { id: true } })) return 'song' as const
        if (await tx.setlistEntry.findFirst({ where: { serviceId, songId: fields.songId }, select: { id: true } })) return 'duplicate' as const
        data = { songId: fields.songId, key: fields.key ?? null, link: fields.link ?? null }
      } else data = { moment: fields.moment }
      const created = await tx.setlistEntry.create({ data: { serviceId, position: ids.length, ...data }, select: { id: true } })
      if (position !== undefined && position < ids.length) await renumber(tx, serviceId, placeAt(ids, created.id, position))
      await bump(tx, serviceId)
      return 'ok' as const
    }).catch(error => { if (safeErrorCode(error) === 'P2002') return 'duplicate' as const; throw error })
    if (result === 'missing') return c.json({ error: 'Not found' }, 404)
    if (result === 'song') return c.json({ error: 'Invalid request' }, 400)
    if (result === 'duplicate') return c.json({ error: 'Song already in setlist' }, 409)
    if (result === 'full') return c.json({ error: 'Setlist full' }, 409)
    return respond(c, db, church, serviceId, 201)
  }))

  // A song entry changes its contextual key and link (never the library); a moment only its name.
  routes.patch('/api/services/:serviceId/setlist/entries/:entryId', guarded(db, 'setlist_edit_failed', async (c, db, church) => {
    if (!church.canEdit) return c.json({ error: 'Forbidden' }, 403)
    const serviceId = c.req.param('serviceId')!
    const body = entryPatch.safeParse(await c.req.json().catch(() => undefined))
    if (!body.success) return c.json({ error: 'Invalid request' }, 400)
    const result = await db.$transaction(async tx => {
      if (!await lockService(tx, church.churchId, serviceId)) return 'missing' as const
      const entry = await tx.setlistEntry.findFirst({ where: { id: c.req.param('entryId'), serviceId }, select: { songId: true } })
      if (!entry) return 'missing' as const
      const { moment, ...contextual } = body.data
      if (entry.songId ? moment !== undefined : contextual.key !== undefined || contextual.link !== undefined) return 'invalid' as const
      await tx.setlistEntry.update({ where: { id: c.req.param('entryId') }, data: entry.songId ? contextual : { moment }, select: { id: true } })
      return 'ok' as const
    })
    if (result === 'missing') return c.json({ error: 'Not found' }, 404)
    if (result === 'invalid') return c.json({ error: 'Invalid request' }, 400)
    return respond(c, db, church, serviceId)
  }))

  routes.delete('/api/services/:serviceId/setlist/entries/:entryId', guarded(db, 'setlist_remove_failed', async (c, db, church) => {
    if (!church.canEdit) return c.json({ error: 'Forbidden' }, 403)
    const serviceId = c.req.param('serviceId')!
    const entryId = c.req.param('entryId')
    const found = await db.$transaction(async tx => {
      if (!await lockService(tx, church.churchId, serviceId)) return false
      if ((await tx.setlistEntry.deleteMany({ where: { id: entryId, serviceId } })).count === 0) return false
      await renumber(tx, serviceId, await currentIds(tx, serviceId))
      await bump(tx, serviceId)
      return true
    })
    return found ? respond(c, db, church, serviceId) : c.json({ error: 'Not found' }, 404)
  }))

  // Atomic reorder: the whole new order replaces the old one, or nothing changes. The version the client
  // last read must still be current and the ids must be exactly the setlist's, or the request is rejected.
  routes.put('/api/services/:serviceId/setlist/order', guarded(db, 'setlist_reorder_failed', async (c, db, church) => {
    if (!church.canEdit) return c.json({ error: 'Forbidden' }, 403)
    const serviceId = c.req.param('serviceId')!
    const body = orderBody.safeParse(await c.req.json().catch(() => undefined))
    if (!body.success) return c.json({ error: 'Invalid request' }, 400)
    const result = await db.$transaction(async tx => {
      const locked = await lockService(tx, church.churchId, serviceId)
      if (!locked) return 'missing' as const
      const ids = await currentIds(tx, serviceId)
      if (locked.setlistVersion !== body.data.version || !sameIds(ids, body.data.entryIds)) return { stale: locked.setlistVersion }
      if (ids.some((id, index) => id !== body.data.entryIds[index])) {
        await renumber(tx, serviceId, body.data.entryIds)
        await bump(tx, serviceId)
      }
      return 'ok' as const
    })
    if (result === 'missing') return c.json({ error: 'Not found' }, 404)
    if (result !== 'ok') return stale(c, result.stale)
    return respond(c, db, church, serviceId)
  }))
  return routes
}
