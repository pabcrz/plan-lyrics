import { expect, test } from 'vitest'
import { createAppFromEnv } from './runtime.js'

test('builds the app from the environment without a database or secrets', async () => {
  const { app, warnings } = createAppFromEnv({})
  expect((await app.request('/api/health')).status).toBe(200)
  expect(warnings.join('\n')).toMatch(/DATABASE_URL/)
})

test('reads the web origin from WEB_ORIGIN and trusts IP headers only when VERCEL=1', async () => {
  const web = 'https://app.example.com'
  const vercel = createAppFromEnv({ WEB_ORIGIN: web, VERCEL: '1' }).app
  expect((await vercel.request('/api/health', { headers: { Origin: web } })).headers.get('access-control-allow-origin')).toBe(web)
  const local = createAppFromEnv({ WEB_ORIGIN: web }).app
  expect((await local.request('/api/health', { headers: { Origin: 'https://evil.example' } })).headers.get('access-control-allow-origin')).toBeNull()
})

test('an invalid WEB_ORIGIN is reported and grants nothing', async () => {
  const { app, warnings } = createAppFromEnv({ WEB_ORIGIN: '*' })
  expect(warnings.join('\n')).toMatch(/WEB_ORIGIN/)
  expect((await app.request('/api/health', { headers: { Origin: 'https://anything.example' } })).headers.get('access-control-allow-origin')).toBeNull()
})

test('warnings never contain secret values', () => {
  const { warnings } = createAppFromEnv({ WEB_ORIGIN: 'https://x.example/path', DATABASE_URL: 'postgresql://u:topsecret@h/db', SHARE_LINK_SECRET: 'short-secret' })
  expect(warnings.join('\n')).not.toMatch(/topsecret|short-secret/)
})

test('a SHARE_LINK_SECRET shorter than 32 characters is reported', () => {
  expect(createAppFromEnv({ SHARE_LINK_SECRET: 'short' }).warnings.join('\n')).toMatch(/SHARE_LINK_SECRET/)
})
