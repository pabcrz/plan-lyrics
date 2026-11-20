import { createApp } from './app.js'
import { connectDatabase } from './database.js'
import { identityProviderFromEnv } from './identity-provider.js'
import { authorizedPartyWarning } from './session.js'
import { secretIsUsable } from './share-token.js'
import { parseWebOrigins } from './web-origins.js'

type Environment = Record<string, string | undefined>

/**
 * Builds the app from environment variables. It is the only place that reads them, shared by the local Node server
 * (`index.ts`) and the Vercel Function (`api/index.mjs`). `warnings` never include values: they may carry secrets.
 * IP headers are trusted only when `VERCEL=1`, which the platform sets itself.
 */
export function createAppFromEnv(env: Environment) {
  const warnings: string[] = []
  const database = env.DATABASE_URL?.trim() ? connectDatabase(env.DATABASE_URL) : undefined
  if (!database) warnings.push('DATABASE_URL is not set: church access routes respond 503')
  const partyWarning = authorizedPartyWarning(env.CLERK_AUTHORIZED_PARTY)
  if (partyWarning) warnings.push(partyWarning)
  const identity = identityProviderFromEnv(env.CLERK_SECRET_KEY, env.CLERK_AUTHORIZED_PARTY?.trim() || undefined)
  if (!identity) warnings.push('CLERK_SECRET_KEY is not set: creating accounts and sending invitations respond 503')
  if (!secretIsUsable(env.SHARE_LINK_SECRET)) warnings.push('SHARE_LINK_SECRET is missing or shorter than 32 characters: ministry links cannot be created')
  const web = parseWebOrigins(env.WEB_ORIGIN)
  if (web.rejected) warnings.push(`WEB_ORIGIN has ${web.rejected} invalid entr${web.rejected === 1 ? 'y' : 'ies'}: use exact origins such as https://app.example.com, no wildcards or paths`)
  const app = createApp({
    jwtKey: env.CLERK_JWT_KEY,
    issuer: env.CLERK_ISSUER,
    authorizedParty: env.CLERK_AUTHORIZED_PARTY,
  }, database, undefined, {
    shareSecret: env.SHARE_LINK_SECRET, identity, allowedOrigins: web.origins, trustClientIpHeaders: env.VERCEL === '1',
  })
  return { app, warnings }
}
