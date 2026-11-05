import { Hono } from 'hono'
import { requireSession, type SessionConfig } from './session.js'

export function createApp(config: SessionConfig = {}) {
  const app = new Hono()
  app.get('/api/health', (c) => c.json({ status: 'ok', service: 'plan-lyrics-api' }))
  app.get('/api/session', requireSession(config), (c) => c.json({ authenticated: true }))
  return app
}

export const app = createApp()
