import { verifyToken } from '@clerk/backend'
import { createMiddleware } from 'hono/factory'

export type SessionConfig = { jwtKey?: string; issuer?: string }
const origin = 'http://127.0.0.1:5173'

export function requireSession(config: SessionConfig) {
  return createMiddleware(async (c, next) => {
    c.header('Cache-Control', 'no-store')
    const reject = () => {
      c.header('WWW-Authenticate', 'Bearer')
      return c.json({ error: 'Unauthorized' }, 401)
    }
    const match = /^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/i.exec(c.req.header('Authorization') ?? '')
    if (!match) return reject()
    if (!config.jwtKey?.trim() || !config.issuer?.trim()) {
      return c.json({ error: 'Authentication unavailable' }, 503)
    }
    try {
      const claims = await verifyToken(match[1], {
        jwtKey: config.jwtKey, issuer: config.issuer, authorizedParties: [origin],
      })
      // A verified JWT is not necessarily a session token; require session identity.
      if (claims.azp !== origin || typeof claims.sub !== 'string' || !claims.sub ||
          typeof claims.sid !== 'string' || !claims.sid) return reject()
    } catch {
      // Never return/log the token, verification key, claims or SDK error details.
      return reject()
    }
    await next()
  })
}
