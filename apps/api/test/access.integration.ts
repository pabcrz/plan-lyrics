import { afterAll, beforeAll, expect, test } from 'vitest'
import { createApp } from '../src/app.js'
import { connectDatabase } from '../src/database.ts'
import { seedFixtures } from './fixtures.ts'
import { sessionFixture } from './session-fixture.mjs'

const url = process.env.TEST_DATABASE_URL
if (!url || !/^postgresql:\/\/planlyrics_fixture@127\.0\.0\.1:\d+\/plan_lyrics_access_fixture$/.test(url)) throw new Error('Use pnpm test:db')
const db = connectDatabase(url)
const fixture = sessionFixture()
const api = createApp(fixture.config, db)
beforeAll(() => seedFixtures(db))
afterAll(() => db.$disconnect())
async function request(subject?: string, church = 'church-a', target = api, claims = {}) {
  return target.request(`/api/churches/${encodeURIComponent(church)}`, {
    headers: subject ? { Authorization: `Bearer ${fixture.token(subject, claims)}` } : {},
  })
}
async function result(response: Response, status: number, body: unknown) {
  expect(response.status).toBe(status)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(await response.json()).toEqual(body)
}

test.each(['member', 'admin', 'editor', 'combined'])('permits only the local church for %s', async role => {
  await result(await request(`fixture-${role}`), 200, { id: 'church-a', name: 'Fixture Church A' })
  await result(await request(`fixture-${role}`, 'church-b'), 404, { error: 'Not found' })
})

test.each(['church-a', 'church-b'])('owner reads %s without a membership', async church => {
  await result(await request('fixture-owner', church), 200, { id: church, name: church === 'church-a' ? 'Fixture Church A' : 'Fixture Church B' })
})

test.each(['fixture-library', 'fixture-accounts', 'fixture-unknown', "fixture-owner' OR TRUE --"])('does not infer access from identity or library capability: %s', async subject => {
  await result(await request(subject, 'church-a', api, { role: 'superadmin' }), 404, { error: 'Not found' })
})

test('does not disclose missing churches or interpolate requested ids into SQL', async () => {
  for (const church of ['missing', "church-a' OR TRUE --"]) {
    await result(await request('fixture-owner', church), 404, { error: 'Not found' })
  }
})

test('rejects missing and expired credentials before database access', async () => {
  for (const response of [await request(), await request('fixture-owner', 'church-a', api, { exp: 1 })]) {
    expect(response.headers.get('www-authenticate')).toBe('Bearer')
    await result(response, 401, { error: 'Unauthorized' })
  }
})

test('does not provision unknown users or change stored access after rejection', async () => {
  const before = { users: await db.user.findMany(), memberships: await db.membership.findMany(), owners: await db.platformOwner.findMany() }
  await request('fixture-unknown')
  await request('fixture-member', 'church-b')
  expect({ users: await db.user.findMany(), memberships: await db.membership.findMany(), owners: await db.platformOwner.findMany() }).toEqual(before)
})

test('fails closed with missing/unavailable database, without changing session and health', async () => {
  const missing = createApp(fixture.config)
  await result(await request('fixture-owner', 'church-a', missing), 503, { error: 'Access unavailable' })
  const unavailableDb = connectDatabase(`${url}_missing`)
  try {
    await result(await request('fixture-owner', 'church-a', createApp(fixture.config, unavailableDb)), 503, { error: 'Access unavailable' })
  } finally { await unavailableDb.$disconnect() }
  const session = await missing.request('/api/session', { headers: { Authorization: `Bearer ${fixture.token('fixture-unknown')}` } })
  await result(session, 200, { authenticated: true })
  const health = await missing.request('/api/health')
  expect(health.status).toBe(200)
  expect(await health.json()).toEqual({ status: 'ok', service: 'plan-lyrics-api' })
})
