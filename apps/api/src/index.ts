import { serve } from '@hono/node-server'
import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { createApp } from './app.js'
import { connectDatabase } from './database.js'
import { authorizedPartyWarning } from './session.js'

const configFile = new URL('../.env.local', import.meta.url)
if (existsSync(configFile)) loadEnvFile(configFile)
const database = process.env.DATABASE_URL?.trim() ? connectDatabase(process.env.DATABASE_URL) : undefined
const partyWarning = authorizedPartyWarning(process.env.CLERK_AUTHORIZED_PARTY)
if (partyWarning) console.warn(partyWarning)
if (!database) console.warn('DATABASE_URL is not set: church access routes respond 503')
const app = createApp({
  jwtKey: process.env.CLERK_JWT_KEY,
  issuer: process.env.CLERK_ISSUER,
  authorizedParty: process.env.CLERK_AUTHORIZED_PARTY,
}, database, undefined, { shareSecret: process.env.SHARE_LINK_SECRET })
if (!process.env.SHARE_LINK_SECRET) console.warn('SHARE_LINK_SECRET is not set: ministry links cannot be created')

serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 3001 })
console.log('API local: http://127.0.0.1:3001')
