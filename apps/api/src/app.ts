import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { requireSession, type SessionConfig, type SessionEnvironment } from './session.js'
import type { PrismaClient } from './generated/prisma/client.ts'
import { accountRoutes } from './accounts.js'
import { createChurch, myChurches, newChurchBody, readChurch } from './church-access.js'
import { safeErrorCode } from './errors.js'
import type { IdentityProvider } from './identity-provider.js'
import { memberRoutes } from './members.js'
import { participationRoutes } from './participations.js'
import { preachingRoutes } from './preaching.js'
import { roleRoutes } from './roles.js'
import { serviceRoutes } from './services.js'
import type { Limiter } from './rate-limit.js'
import { setlistRoutes } from './setlist.js'
import { shareLinkRoutes } from './share-links.js'
import { publicShareRoutes } from './share-view.js'
import { lyricsRoutes } from './lyrics.js'
import { songRoutes } from './songs.js'
import { accountManagerBody, createUser, newUserBody, setAccountManager, userCapability } from './users.js'

/**
 * `shareSecret` derives the tokens of ministry links (`SHARE_LINK_SECRET`); `publicLimiter` throttles the public view;
 * `identity` is the authentication provider port used to create accounts and send invitations (absent: those routes answer 503).
 */
export type AppOptions = {
  shareSecret?: string; publicLimiter?: Limiter; identity?: IdentityProvider
  /** Exact web origins allowed by CORS; empty or absent sends no CORS headers. */
  allowedOrigins?: string[]
  /** Read the client IP from Vercel's forwarded headers. Only for a deployment really behind Vercel. */
  trustClientIpHeaders?: boolean
}

export function createApp(config: SessionConfig = {}, database?: PrismaClient, now: () => Date = () => new Date(), options: AppOptions = {}) {
  const app = new Hono<SessionEnvironment>()
  const allowedOrigins = options.allowedOrigins ?? []
  if (allowedOrigins.length) {
    // Bearer tokens travel in a header, never in cookies: no credentials, and only the configured web origins.
    app.use('/api/*', cors({
      origin: origin => (allowedOrigins.includes(origin) ? origin : null),
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Authorization', 'Content-Type', 'X-Church-Id'],
      maxAge: 600,
    }))
  }
  app.get('/api/health', (c) => c.json({ status: 'ok', service: 'plan-lyrics-api' }))
  app.get('/api/session', requireSession(config), (c) => c.json({ authenticated: true }))
  app.get('/api/me/churches', requireSession(config), async (c) => {
    if (!database) return c.json({ error: 'Access unavailable' }, 503)
    try {
      return c.json(await myChurches(database, c.get('clerkSubject')))
    } catch (error) {
      console.error(JSON.stringify({ event: 'my_churches_failed', code: safeErrorCode(error) }))
      return c.json({ error: 'Access unavailable' }, 503)
    }
  })
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
  // Only the platform owner founds churches (the first one is how a fresh deployment gets started).
  app.post('/api/churches', requireSession(config), async (c) => {
    if (!database) return c.json({ error: 'Access unavailable' }, 503)
    try {
      const capability = await userCapability(database, c.get('clerkSubject'))
      if (!capability?.owner) return c.json({ error: 'Not found' }, 404)
      const body = newChurchBody.safeParse(await c.req.json().catch(() => undefined))
      if (!body.success) return c.json({ error: 'Invalid request' }, 400)
      const church = await createChurch(database, c.get('clerkSubject'), body.data.name, body.data.addMe)
      return church ? c.json(church, 201) : c.json({ error: 'Not found' }, 404)
    } catch (error) {
      console.error(JSON.stringify({ event: 'church_creation_failed', code: safeErrorCode(error) }))
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
  app.route('/', accountRoutes(config, database, options.identity))
  app.route('/', memberRoutes(config, database, options.identity))
  app.route('/', serviceRoutes(config, database, now))
  app.route('/', roleRoutes(config, database, now))
  app.route('/', participationRoutes(config, database, now))
  app.route('/', preachingRoutes(config, database, now))
  app.route('/', songRoutes(config, database, now))
  app.route('/', lyricsRoutes(config, database))
  app.route('/', setlistRoutes(config, database))
  app.route('/', shareLinkRoutes(config, database, now, options.shareSecret))
  app.route('/', publicShareRoutes(database, now, options.publicLimiter, options.trustClientIpHeaders))
  return app
}

export const app = createApp()
