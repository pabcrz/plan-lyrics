import { Hono, type Context } from 'hono'
import type { PrismaClient } from './generated/prisma/client.ts'
import { safeErrorCode } from './errors.js'
import { nameKey } from './people-rules.js'
import { DEFAULT_ROLES, DIRECTOR_KEY, newRestrictionBody, newRoleBody, roleNameTaken, sortedPair } from './role-rules.js'
import { activeChurch, type Active } from './services.js'
import { requireSession, type SessionConfig, type SessionEnvironment } from './session.js'

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]

const presentRole = (role: { id: string; name: string }) => ({ id: role.id, name: role.name })
const presentRestriction = (row: { id: string; first: string; second: string }) => ({ id: row.id, first: row.first, second: row.second })

/**
 * Creates the default catalog and restriction of a church exactly once, under the church lock.
 * Churches that already existed were seeded by the migration; the flag keeps a church that
 * deleted every role from getting them back.
 */
async function seedDefaults(tx: Tx, churchId: string) {
  await tx.$queryRaw`SELECT id FROM "Church" WHERE id = ${churchId} FOR UPDATE`
  const church = await tx.church.findUniqueOrThrow({ where: { id: churchId }, select: { rolesSeeded: true } })
  if (church.rolesSeeded) return
  const roles = await tx.musicalRole.createManyAndReturn({
    data: DEFAULT_ROLES.map(name => ({ churchId, name, nameKey: nameKey(name) })), skipDuplicates: true, select: { id: true, nameKey: true },
  })
  const drums = roles.find(role => role.nameKey === nameKey('Batería'))
  if (drums) await tx.roleRestriction.create({ data: { churchId, ...sortedPair(DIRECTOR_KEY, drums.id) } })
  await tx.church.update({ where: { id: churchId }, data: { rolesSeeded: true } })
}

async function ensureSeeded(db: PrismaClient, churchId: string) {
  const church = await db.church.findUniqueOrThrow({ where: { id: churchId }, select: { rolesSeeded: true } })
  if (!church.rolesSeeded) await db.$transaction(tx => seedDefaults(tx, churchId))
}

/** Roles of the church in alphabetical order (Spanish collation, ignoring accents like the catalog's names do). */
const sortRoles = <T extends { name: string }>(roles: T[]) => roles.sort((a, b) => a.name.localeCompare(b.name, 'es'))

export function roleRoutes(config: SessionConfig, db?: PrismaClient) {
  const routes = new Hono<SessionEnvironment>()
  for (const path of ['/api/roles', '/api/roles/*', '/api/role-restrictions', '/api/role-restrictions/*']) {
    routes.use(path, requireSession(config))
    routes.use(path, async (c, next) => { await next(); c.header('Cache-Control', 'no-store') })
  }

  // Same envelope as the service routes: the church is always the caller's active one, never part of the request.
  const guarded = (event: string, handler: (c: Context<SessionEnvironment>, db: PrismaClient, church: Active) => Promise<Response>) =>
    async (c: Context<SessionEnvironment>) => {
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

  // Reading is open to everyone with access to the church; only its administrator configures.
  routes.get('/api/roles', guarded('roles_list_failed', async (c, db, church) => {
    await ensureSeeded(db, church.churchId)
    const roles = await db.musicalRole.findMany({ where: { churchId: church.churchId }, select: { id: true, name: true } })
    return c.json(sortRoles(roles).map(presentRole))
  }))

  routes.post('/api/roles', guarded('role_creation_failed', async (c, db, church) => {
    if (!church.canConfigure) return c.json({ error: 'Forbidden' }, 403)
    const body = newRoleBody.safeParse(await c.req.json().catch(() => undefined))
    if (!body.success) return c.json({ error: 'Invalid request' }, 400)
    const result = await db.$transaction(async tx => {
      await seedDefaults(tx, church.churchId)
      const roles = await tx.musicalRole.findMany({ where: { churchId: church.churchId }, select: { name: true } })
      if (roleNameTaken(roles.map(role => role.name), body.data.name)) return 'exists' as const
      return tx.musicalRole.create({ data: { churchId: church.churchId, name: body.data.name, nameKey: nameKey(body.data.name) }, select: { id: true, name: true } })
    }).catch(error => { if (safeErrorCode(error) === 'P2002') return 'exists' as const; throw error })
    if (result === 'exists') return c.json({ error: 'Name exists' }, 409)
    return c.json(presentRole(result), 201)
  }))

  // Deleting a role also drops the restrictions that mention it. Warning about future assignments
  // arrives with participations: no assignment exists yet to be affected.
  routes.delete('/api/roles/:roleId', guarded('role_removal_failed', async (c, db, church) => {
    if (!church.canConfigure) return c.json({ error: 'Forbidden' }, 403)
    const roleId = c.req.param('roleId')
    const removed = await db.$transaction(async tx => {
      await seedDefaults(tx, church.churchId)
      const { count } = await tx.musicalRole.deleteMany({ where: { id: roleId, churchId: church.churchId } })
      if (count > 0) await tx.roleRestriction.deleteMany({ where: { churchId: church.churchId, OR: [{ first: roleId }, { second: roleId }] } })
      return count
    })
    return removed > 0 ? c.body(null, 204) : c.json({ error: 'Not found' }, 404)
  }))

  routes.get('/api/role-restrictions', guarded('role_restrictions_list_failed', async (c, db, church) => {
    await ensureSeeded(db, church.churchId)
    const rows = await db.roleRestriction.findMany({ where: { churchId: church.churchId }, orderBy: { createdAt: 'asc' }, select: { id: true, first: true, second: true } })
    return c.json(rows.map(presentRestriction))
  }))

  routes.post('/api/role-restrictions', guarded('role_restriction_creation_failed', async (c, db, church) => {
    if (!church.canConfigure) return c.json({ error: 'Forbidden' }, 403)
    const body = newRestrictionBody.safeParse(await c.req.json().catch(() => undefined))
    if (!body.success || body.data.first === body.data.second) return c.json({ error: 'Invalid request' }, 400)
    const pair = sortedPair(body.data.first, body.data.second)
    const result = await db.$transaction(async tx => {
      await seedDefaults(tx, church.churchId)
      // Each side must be the fixed director role or a role of this very church.
      const keys = [pair.first, pair.second].filter(key => key !== DIRECTOR_KEY)
      const found = await tx.musicalRole.count({ where: { churchId: church.churchId, id: { in: keys } } })
      if (found !== keys.length) return 'invalid' as const
      if (await tx.roleRestriction.findUnique({ where: { churchId_first_second: { churchId: church.churchId, ...pair } }, select: { id: true } })) return 'exists' as const
      return tx.roleRestriction.create({ data: { churchId: church.churchId, ...pair }, select: { id: true, first: true, second: true } })
    }).catch(error => { if (safeErrorCode(error) === 'P2002') return 'exists' as const; throw error })
    if (result === 'invalid') return c.json({ error: 'Invalid request' }, 400)
    if (result === 'exists') return c.json({ error: 'Restriction exists' }, 409)
    return c.json(presentRestriction(result), 201)
  }))

  routes.delete('/api/role-restrictions/:restrictionId', guarded('role_restriction_removal_failed', async (c, db, church) => {
    if (!church.canConfigure) return c.json({ error: 'Forbidden' }, 403)
    const removed = await db.roleRestriction.deleteMany({ where: { id: c.req.param('restrictionId'), churchId: church.churchId } })
    return removed.count > 0 ? c.body(null, 204) : c.json({ error: 'Not found' }, 404)
  }))
  return routes
}
