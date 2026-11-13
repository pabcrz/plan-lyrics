import { Hono } from 'hono'
import type { PrismaClient } from './generated/prisma/client.ts'
import { safeErrorCode } from './errors.js'
import { dateCapacity, monthQuery, newServiceBody, planSlot, todayInZone } from './service-rules.js'
import { requireSession, type SessionConfig, type SessionEnvironment } from './session.js'

export const timeZone = 'America/Mexico_City'

type Active = { churchId: string; name: string; sundayDouble: boolean; canEdit: boolean }

/**
 * The active church is derived from the caller's memberships, never from the request.
 * Minimal rule (product has not defined a switcher): exactly one membership is active.
 */
async function activeChurch(db: PrismaClient, subject: string): Promise<Active | 'none' | 'ambiguous'> {
  const memberships = await db.membership.findMany({
    where: { user: { clerkSubject: subject } },
    select: { role: true, church: { select: { id: true, name: true, sundayDouble: true } } },
  })
  if (memberships.length === 0) return 'none'
  if (memberships.length > 1) return 'ambiguous'
  const { role, church } = memberships[0]
  return { churchId: church.id, name: church.name, sundayDouble: church.sundayDouble, canEdit: role === 'ADMIN' || role === 'EDITOR' }
}

const serviceSelect = {
  id: true, title: true, date: true, slot: true, time: true, status: true,
  director: { select: { person: { select: { id: true, name: true } } } },
} as const
type Row = { id: string; title: string; date: Date; slot: string; time: string | null; status: string; director: { person: { id: string; name: string } } }
const present = (row: Row) => ({
  id: row.id, title: row.title, date: row.date.toISOString().slice(0, 10), slot: row.slot,
  time: row.time, status: row.status, director: row.director.person,
})

export function serviceRoutes(config: SessionConfig, db?: PrismaClient, now: () => Date = () => new Date()) {
  const routes = new Hono<SessionEnvironment>()
  routes.use('/api/active-church', requireSession(config))
  routes.use('/api/people', requireSession(config))
  routes.use('/api/services', requireSession(config))
  routes.use('/api/*', async (c, next) => { await next(); c.header('Cache-Control', 'no-store') })

  // Shared envelope: database availability, active-church resolution and safe error logging.
  const guarded = (event: string, handler: (c: import('hono').Context<SessionEnvironment>, db: PrismaClient, church: Active) => Promise<Response>) =>
    async (c: import('hono').Context<SessionEnvironment>) => {
      if (!db) return c.json({ error: 'Access unavailable' }, 503)
      try {
        const church = await activeChurch(db, c.get('clerkSubject'))
        if (church === 'none') return c.json({ error: 'Not found' }, 404)
        if (church === 'ambiguous') return c.json({ error: 'Active church required' }, 409)
        return await handler(c, db, church)
      } catch (error) {
        console.error(JSON.stringify({ event, code: safeErrorCode(error) }))
        return c.json({ error: 'Access unavailable' }, 503)
      }
    }

  routes.get('/api/active-church', guarded('active_church_failed', async (c, db, church) => {
    const days = await db.serviceDay.findMany({
      where: { churchId: church.churchId }, orderBy: [{ weekday: 'asc' }, { slot: 'asc' }],
      select: { weekday: true, slot: true, time: true, title: true },
    })
    return c.json({ id: church.churchId, name: church.name, sundayDouble: church.sundayDouble, canEdit: church.canEdit, timeZone, days })
  }))

  routes.get('/api/people', guarded('people_failed', async (c, db, church) => {
    const links = await db.churchPerson.findMany({ where: { churchId: church.churchId }, select: { person: { select: { id: true, name: true } } } })
    return c.json(links.map(link => link.person).sort((a, b) => a.name.localeCompare(b.name, 'es')))
  }))

  routes.get('/api/services', guarded('services_list_failed', async (c, db, church) => {
    const month = monthQuery.safeParse(c.req.query('month'))
    if (!month.success) return c.json({ error: 'Invalid request' }, 400)
    const [year, number] = month.data.split('-').map(Number)
    const rows = await db.service.findMany({
      where: { churchId: church.churchId, date: { gte: new Date(Date.UTC(year, number - 1, 1)), lt: new Date(Date.UTC(year, number, 1)) } },
      orderBy: [{ date: 'asc' }, { slot: 'asc' }], select: serviceSelect,
    })
    return c.json(rows.map(present))
  }))

  routes.post('/api/services', guarded('service_creation_failed', async (c, db, church) => {
    if (!church.canEdit) return c.json({ error: 'Forbidden' }, 403)
    const body = newServiceBody.safeParse(await c.req.json().catch(() => undefined))
    if (!body.success) return c.json({ error: 'Invalid request' }, 400)
    const { directorId, date, ...fields } = body.data
    if (date < todayInZone(now())) return c.json({ error: 'Date in the past' }, 400)
    const plan = planSlot({ date, sundayDouble: church.sundayDouble, slot: fields.slot, time: fields.time })
    if ('error' in plan) return c.json({ error: plan.error }, 400)
    const dateValue = new Date(`${date}T00:00:00Z`)
    // The unique (church, date, slot) index rejects a repeated slot even if the count allows another service.
    const result = await db.$transaction(async tx => {
      // Serialize creations per church so the capacity check cannot race another request.
      await tx.$queryRaw`SELECT id FROM "Church" WHERE id = ${church.churchId} FOR UPDATE`
      const director = await tx.churchPerson.findUnique({ where: { churchId_personId: { churchId: church.churchId, personId: directorId } }, select: { personId: true } })
      if (!director) return 'director' as const
      const taken = await tx.service.count({ where: { churchId: church.churchId, date: dateValue } })
      if (taken >= dateCapacity(date, church.sundayDouble)) return 'full' as const
      return tx.service.create({
        data: { churchId: church.churchId, directorId, date: dateValue, slot: plan.slot, title: fields.title, time: fields.time ?? null, status: fields.status },
        select: serviceSelect,
      })
    }).catch(error => { if (safeErrorCode(error) === 'P2002') return 'full' as const; throw error })
    if (result === 'director') return c.json({ error: 'Invalid request' }, 400)
    if (result === 'full') return c.json({ error: 'Date full' }, 409)
    return c.json(present(result), 201)
  }))
  return routes
}
