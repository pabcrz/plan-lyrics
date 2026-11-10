import { Hono } from 'hono'
import { requireSession, type SessionConfig, type SessionEnvironment } from './session.js'
import type { PrismaClient } from './generated/prisma/client.ts'
import { readChurch } from './church-access.js'

export function createApp(config: SessionConfig = {}, database?: PrismaClient) {
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
  return app
}

export const app = createApp()

function safeErrorCode(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' && /^[A-Z0-9_]{1,32}$/.test(code) ? code : 'unknown'
}
