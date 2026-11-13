import type { Context } from 'hono'
import type { PrismaClient } from './generated/prisma/client.ts'
import { safeErrorCode } from './errors.js'
import { activeChurch, type Active } from './services.js'
import type { SessionEnvironment } from './session.js'

/** Envelope of the library and setlist routes: the church is always the caller's active one, never the request's. */
export const guarded = (db: PrismaClient | undefined, event: string, handler: (c: Context<SessionEnvironment>, db: PrismaClient, church: Active) => Promise<Response>) =>
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
