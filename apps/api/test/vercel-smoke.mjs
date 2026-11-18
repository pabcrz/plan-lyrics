// Smoke test of the packaged Vercel entry (api/index.mjs over dist/). Run `pnpm build` first.
// It needs no database and no real secrets: it only imports the handler and calls it in-process.
import assert from 'node:assert/strict'

const web = 'https://app.example.com'
process.env.VERCEL = '1'
process.env.WEB_ORIGIN = web
delete process.env.DATABASE_URL
const { default: handler } = await import('../api/index.mjs')
const call = (path, headers = {}, method = 'GET') => handler.fetch(new Request(`https://api.example.com${path}`, { method, headers }))

const health = await call('/api/health', { origin: web })
assert.equal(health.status, 200)
assert.deepEqual(await health.json(), { status: 'ok', service: 'plan-lyrics-api' })
assert.equal(health.headers.get('access-control-allow-origin'), web)

const preflight = await call('/api/services', { origin: web, 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization' }, 'OPTIONS')
assert.equal(preflight.status, 204)
assert.equal(preflight.headers.get('access-control-allow-origin'), web)
assert.equal((await call('/api/health', { origin: 'https://evil.example' })).headers.get('access-control-allow-origin'), null)

const unknown = await call(`/api/public/links/${'A'.repeat(43)}`, { 'x-real-ip': '203.0.113.9' })
assert.equal(unknown.headers.get('x-robots-tag')?.includes('noindex'), true)
assert.equal(unknown.headers.get('referrer-policy'), 'no-referrer')
assert.equal((await call('/api/public/links/not-a-token', { 'x-real-ip': '203.0.113.9' })).status, 404)
assert.equal((await call('/api/session')).status, 401)
console.log('Vercel entry over dist: PASS (health, CORS, preflight, public view headers, 404, 401)')
