import assert from 'node:assert/strict'
import { createApp } from '../dist/app.js'
import { connectDatabase } from '../dist/database.js'
import { sessionFixture } from './session-fixture.mjs'

const url = process.env.TEST_DATABASE_URL
assert.match(url ?? '', /^postgresql:\/\/planlyrics_fixture@127\.0\.0\.1:\d+\/plan_lyrics_access_fixture$/)
const db = connectDatabase(url)
const fixture = sessionFixture()
const app = createApp(fixture.config, db)
try {
  const request = (subject, church) => app.request(`/api/churches/${church}`, {
    headers: subject ? { Authorization: `Bearer ${fixture.token(subject)}` } : {},
  })
  const owner = await request('fixture-owner', 'church-b')
  assert.equal(owner.status, 200)
  assert.deepEqual(await owner.json(), { id: 'church-b', name: 'Fixture Church B' })
  const crossChurch = await request('fixture-member', 'church-b')
  assert.equal(crossChurch.status, 404)
  assert.deepEqual(await crossChurch.json(), { error: 'Not found' })
  const anonymous = await request(undefined, 'church-a')
  assert.equal(anonymous.status, 401)
  assert.deepEqual(await anonymous.json(), { error: 'Unauthorized' })
  console.log('Built Node runtime: PASS (owner 200, cross-church 404, no Bearer 401)')
} finally { await db.$disconnect() }
