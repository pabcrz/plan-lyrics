import { serve } from '@hono/node-server'
import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { createApp } from './app.js'

const configFile = new URL('../.env.local', import.meta.url)
if (existsSync(configFile)) loadEnvFile(configFile)
const app = createApp({ jwtKey: process.env.CLERK_JWT_KEY, issuer: process.env.CLERK_ISSUER })

serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 3001 })
console.log('API local: http://127.0.0.1:3001')
