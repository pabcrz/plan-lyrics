import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { createApp } from '../src/app.js'
import { connectDatabase } from '../src/database.ts'
import { seedFixtures } from './fixtures.ts'
import { sessionFixture } from './session-fixture.mjs'

const url = process.env.TEST_DATABASE_URL
if (!url || !/^postgresql:\/\/planlyrics_fixture@127\.0\.0\.1:\d+\/plan_lyrics_access_fixture$/.test(url)) throw new Error('Use pnpm test:db')
const db = connectDatabase(url)
const fixture = sessionFixture()
// Fixed clock: Thursday 12 Nov 2026, 12:00 in Mexico City.
let clock = new Date('2026-11-12T18:00:00Z')
const api = createApp(fixture.config, db, () => clock)
beforeAll(() => seedFixtures(db))
beforeEach(async () => { clock = new Date('2026-11-12T18:00:00Z'); await db.closedDate.deleteMany(); await db.service.deleteMany() })
afterAll(() => db.$disconnect())

function call(subject: string | undefined, method: string, path: string, body?: unknown) {
  return api.request(path, {
    method,
    headers: { ...(subject ? { Authorization: `Bearer ${fixture.token(`fixture-${subject}`)}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}
const mark = (subject: string | undefined, date: string, body: unknown = {}) => call(subject, 'PUT', `/api/closed-dates/${date}`, body)
const unmark = (subject: string, date: string) => call(subject, 'DELETE', `/api/closed-dates/${date}`)
const list = async (subject: string, month = '2026-11') => (await call(subject, 'GET', `/api/closed-dates?month=${month}`)).json()
const service = { title: 'Servicio de viernes', date: '2026-11-20', status: 'DRAFT', directorId: 'person-a' }

test('an editor and an admin mark a date with an optional reason; any member reads it', async () => {
  const marked = await mark('editor', '2026-11-20', { reason: '  Feriado  ' })
  expect(marked.status).toBe(201)
  expect(await marked.json()).toEqual({ date: '2026-11-20', reason: 'Feriado' })
  expect((await mark('admin', '2026-11-27')).status).toBe(201)
  expect(await list('member')).toEqual([{ date: '2026-11-20', reason: 'Feriado' }, { date: '2026-11-27', reason: null }])
  expect(await list('member', '2026-12')).toEqual([])
})

test('marking again updates the reason and does not duplicate the date', async () => {
  await mark('editor', '2026-11-20', { reason: 'Feriado' })
  const again = await mark('editor', '2026-11-20', { reason: 'Retiro' })
  expect(again.status).toBe(200)
  expect(await db.closedDate.count()).toBe(1)
  expect(await list('editor')).toEqual([{ date: '2026-11-20', reason: 'Retiro' }])
  await mark('editor', '2026-11-20', {})
  expect(await list('editor')).toEqual([{ date: '2026-11-20', reason: null }])
})

test('a member without edit permission can only read; no session is refused', async () => {
  expect((await mark('member', '2026-11-20')).status).toBe(403)
  expect((await unmark('member', '2026-11-20')).status).toBe(403)
  expect(await db.closedDate.count()).toBe(0)
  await mark('editor', '2026-11-20')
  expect((await unmark('member', '2026-11-20')).status).toBe(403)
  expect(await db.closedDate.count()).toBe(1)
  for (const response of [await mark(undefined, '2026-11-20'), await call(undefined, 'GET', '/api/closed-dates?month=2026-11'), await call(undefined, 'DELETE', '/api/closed-dates/2026-11-20')]) {
    expect(response.status).toBe(401)
  }
})

test('past dates are refused, today is valid all day (Mexico City midnight)', async () => {
  const past = await mark('editor', '2026-11-11')
  expect(past.status).toBe(400)
  expect(await past.json()).toEqual({ error: 'Date in the past' })
  expect((await mark('editor', '2026-11-12')).status).toBe(201)
  clock = new Date('2026-11-13T05:59:59Z')
  expect((await mark('editor', '2026-11-12', { reason: 'Aún hoy' })).status).toBe(200)
  clock = new Date('2026-11-13T06:00:00Z')
  expect((await mark('editor', '2026-11-12', { reason: 'Ya pasó' })).status).toBe(400)
  expect(await list('editor')).toEqual([{ date: '2026-11-12', reason: 'Aún hoy' }])
})

test('a date that already has a service cannot be marked', async () => {
  expect((await call('editor', 'POST', '/api/services', service)).status).toBe(201)
  const refused = await mark('editor', '2026-11-20')
  expect(refused.status).toBe(409)
  expect(await refused.json()).toEqual({ error: 'Date has service' })
  expect(await db.closedDate.count()).toBe(0)
})

test('a marked date rejects creating a service, and unmarking makes it available again', async () => {
  await mark('editor', '2026-11-20', { reason: 'Feriado' })
  const refused = await call('editor', 'POST', '/api/services', service)
  expect(refused.status).toBe(409)
  expect(await refused.json()).toEqual({ error: 'Date closed' })
  expect(await db.service.count()).toBe(0)
  expect((await unmark('editor', '2026-11-20')).status).toBe(204)
  expect(await list('editor')).toEqual([])
  expect((await call('editor', 'POST', '/api/services', service)).status).toBe(201)
})

test('a double Sunday marked as closed refuses both slots', async () => {
  await mark('b-editor', '2026-11-15')
  const body = { title: 'Culto', date: '2026-11-15', status: 'PUBLISHED', directorId: 'person-b' }
  expect((await call('b-editor', 'POST', '/api/services', { ...body, slot: 'MORNING', time: '09:00' })).status).toBe(409)
  expect((await call('b-editor', 'POST', '/api/services', { ...body, slot: 'AFTERNOON', time: '17:00' })).status).toBe(409)
  expect(await db.service.count()).toBe(0)
})

test('unmarking a date that is not marked is a 404; unmarking leaves other dates', async () => {
  expect((await unmark('editor', '2026-11-20')).status).toBe(404)
  await mark('editor', '2026-11-20')
  await mark('editor', '2026-11-27')
  expect((await unmark('editor', '2026-11-20')).status).toBe(204)
  expect(await list('editor')).toEqual([{ date: '2026-11-27', reason: null }])
})

test('dates are isolated between churches and the church never comes from the client', async () => {
  await mark('editor', '2026-11-20', { reason: 'Solo A' })
  expect(await list('b-editor')).toEqual([])
  // Church B can use the same date independently, and cannot unmark church A's.
  expect((await mark('b-editor', '2026-11-20')).status).toBe(201)
  expect((await unmark('b-editor', '2026-11-20')).status).toBe(204)
  expect(await list('editor')).toEqual([{ date: '2026-11-20', reason: 'Solo A' }])
  expect((await mark('editor', '2026-11-27', { churchId: 'church-b' })).status).toBe(400)
  expect((await db.closedDate.findMany()).map(row => row.churchId)).toEqual(['church-a'])
  // A service in church B does not block church A, and vice versa.
  await call('b-editor', 'POST', '/api/services', { ...service, date: '2026-11-27', directorId: 'person-b' })
  expect((await mark('editor', '2026-11-27')).status).toBe(201)
})

test('validates the date, the month and the reason', async () => {
  for (const date of ['2026-02-30', '2026-13-01', 'hoy', '20261120']) expect((await mark('editor', date)).status).toBe(400)
  for (const body of [{ reason: '' }, { reason: '   ' }, { reason: 'x'.repeat(121) }, { reason: 5 }, { other: 1 }]) expect((await mark('editor', '2026-11-20', body)).status).toBe(400)
  expect((await mark('editor', '2026-11-20', { reason: 'x'.repeat(120) })).status).toBe(201)
  expect((await call('member', 'GET', '/api/closed-dates?month=2026-13')).status).toBe(400)
  expect((await call('member', 'GET', '/api/closed-dates')).status).toBe(400)
  expect((await unmark('editor', 'hoy')).status).toBe(400)
})

test('the active church comes from the only membership; none or several are refused', async () => {
  for (const subject of ['library', 'accounts', 'unknown', 'owner']) {
    expect((await call(subject, 'GET', '/api/closed-dates?month=2026-11')).status).toBe(404)
    expect((await mark(subject, '2026-11-20')).status).toBe(404)
  }
  expect((await call('multi', 'GET', '/api/closed-dates?month=2026-11')).status).toBe(409)
  expect((await mark('multi', '2026-11-20')).status).toBe(409)
  expect(await db.closedDate.count()).toBe(0)
})
