import { Hono } from 'hono'
import type { PrismaClient } from './generated/prisma/client.ts'
import { guarded } from './active-guard.js'
import { memberGrantBody, memberRoleBody, planMemberChange, type MemberRole } from './access-rules.js'
import { requireSession, type SessionConfig, type SessionEnvironment } from './session.js'

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]

const roleOrder: Record<MemberRole, number> = { ADMIN: 0, EDITOR: 1, MEMBER: 2 }

const memberSelect = (churchId: string) => ({
  userId: true, role: true,
  user: { select: {
    ownership: { select: { id: true } },
    // The name is shown only when the person belongs to this church's directory.
    person: { select: { id: true, name: true, churches: { where: { churchId }, select: { churchId: true } } } },
  } },
}) as const
type MemberRow = {
  userId: string; role: MemberRole
  user: { ownership: { id: number } | null; person: { id: string; name: string; churches: unknown[] } | null }
}
const present = (row: MemberRow, viewerId: string | undefined) => ({
  userId: row.userId, role: row.role, self: row.userId === viewerId, protected: row.user.ownership !== null,
  person: row.user.person && row.user.person.churches.length > 0 ? { id: row.user.person.id, name: row.user.person.name } : null,
})

/**
 * Membership management of the caller's own church. The church comes from the session, never from the request;
 * every statement filters by it, so another church's members, or a person shared with another church, are out of reach.
 * No route here creates accounts, sends invitations, links people or grants library editing.
 */
export function memberRoutes(config: SessionConfig, db?: PrismaClient) {
  const routes = new Hono<SessionEnvironment>()
  for (const path of ['/api/members', '/api/members/*']) {
    routes.use(path, requireSession(config))
    routes.use(path, async (c, next) => { await next(); c.header('Cache-Control', 'no-store') })
  }
  const lockChurch = (tx: Tx, churchId: string) => tx.$queryRaw`SELECT id FROM "Church" WHERE id = ${churchId} FOR UPDATE`
  const viewerId = async (db: PrismaClient, subject: string) => (await db.user.findUnique({ where: { clerkSubject: subject }, select: { id: true } }))?.id

  routes.get('/api/members', guarded(db, 'members_list_failed', async (c, db, church) => {
    if (!church.canConfigure) return c.json({ error: 'Forbidden' }, 403)
    const [rows, links, me] = await Promise.all([
      db.membership.findMany({ where: { churchId: church.churchId }, select: memberSelect(church.churchId) }),
      // Offered: directory people with an account that has no membership anywhere (no switcher yet, see docs/accesos.md).
      db.churchPerson.findMany({
        where: { churchId: church.churchId, removedAt: null, person: { user: { is: { memberships: { none: {} } } } } },
        select: { person: { select: { id: true, name: true } } },
      }),
      viewerId(db, c.get('clerkSubject')),
    ])
    const members = rows.map(row => present(row, me)).sort((a, b) =>
      roleOrder[a.role] - roleOrder[b.role] || (a.person?.name ?? '￿').localeCompare(b.person?.name ?? '￿', 'es'))
    const candidates = links.map(link => ({ personId: link.person.id, name: link.person.name })).sort((a, b) => a.name.localeCompare(b.name, 'es'))
    return c.json({ members, candidates })
  }))

  routes.post('/api/members', guarded(db, 'member_grant_failed', async (c, db, church) => {
    if (!church.canConfigure) return c.json({ error: 'Forbidden' }, 403)
    const body = memberGrantBody.safeParse(await c.req.json().catch(() => undefined))
    if (!body.success) return c.json({ error: 'Invalid request' }, 400)
    const outcome = await db.$transaction(async tx => {
      await lockChurch(tx, church.churchId)
      // Only people of this church's directory, found through the church's own link.
      const link = await tx.churchPerson.findFirst({ where: { churchId: church.churchId, personId: body.data.personId, removedAt: null }, select: { person: { select: { userId: true } } } })
      if (!link) return 'missing' as const
      const userId = link.person.userId
      if (!userId) return 'no-account' as const
      // One account, one church for now: lock the account so two churches cannot both claim it.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`
      const held = await tx.membership.findMany({ where: { userId }, select: { churchId: true } })
      if (held.some(row => row.churchId === church.churchId)) return 'exists' as const
      if (held.length > 0) return 'unavailable' as const
      await tx.membership.create({ data: { userId, churchId: church.churchId, role: body.data.role } })
      return userId
    })
    if (outcome === 'missing') return c.json({ error: 'Not found' }, 404)
    if (outcome === 'no-account') return c.json({ error: 'No account' }, 409)
    if (outcome === 'exists') return c.json({ error: 'Member exists' }, 409)
    if (outcome === 'unavailable') return c.json({ error: 'Account unavailable' }, 409)
    const row = await db.membership.findUniqueOrThrow({ where: { userId_churchId: { userId: outcome, churchId: church.churchId } }, select: memberSelect(church.churchId) })
    return c.json(present(row, await viewerId(db, c.get('clerkSubject'))), 201)
  }))

  /** Shared body of role change and removal: one transaction under the church lock, so the last administrator is safe. */
  const change = (event: string, parse: boolean) => guarded(db, event, async (c, db, church) => {
    if (!church.canConfigure) return c.json({ error: 'Forbidden' }, 403)
    const next = parse ? memberRoleBody.safeParse(await c.req.json().catch(() => undefined)) : undefined
    if (next && !next.success) return c.json({ error: 'Invalid request' }, 400)
    const userId = c.req.param('userId') ?? ''
    const outcome = await db.$transaction(async tx => {
      await lockChurch(tx, church.churchId)
      const current = await tx.membership.findUnique({ where: { userId_churchId: { userId, churchId: church.churchId } }, select: { role: true, user: { select: { ownership: { select: { id: true } } } } } })
      if (!current) return 'missing' as const
      const admins = await tx.membership.count({ where: { churchId: church.churchId, role: 'ADMIN' } })
      const plan = planMemberChange({ role: current.role, isOwner: current.user.ownership !== null, admins }, next?.success ? next.data.role : 'REMOVE')
      if (plan !== 'ok') return plan
      if (next?.success) await tx.membership.update({ where: { userId_churchId: { userId, churchId: church.churchId } }, data: { role: next.data.role } })
      else await tx.membership.delete({ where: { userId_churchId: { userId, churchId: church.churchId } } })
      return 'done' as const
    })
    if (outcome === 'missing') return c.json({ error: 'Not found' }, 404)
    if (outcome === 'protected') return c.json({ error: 'Protected account' }, 409)
    if (outcome === 'last-admin') return c.json({ error: 'Last administrator' }, 409)
    if (!next) return c.body(null, 204)
    const row = await db.membership.findUniqueOrThrow({ where: { userId_churchId: { userId, churchId: church.churchId } }, select: memberSelect(church.churchId) })
    return c.json(present(row, await viewerId(db, c.get('clerkSubject'))))
  })
  routes.patch('/api/members/:userId', change('member_role_change_failed', true))
  routes.delete('/api/members/:userId', change('member_removal_failed', false))
  return routes
}
