import { Hono } from 'hono'
import { requireSession, type SessionConfig, type SessionEnvironment } from './session.js'
import type { PrismaClient } from './generated/prisma/client.ts'
import { readChurch } from './church-access.js'
import { safeErrorCode } from './errors.js'
import { roleRoutes } from './roles.js'
import { serviceRoutes } from './services.js'
import { accountManagerBody, createUser, newUserBody, setAccountManager, userCapability } from './users.js'

export function createApp(config: SessionConfig = {}, database?: PrismaClient, now?: () => Date) {
  const app = new Hono<SessionEnvironment>()
  app.get('/api/health', (c) => c.json({ status: 'ok', service: 'plan-lyrics-api' }))
  app.get('/api/session', requireSession(config), (c) => c.json({ authenticated: true }))
  app.get('/api/churches/:churchId', requireSession(config), async (c) => {
    if (!database) return c.json({ error: 'Access unavailable' }, 503)
    try {
      const church = await readChurch(database, c.get('clerkSubject'), c.req.param('churchId'))
      return church ? c.json(church) : c.json({ error: 'Not found' }, 404)
    } catch (error) {
      // Log only a short driver/Prisma code: never messages, connection strings or identities.
      console.error(JSON.stringify({ event: 'church_access_failed', code: safeErrorCode(error) }))
      return c.json({ error: 'Access unavailable' }, 503)
    }
  })
  app.post('/api/users', requireSession(config), async (c) => {
    if (!database) return c.json({ error: 'Access unavailable' }, 503)
    try {
      const capability = await userCapability(database, c.get('clerkSubject'))
      if (!capability?.owner && !capability?.accountManager) return c.json({ error: 'Not found' }, 404)
      const body = newUserBody.safeParse(await c.req.json().catch(() => undefined))
      if (!body.success) return c.json({ error: 'Invalid request' }, 400)
      return c.json(await createUser(database, body.data.clerkSubject), 201)
    } catch (error) {
      if (safeErrorCode(error) === 'P2002') return c.json({ error: 'Conflict' }, 409)
      console.error(JSON.stringify({ event: 'user_creation_failed', code: safeErrorCode(error) }))
      return c.json({ error: 'Access unavailable' }, 503)
    }
  })
  app.put('/api/users/:userId/account-manager', requireSession(config), async (c) => {
    if (!database) return c.json({ error: 'Access unavailable' }, 503)
    try {
      const capability = await userCapability(database, c.get('clerkSubject'))
      if (!capability?.owner) return c.json({ error: 'Not found' }, 404)
      const body = accountManagerBody.safeParse(await c.req.json().catch(() => undefined))
      if (!body.success) return c.json({ error: 'Invalid request' }, 400)
      const user = await setAccountManager(database, c.req.param('userId'), body.data.enabled)
      return user ? c.json(user) : c.json({ error: 'Not found' }, 404)
    } catch (error) {
      console.error(JSON.stringify({ event: 'account_manager_change_failed', code: safeErrorCode(error) }))
      return c.json({ error: 'Access unavailable' }, 503)
    }
  })
  app.route('/', serviceRoutes(config, database, now))
  app.route('/', roleRoutes(config, database))
  return app
}

export const app = createApp()
