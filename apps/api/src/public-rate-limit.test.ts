import { expect, test } from 'vitest'
import { createApp } from './app.js'
import { createLimiter } from './rate-limit.js'

const path = '/api/public/links/not-a-token'
const call = (api: ReturnType<typeof createApp>, ip: string) => api.request(path, { headers: { 'x-real-ip': ip } })

test('on Vercel the limit is per trusted client IP', async () => {
  const api = createApp({}, undefined, undefined, { publicLimiter: createLimiter({ limit: 2, windowMs: 60_000 }), trustClientIpHeaders: true })
  expect([(await call(api, '203.0.113.1')).status, (await call(api, '203.0.113.1')).status]).toEqual([404, 404])
  const limited = await call(api, '203.0.113.1')
  expect(limited.status).toBe(429)
  expect(limited.headers.get('retry-after')).toBe('60')
  expect((await call(api, '203.0.113.2')).status).toBe(404)
})

test('outside Vercel the forwarded headers are ignored, so they cannot dodge the limit', async () => {
  const api = createApp({}, undefined, undefined, { publicLimiter: createLimiter({ limit: 2, windowMs: 60_000 }) })
  const statuses = []
  for (const ip of ['203.0.113.1', '203.0.113.2', '203.0.113.3']) statuses.push((await call(api, ip)).status)
  expect(statuses).toEqual([404, 404, 429])
})

test('on Vercel a missing or invalid IP header shares one conservative bucket instead of an open one', async () => {
  const api = createApp({}, undefined, undefined, { publicLimiter: createLimiter({ limit: 1, windowMs: 60_000 }), trustClientIpHeaders: true })
  expect((await call(api, 'junk')).status).toBe(404)
  expect((await api.request(path)).status).toBe(429)
})
