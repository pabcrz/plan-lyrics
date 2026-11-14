import { Hono, type Context } from 'hono'
import { guarded } from './active-guard.js'
import { lockChurch, type Tx } from './participation-generation.js'
import { canSeeNotes, documentRange, isEmptyPreaching, preachingBody, swapPreachingBody } from './preaching-rules.js'
import type { PrismaClient } from './generated/prisma/client.ts'
import { isoDate, todayInZone } from './service-rules.js'
import type { Active } from './services.js'
import { requireSession, type SessionConfig, type SessionEnvironment } from './session.js'

type Http = Context<SessionEnvironment>

const day = (date: Date) => date.toISOString().slice(0, 10)
const param = (c: Http, name: string) => c.req.param(name) ?? ''

const preachingSelect = { preacherId: true, topic: true, passages: true, notes: true, preacher: { select: { person: { select: { id: true, name: true } } } } } as const
type Row = { preacherId: string | null; topic: string; passages: string[]; notes: string; preacher: { person: { id: string; name: string } } | null }

/** The person of the session's user, when they have one: only then can an assignment as preacher reach them. */
const viewerPerson = async (db: PrismaClient | Tx, church: Active, subject: string) => {
  const person = await db.person.findFirst({ where: { user: { clerkSubject: subject }, churches: { some: { churchId: church.churchId, removedAt: null } } }, select: { id: true } })
  return person?.id ?? null
}

/** Notes are left out (not blanked) for whoever may not read them, so the shape itself says so. */
async function present(db: PrismaClient | Tx, church: Active, subject: string, serviceId: string, row: Row | null) {
  const allowed = canSeeNotes({ canEdit: church.canEdit, personId: await viewerPerson(db, church, subject) }, row?.preacherId ?? null)
  return {
    serviceId, preacher: row?.preacher?.person ?? null, topic: row?.topic ?? '', passages: row?.passages ?? [],
    canSeeNotes: allowed, ...(allowed ? { notes: row?.notes ?? '' } : {}),
  }
}

const activePerson = (tx: Tx, churchId: string, personId: string) =>
  tx.churchPerson.findFirst({ where: { churchId, personId, removedAt: null }, select: { personId: true } })

/**
 * Preaching of a service. Everything depends on the church's «Usa predicación» switch: while it is off every
 * read and write is refused (`409 Preaching disabled`) and the stored data is kept for when it is turned on.
 * The church always comes from the caller's access, never from the request.
 */
export function preachingRoutes(config: SessionConfig, db?: PrismaClient, now: () => Date = () => new Date()) {
  const routes = new Hono<SessionEnvironment>()
  for (const path of ['/api/services/:serviceId/preaching', '/api/preaching/*', '/api/preaching-turns', '/api/preaching-document']) {
    routes.use(path, requireSession(config))
    routes.use(path, async (c, next) => { await next(); c.header('Cache-Control', 'no-store') })
  }
  const off = (c: Http) => c.json({ error: 'Preaching disabled' }, 409)

  routes.get('/api/services/:serviceId/preaching', guarded(db, 'preaching_read_failed', async (c, db, church) => {
    if (!church.usesPreaching) return off(c)
    const service = await db.service.findFirst({ where: { id: param(c, 'serviceId'), churchId: church.churchId }, select: { id: true, preaching: { select: preachingSelect } } })
    if (!service) return c.json({ error: 'Not found' }, 404)
    return c.json(await present(db, church, c.get('clerkSubject'), service.id, service.preaching))
  }))

  // Replaces the whole section of one service: this is «cambio por fecha» when only the preacher differs.
  routes.put('/api/services/:serviceId/preaching', guarded(db, 'preaching_save_failed', async (c, db, church) => {
    if (!church.canEdit) return c.json({ error: 'Forbidden' }, 403)
    if (!church.usesPreaching) return off(c)
    const body = preachingBody.safeParse(await c.req.json().catch(() => undefined))
    if (!body.success) return c.json({ error: 'Invalid request' }, 400)
    const result = await db.$transaction(async tx => {
      await lockChurch(tx, church.churchId)
      const service = await tx.service.findFirst({ where: { id: param(c, 'serviceId'), churchId: church.churchId }, select: { id: true, date: true, preaching: { select: { preacherId: true } } } })
      if (!service) return 'missing' as const
      // Past services are a record; today is still editable.
      if (day(service.date) < todayInZone(now())) return 'Date in the past' as const
      const { preacherId } = body.data
      // Keeping a preacher who left the directory is allowed; choosing one is not.
      if (preacherId && preacherId !== service.preaching?.preacherId && !await activePerson(tx, church.churchId, preacherId)) return 'Invalid request' as const
      if (isEmptyPreaching(body.data)) await tx.servicePreaching.deleteMany({ where: { serviceId: service.id } })
      else await tx.servicePreaching.upsert({
        where: { serviceId: service.id }, update: body.data, create: { ...body.data, serviceId: service.id, churchId: church.churchId },
      })
      const row = await tx.servicePreaching.findUnique({ where: { serviceId: service.id }, select: preachingSelect })
      return present(tx, church, c.get('clerkSubject'), service.id, row)
    })
    if (result === 'missing') return c.json({ error: 'Not found' }, 404)
    if (result === 'Invalid request' || result === 'Date in the past') return c.json({ error: result }, 400)
    return c.json(result)
  }))

  // «Intercambiar» two dates: only the preachers trade places; each date keeps its topic, passages and notes.
  routes.post('/api/preaching/swap', guarded(db, 'preaching_swap_failed', async (c, db, church) => {
    if (!church.canEdit) return c.json({ error: 'Forbidden' }, 403)
    if (!church.usesPreaching) return off(c)
    const body = swapPreachingBody.safeParse(await c.req.json().catch(() => undefined))
    if (!body.success || body.data.first === body.data.second) return c.json({ error: 'Invalid request' }, 400)
    const result = await db.$transaction(async tx => {
      await lockChurch(tx, church.churchId)
      const select = { serviceId: true, preacherId: true, service: { select: { date: true } } } as const
      const [first, second] = await Promise.all([body.data.first, body.data.second].map(serviceId => tx.servicePreaching.findFirst({ where: { serviceId, churchId: church.churchId }, select })))
      // Both services must exist in this church; one without a section has no preacher to trade.
      const services = await tx.service.count({ where: { churchId: church.churchId, id: { in: [body.data.first, body.data.second] } } })
      if (services !== 2) return 'missing' as const
      if (!first?.preacherId || !second?.preacherId || first.preacherId === second.preacherId) return 'Invalid request' as const
      const today = todayInZone(now())
      if (day(first.service.date) < today || day(second.service.date) < today) return 'Date in the past' as const
      if (!await activePerson(tx, church.churchId, first.preacherId) || !await activePerson(tx, church.churchId, second.preacherId)) return 'Invalid request' as const
      await tx.servicePreaching.update({ where: { serviceId: first.serviceId }, data: { preacherId: second.preacherId } })
      await tx.servicePreaching.update({ where: { serviceId: second.serviceId }, data: { preacherId: first.preacherId } })
      return 'swapped' as const
    })
    if (result === 'missing') return c.json({ error: 'Not found' }, 404)
    if (result === 'swapped') return c.json({ swapped: [body.data.first, body.data.second] })
    return c.json({ error: result }, 400)
  }))

  // Upcoming dates that already have a preacher, to choose the counterpart of a swap. Only for those who edit.
  routes.get('/api/preaching-turns', guarded(db, 'preaching_turns_failed', async (c, db, church) => {
    if (!church.canEdit) return c.json({ error: 'Forbidden' }, 403)
    if (!church.usesPreaching) return off(c)
    const from = isoDate.safeParse(c.req.query('from') ?? todayInZone(now()))
    if (!from.success) return c.json({ error: 'Invalid request' }, 400)
    const rows = await db.servicePreaching.findMany({
      where: { churchId: church.churchId, preacherId: { not: null }, service: { date: { gte: new Date(`${from.data}T00:00:00Z`) } } },
      orderBy: [{ service: { date: 'asc' } }, { service: { slot: 'asc' } }], take: 40,
      select: { serviceId: true, preacher: { select: { person: { select: { id: true, name: true } } } }, service: { select: { date: true, slot: true, title: true } } },
    })
    return c.json(rows.flatMap(row => row.preacher ? [{ serviceId: row.serviceId, date: day(row.service.date), slot: row.service.slot, title: row.service.title, person: row.preacher.person }] : []))
  }))

  // Data of the printable «PDF de predicaciones»: the sections of a date range with their notes, so only for whoever
  // edits (notes are internal), plus the «No hay culto» dates, which every shared document shows.
  routes.get('/api/preaching-document', guarded(db, 'preaching_document_failed', async (c, db, church) => {
    if (!church.canEdit) return c.json({ error: 'Forbidden' }, 403)
    if (!church.usesPreaching) return off(c)
    const range = documentRange.safeParse({ from: c.req.query('from'), to: c.req.query('to') })
    if (!range.success) return c.json({ error: 'Invalid request' }, 400)
    const [from, to] = [new Date(`${range.data.from}T00:00:00Z`), new Date(`${range.data.to}T00:00:00Z`)]
    const [rows, closed] = await Promise.all([
      db.servicePreaching.findMany({
        where: { churchId: church.churchId, service: { status: { not: 'CANCELLED' }, date: { gte: from, lte: to } } },
        orderBy: [{ service: { date: 'asc' } }, { service: { slot: 'asc' } }],
        select: { topic: true, passages: true, notes: true, preacher: { select: { person: { select: { name: true } } } }, service: { select: { date: true, slot: true } } },
      }),
      db.closedDate.findMany({ where: { churchId: church.churchId, date: { gte: from, lte: to } }, orderBy: { date: 'asc' }, select: { date: true, reason: true } }),
    ])
    return c.json({
      church: church.name, from: range.data.from, to: range.data.to,
      services: rows.map(row => ({ date: day(row.service.date), slot: row.service.slot, preacher: row.preacher?.person.name ?? null, topic: row.topic, passages: row.passages, notes: row.notes })),
      closedDates: closed.map(row => ({ date: day(row.date), reason: row.reason })),
    })
  }))
  return routes
}
