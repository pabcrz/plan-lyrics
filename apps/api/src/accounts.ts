import { Hono, type Context } from 'hono'
import type { PrismaClient } from './generated/prisma/client.ts'
import { canManageAccounts, canTargetAccount, inviteBody, libraryEditorBody, linkBody } from './access-rules.js'
import { safeErrorCode } from './errors.js'
import { IDENTITY_UNAVAILABLE, type IdentityProvider } from './identity-provider.js'
import { requireSession, type SessionConfig, type SessionEnvironment } from './session.js'
import { userCapability } from './users.js'

const accountSelect = {
  id: true, email: true, accountManager: true, libraryEditor: true,
  ownership: { select: { id: true } }, person: { select: { id: true, name: true } },
} as const
type AccountRow = { id: string; email: string | null; accountManager: boolean; libraryEditor: boolean; ownership: { id: number } | null; person: { id: string; name: string } | null }
const present = (row: AccountRow) => ({
  id: row.id, email: row.email, accountManager: row.accountManager, libraryEditor: row.libraryEditor, owner: row.ownership !== null, person: row.person,
})

const providerSubject = /^[A-Za-z0-9_-]{1,128}$/
type Caller = { owner: boolean }

export function accountRoutes(config: SessionConfig, db?: PrismaClient, identity?: IdentityProvider) {
  const routes = new Hono<SessionEnvironment>()
  for (const path of ['/api/access', '/api/accounts', '/api/accounts/*']) {
    routes.use(path, requireSession(config))
    routes.use(path, async (c, next) => { await next(); c.header('Cache-Control', 'no-store') })
  }

  // Your own capabilities, read from the database: the web uses them only to decide what to offer.
  routes.get('/api/access', async c => {
    if (!db) return c.json({ error: 'Access unavailable' }, 503)
    try {
      const capability = await userCapability(db, c.get('clerkSubject'))
      return c.json({ owner: Boolean(capability?.owner), accountManager: Boolean(capability?.accountManager) })
    } catch (error) {
      console.error(JSON.stringify({ event: 'access_read_failed', code: safeErrorCode(error) }))
      return c.json({ error: 'Access unavailable' }, 503)
    }
  })

  /** Envelope of the account routes: only the owner and account managers pass; everyone else gets the generic 404. */
  const managed = (event: string, handler: (c: Context<SessionEnvironment>, db: PrismaClient, caller: Caller) => Promise<Response>) =>
    async (c: Context<SessionEnvironment>) => {
      if (!db) return c.json({ error: 'Access unavailable' }, 503)
      try {
        const capability = await userCapability(db, c.get('clerkSubject'))
        if (!canManageAccounts(capability)) return c.json({ error: 'Not found' }, 404)
        return await handler(c, db, { owner: capability.owner })
      } catch (error) {
        console.error(JSON.stringify({ event, code: safeErrorCode(error) }))
        return c.json({ error: 'Access unavailable' }, 503)
      }
    }
  const read = (db: PrismaClient, id: string) => db.user.findUnique({ where: { id }, select: accountSelect })

  // People are listed by name only: no phone and no church, because the manager has no church access.
  routes.get('/api/accounts', managed('accounts_list_failed', async (c, db, caller) => {
    const [accounts, people] = await Promise.all([
      db.user.findMany({ select: accountSelect }),
      db.person.findMany({ where: { userId: null }, select: { id: true, name: true } }),
    ])
    const label = (row: AccountRow) => row.person?.name ?? row.email ?? ''
    return c.json({
      viewer: { owner: caller.owner },
      accounts: accounts.sort((a, b) => label(a).localeCompare(label(b), 'es')).map(present),
      people: people.sort((a, b) => a.name.localeCompare(b.name, 'es')),
    })
  }))

  // Creates the account at the provider (which e-mails the invitation) and the bare local user: no church,
  // role or capability. Inviting the same address again resends the invitation and changes nothing locally.
  routes.post('/api/accounts', managed('account_invitation_failed', async (c, db) => {
    const body = inviteBody.safeParse(await c.req.json().catch(() => undefined))
    if (!body.success) return c.json({ error: 'Invalid request' }, 400)
    if (!identity) return c.json({ error: IDENTITY_UNAVAILABLE }, 503)
    let subject: string
    try {
      subject = (await identity.inviteByEmail(body.data.email)).subject
      if (!providerSubject.test(subject)) throw new Error(IDENTITY_UNAVAILABLE)
    } catch {
      return c.json({ error: IDENTITY_UNAVAILABLE }, 502)
    }
    const existing = await db.user.findUnique({ where: { clerkSubject: subject }, select: { id: true, email: true } })
    try {
      if (existing) {
        if (!existing.email) await db.user.update({ where: { id: existing.id }, data: { email: body.data.email } })
        return c.json(present((await read(db, existing.id))!), 200)
      }
      const created = await db.user.create({ data: { clerkSubject: subject, email: body.data.email }, select: accountSelect })
      return c.json(present(created), 201)
    } catch (error) {
      if (safeErrorCode(error) !== 'P2002') throw error
      // A concurrent invitation of the same account wins; any other unique clash is a real conflict.
      const winner = await db.user.findUnique({ where: { clerkSubject: subject }, select: { id: true } })
      return winner ? c.json(present((await read(db, winner.id))!), 200) : c.json({ error: 'Conflict' }, 409)
    }
  }))

  // An account manager never reaches the owner's account: it answers as if it did not exist.
  const targetable = async (db: Pick<PrismaClient, 'user'>, caller: Caller, id: string) => {
    const row = await db.user.findUnique({ where: { id }, select: accountSelect })
    return row && canTargetAccount(caller, { isOwner: row.ownership !== null }) ? row : undefined
  }

  routes.put('/api/accounts/:userId/person', managed('account_link_failed', async (c, db, caller) => {
    const body = linkBody.safeParse(await c.req.json().catch(() => undefined))
    if (!body.success) return c.json({ error: 'Invalid request' }, 400)
    const userId = c.req.param('userId') ?? ''
    const outcome = await db.$transaction(async tx => {
      const target = await targetable(tx, caller, userId)
      if (!target) return 'missing' as const
      if (target.person) return 'account-linked' as const
      // The condition lives in the write: of two racing links of one person, exactly one matches.
      const linked = await tx.person.updateMany({ where: { id: body.data.personId, userId: null }, data: { userId } })
      if (linked.count === 1) return 'linked' as const
      return await tx.person.findUnique({ where: { id: body.data.personId }, select: { id: true } }) ? 'person-linked' as const : 'missing' as const
    }).catch(error => { if (safeErrorCode(error) === 'P2002') return 'account-linked' as const; throw error })
    if (outcome === 'missing') return c.json({ error: 'Not found' }, 404)
    if (outcome === 'account-linked') return c.json({ error: 'Account linked' }, 409)
    if (outcome === 'person-linked') return c.json({ error: 'Person linked' }, 409)
    return c.json(present((await read(db, userId))!))
  }))

  // Unlinking removes only the link: memberships, capabilities and the person stay as they were.
  routes.delete('/api/accounts/:userId/person', managed('account_unlink_failed', async (c, db, caller) => {
    const userId = c.req.param('userId') ?? ''
    if (!await targetable(db, caller, userId)) return c.json({ error: 'Not found' }, 404)
    const unlinked = await db.person.updateMany({ where: { userId }, data: { userId: null } })
    return unlinked.count > 0 ? c.body(null, 204) : c.json({ error: 'Not found' }, 404)
  }))

  // Strictest reading of the open product decision: only the platform owner grants library editing.
  routes.put('/api/accounts/:userId/library-editor', managed('library_editor_change_failed', async (c, db, caller) => {
    if (!caller.owner) return c.json({ error: 'Not found' }, 404)
    const body = libraryEditorBody.safeParse(await c.req.json().catch(() => undefined))
    if (!body.success) return c.json({ error: 'Invalid request' }, 400)
    const userId = c.req.param('userId') ?? ''
    const changed = await db.user.updateMany({ where: { id: userId, ownership: { is: null } }, data: { libraryEditor: body.data.enabled } })
    if (changed.count === 0) return c.json({ error: 'Not found' }, 404)
    return c.json(present((await read(db, userId))!))
  }))
  return routes
}
