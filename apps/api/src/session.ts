import { verifyToken } from '@clerk/backend'
import { createMiddleware } from 'hono/factory'

export type SessionConfig = { jwtKey?: string; issuer?: string; authorizedParty?: string }
export type SessionEnvironment = { Variables: { clerkSubject: string } }
const localOrigin = 'http://127.0.0.1:5173'

// The authorized party must be one exact web origin; anything else fails closed.
function authorizedOrigin(value = localOrigin) {
  try {
    return new URL(value).origin === value ? value : undefined
  } catch {
    return undefined
  }
}

export function requireSession(config: SessionConfig) {
  return createMiddleware<SessionEnvironment>(async (c, next) => {
    c.header('Cache-Control', 'no-store')
    const reject = () => {
      c.header('WWW-Authenticate', 'Bearer')
      return c.json({ error: 'Unauthorized' }, 401)
    }
    const match = /^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/i.exec(c.req.header('Authorization') ?? '')
    if (!match) return reject()
    const origin = authorizedOrigin(config.authorizedParty?.trim() || undefined)
    if (!config.jwtKey?.trim() || !config.issuer?.trim() || !origin) {
      return c.json({ error: 'Authentication unavailable' }, 503)
    }
    try {
      const claims = await verifyToken(match[1], {
        jwtKey: config.jwtKey, issuer: config.issuer, authorizedParties: [origin],
      })
      // A verified JWT is not necessarily a session token; require session identity.
      if (claims.azp !== origin || typeof claims.sub !== 'string' || !claims.sub ||
          typeof claims.sid !== 'string' || !claims.sid) return reject()
      c.set('clerkSubject', claims.sub)
    } catch {
      // Never return/log the token, verification key, claims or SDK error details.
      return reject()
    }
    await next()
  })
}
