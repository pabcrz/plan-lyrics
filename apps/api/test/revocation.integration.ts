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
afterAll(async () => { await seedFixtures(db); await db.$disconnect() })

const read = (subject: string) => api.request('/api/churches/church-a', {
  headers: { Authorization: `Bearer ${fixture.token(subject)}` },
})

test('persisted access changes apply to already issued tokens immediately', async () => {
  const member = fixture.token('fixture-member')
  const asMember = () => api.request('/api/churches/church-a', { headers: { Authorization: `Bearer ${member}` } })
  expect((await asMember()).status).toBe(200)
  await db.membership.deleteMany({ where: { userId: 'member' } })
  const revoked = await asMember()
  expect(revoked.status).toBe(404)
  expect(await revoked.json()).toEqual({ error: 'Not found' })
  await db.platformOwner.deleteMany()
  expect((await read('fixture-owner')).status).toBe(404)
})
