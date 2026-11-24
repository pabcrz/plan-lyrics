import { verifyToken } from '@clerk/backend'
import { createMiddleware } from 'hono/factory'

export type SessionConfig = { jwtKey?: string; issuer?: string; authorizedParty?: string }
export type SessionEnvironment = { Variables: { clerkSubject: string } }
const localOrigin = 'http://127.0.0.1:5173'

function exactOrigin(value: string) {
  try {
    return new URL(value).origin === value
  } catch {
    return false
  }
}

/**
 * `CLERK_AUTHORIZED_PARTY`: one or more exact web origins separated by commas (e.g. production plus a stable preview).
 * Absent means the local origin only. Any invalid entry fails closed (undefined) instead of being dropped or widened.
 */
export function authorizedOrigins(value?: string) {
  const entries = (value?.trim() ? value.split(',').map(part => part.trim()) : [localOrigin])
  return entries.length > 0 && entries.every(exactOrigin) ? entries : undefined
}

// Startup diagnostics only: a missing value silently means "local origin only".
export function authorizedPartyWarning(value?: string) {
  if (!value?.trim()) return `CLERK_AUTHORIZED_PARTY is not set: accepting only the local origin ${localOrigin}`
  if (!authorizedOrigins(value)) return 'CLERK_AUTHORIZED_PARTY has an entry that is not an exact origin: authenticated routes respond 503'
  return undefined
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
    const origins = authorizedOrigins(config.authorizedParty)
    if (!config.jwtKey?.trim() || !config.issuer?.trim() || !origins) {
      return c.json({ error: 'Authentication unavailable' }, 503)
    }
    try {
      const claims = await verifyToken(match[1], {
        jwtKey: config.jwtKey, issuer: config.issuer, authorizedParties: origins,
      })
      // A verified JWT is not necessarily a session token; require session identity.
      if (typeof claims.azp !== 'string' || !origins.includes(claims.azp) || typeof claims.sub !== 'string' || !claims.sub ||
          typeof claims.sid !== 'string' || !claims.sid) return reject()
      c.set('clerkSubject', claims.sub)
    } catch {
      // Never return/log the token, verification key, claims or SDK error details.
      return reject()
    }
    await next()
  })
}
