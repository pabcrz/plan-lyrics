import { serve } from '@hono/node-server'
import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { createApp } from './app.js'
import { connectDatabase } from './database.js'

const configFile = new URL('../.env.local', import.meta.url)
if (existsSync(configFile)) loadEnvFile(configFile)
const database = process.env.DATABASE_URL?.trim() ? connectDatabase(process.env.DATABASE_URL) : undefined
const app = createApp({ jwtKey: process.env.CLERK_JWT_KEY, issuer: process.env.CLERK_ISSUER }, database)

serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 3001 })
console.log('API local: http://127.0.0.1:3001')
