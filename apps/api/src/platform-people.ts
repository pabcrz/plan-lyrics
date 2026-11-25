import { Hono, type Context } from 'hono'
import type { PrismaClient } from './generated/prisma/client.ts'
import { safeErrorCode } from './errors.js'
import { findSameName, platformLinkBody, platformPersonBody, platformPersonPatch } from './people-rules.js'
import { requireSession, type SessionConfig, type SessionEnvironment } from './session.js'
import { userCapability } from './users.js'

const personSelect = { id: true, name: true, phone: true, email: true, userId: true } as const
type PersonRow = { id: string; name: string; phone: string | null; email: string | null; userId: string | null }
const present = (person: PersonRow) => ({ id: person.id, name: person.name, phone: person.phone, email: person.email, hasAccount: person.userId !== null })
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'es')

/** Personas y sus iglesias vistas desde arriba: solo el superadministrador. Cualquier otra persona recibe el 404 genérico. */
export function platformPeopleRoutes(config: SessionConfig, db?: PrismaClient) {
  const routes = new Hono<SessionEnvironment>()
  routes.use('/api/platform/*', requireSession(config))
  routes.use('/api/platform/*', async (c, next) => { await next(); c.header('Cache-Control', 'no-store') })

  const owned = (event: string, handler: (c: Context<SessionEnvironment>, db: PrismaClient) => Promise<Response>) =>
    async (c: Context<SessionEnvironment>) => {
      if (!db) return c.json({ error: 'Access unavailable' }, 503)
      try {
        if (!(await userCapability(db, c.get('clerkSubject')))?.owner) return c.json({ error: 'Not found' }, 404)
        return await handler(c, db)
      } catch (error) {
        console.error(JSON.stringify({ event, code: safeErrorCode(error) }))
        return c.json({ error: 'Access unavailable' }, 503)
      }
    }
  // El nombre debe ser único en toda la plataforma: se serializa con un candado para que dos altas a la vez no lo dupliquen.
  const lockNames = (tx: Pick<PrismaClient, '$executeRaw'>) => tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('platform-people-names'))`

  routes.get('/api/platform/people', owned('platform_people_failed', async (c, db) => {
    const people = await db.person.findMany({ select: { ...personSelect, churches: { where: { removedAt: null }, select: { churchId: true, canPlay: true, canDirect: true, canPreach: true, roleIds: true } } } })
    return c.json(people.sort(byName).map(({ churches, ...person }) => ({
      ...present(person), churches: churches.map(({ churchId, ...link }) => ({ id: churchId, ...link })),
    })))
  }))

  routes.get('/api/platform/churches', owned('platform_churches_failed', async (c, db) => {
    const churches = await db.church.findMany({ select: { id: true, name: true, usesPreaching: true, musicalRoles: { select: { id: true, name: true } } } })
    return c.json(churches.sort(byName).map(({ musicalRoles, ...church }) => ({ ...church, roles: musicalRoles.sort(byName) })))
  }))

  routes.post('/api/platform/people', owned('platform_person_creation_failed', async (c, db) => {
    const body = platformPersonBody.safeParse(await c.req.json().catch(() => undefined))
    if (!body.success) return c.json({ error: 'Invalid request' }, 400)
    const result = await db.$transaction(async tx => {
      await lockNames(tx)
      const same = findSameName(await tx.person.findMany({ select: { id: true, name: true } }), body.data.name)
      if (same) return { same }
      return { person: await tx.person.create({ data: { name: body.data.name, phone: body.data.phone ?? null, email: body.data.email ?? null }, select: personSelect }) }
    })
    if ('same' in result) return c.json({ error: 'Name exists', existing: result.same }, 409)
    return c.json({ ...present(result.person), churches: [] }, 201)
  }))

  routes.patch('/api/platform/people/:personId', owned('platform_person_update_failed', async (c, db) => {
    const personId = c.req.param('personId')!
    const body = platformPersonPatch.safeParse(await c.req.json().catch(() => undefined))
    if (!body.success) return c.json({ error: 'Invalid request' }, 400)
    const result = await db.$transaction(async tx => {
      await lockNames(tx)
      if (!await tx.person.findUnique({ where: { id: personId }, select: { id: true } })) return 'missing' as const
      if (body.data.name !== undefined) {
        const same = findSameName(await tx.person.findMany({ select: { id: true, name: true } }), body.data.name, personId)
        if (same) return { same }
      }
      return { person: await tx.person.update({ where: { id: personId }, data: body.data, select: personSelect }) }
    })
    if (result === 'missing') return c.json({ error: 'Not found' }, 404)
    if ('same' in result) return c.json({ error: 'Name exists', existing: result.same }, 409)
    return c.json(present(result.person))
  }))

  // Crea o reactiva el enlace de la persona con la iglesia, con sus grupos y roles musicales.
  routes.put('/api/platform/people/:personId/churches/:churchId', owned('platform_link_failed', async (c, db) => {
    const personId = c.req.param('personId')!
    const churchId = c.req.param('churchId')!
    const body = platformLinkBody.safeParse(await c.req.json().catch(() => undefined))
    if (!body.success) return c.json({ error: 'Invalid request' }, 400)
    const result = await db.$transaction(async tx => {
      if (!await tx.person.findUnique({ where: { id: personId }, select: { id: true } })) return 'missing' as const
      if ((await tx.$queryRaw<unknown[]>`SELECT id FROM "Church" WHERE id = ${churchId} FOR UPDATE`).length === 0) return 'missing' as const
      if (await tx.musicalRole.count({ where: { churchId, id: { in: body.data.roleIds } } }) !== body.data.roleIds.length) return 'invalid' as const
      // Sacarla del grupo de alabanza se rechaza mientras siga como habitual o en una rotación de uno de sus roles.
      const held = (await tx.churchPerson.findUnique({ where: { churchId_personId: { churchId, personId } }, select: { roleIds: true, removedAt: true } }))
      if (!body.data.canPlay && held && !held.removedAt && held.roleIds.length > 0
        && (await tx.rolePlan.findFirst({ where: { churchId, roleId: { in: held.roleIds }, habitualIds: { has: personId } }, select: { roleId: true } })
          || await tx.rotationSequence.findFirst({ where: { roleId: { in: held.roleIds }, memberIds: { has: personId } }, select: { roleId: true } }))) return 'in-use' as const
      const data = { canPlay: body.data.canPlay, canDirect: body.data.canDirect, canPreach: body.data.canPreach, roleIds: body.data.roleIds, removedAt: null }
      return tx.churchPerson.upsert({ where: { churchId_personId: { churchId, personId } }, update: data, create: { churchId, personId, ...data }, select: { canPlay: true, canDirect: true, canPreach: true, roleIds: true } })
    })
    if (result === 'missing') return c.json({ error: 'Not found' }, 404)
    if (result === 'invalid') return c.json({ error: 'Invalid request' }, 400)
    if (result === 'in-use') return c.json({ error: 'In use' }, 409)
    return c.json({ id: churchId, ...result })
  }))

  routes.delete('/api/platform/people/:personId/churches/:churchId', owned('platform_unlink_failed', async (c, db) => {
    const removed = await db.churchPerson.updateMany({ where: { personId: c.req.param('personId')!, churchId: c.req.param('churchId')!, removedAt: null }, data: { removedAt: new Date() } })
    return removed.count > 0 ? c.body(null, 204) : c.json({ error: 'Not found' }, 404)
  }))

  return routes
}
