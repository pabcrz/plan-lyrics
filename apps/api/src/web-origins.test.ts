import { expect, test } from 'vitest'
import { createApp } from './app.js'
import { parseWebOrigins } from './web-origins.js'

test('accepts exact https origins and a comma-separated list', () => {
  expect(parseWebOrigins('https://app.example.com')).toEqual({ origins: ['https://app.example.com'], rejected: 0 })
  expect(parseWebOrigins(' https://a.example.com , https://b.example.com ').origins).toEqual(['https://a.example.com', 'https://b.example.com'])
})

test('allows plain http only for loopback development', () => {
  expect(parseWebOrigins('http://127.0.0.1:5173').origins).toEqual(['http://127.0.0.1:5173'])
  expect(parseWebOrigins('http://localhost:5173').origins).toEqual(['http://localhost:5173'])
  expect(parseWebOrigins('http://app.example.com').origins).toEqual([])
})

test('rejects wildcards, paths, trailing slashes and garbage; nothing falls back to open', () => {
  const result = parseWebOrigins('*,https://*.example.com,https://app.example.com/,https://app.example.com/x,nonsense')
  expect(result.origins).toEqual([])
  expect(result.rejected).toBe(5)
})

test('an unset or empty value means no cross-origin access', () => {
  expect(parseWebOrigins(undefined)).toEqual({ origins: [], rejected: 0 })
  expect(parseWebOrigins('  ')).toEqual({ origins: [], rejected: 0 })
})

const web = 'https://app.example.com'

test('CORS answers only the configured web origin, without credentials or wildcard', async () => {
  const api = createApp({}, undefined, undefined, { allowedOrigins: [web] })
  const allowed = await api.request('/api/health', { headers: { Origin: web } })
  expect(allowed.headers.get('access-control-allow-origin')).toBe(web)
  expect(allowed.headers.get('access-control-allow-credentials')).toBeNull()
  expect(allowed.headers.get('vary')).toMatch(/Origin/i)
  const other = await api.request('/api/health', { headers: { Origin: 'https://evil.example' } })
  expect(other.headers.get('access-control-allow-origin')).toBeNull()
})

test('preflight for an authenticated call is answered for the web origin only', async () => {
  const api = createApp({}, undefined, undefined, { allowedOrigins: [web] })
  const preflight = (origin: string) => api.request('/api/services', { method: 'OPTIONS', headers: {
    Origin: origin, 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'authorization,content-type',
  } })
  const ok = await preflight(web)
  expect(ok.status).toBe(204)
  expect(ok.headers.get('access-control-allow-origin')).toBe(web)
  expect(ok.headers.get('access-control-allow-headers')).toMatch(/authorization/i)
  expect(ok.headers.get('access-control-allow-methods')).toMatch(/PUT/)
  const denied = await preflight('https://evil.example')
  expect(denied.headers.get('access-control-allow-origin')).toBeNull()
})

test('the public view keeps its privacy headers and gets CORS for the web origin', async () => {
  const api = createApp({}, undefined, undefined, { allowedOrigins: [web] })
  const response = await api.request(`/api/public/links/${'A'.repeat(43)}`, { headers: { Origin: web } })
  expect(response.headers.get('access-control-allow-origin')).toBe(web)
  expect(response.headers.get('x-robots-tag')).toMatch(/noindex/)
  expect(response.headers.get('referrer-policy')).toBe('no-referrer')
})

test('without configured origins no CORS headers are sent', async () => {
  const response = await createApp().request('/api/health', { headers: { Origin: web } })
  expect(response.headers.get('access-control-allow-origin')).toBeNull()
})
