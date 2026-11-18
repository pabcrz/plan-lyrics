import { serve } from '@hono/node-server'
import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { createAppFromEnv } from './runtime.js'

const configFile = new URL('../.env.local', import.meta.url)
if (existsSync(configFile)) loadEnvFile(configFile)
const { app, warnings } = createAppFromEnv(process.env)
for (const warning of warnings) console.warn(warning)

serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 3001 })
console.log('API local: http://127.0.0.1:3001')
