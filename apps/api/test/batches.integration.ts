import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { createApp } from '../src/app.js'
import { connectDatabase } from '../src/database.ts'
import { seedFixtures } from './fixtures.ts'
import { sessionFixture } from './session-fixture.mjs'

const url = process.env.TEST_DATABASE_URL
if (!url || !/^postgresql:\/\/planlyrics_fixture@127\.0\.0\.1:\d+\/plan_lyrics_access_fixture$/.test(url)) throw new Error('Use pnpm test:db')
const db = connectDatabase(url)
const fixture = sessionFixture()
// Thursday 12 Nov 2026, 12:00 in Mexico City.
let clock = new Date('2026-11-12T18:00:00Z')
const api = createApp(fixture.config, db, () => clock)
const reset = async () => {
  clock = new Date('2026-11-12T18:00:00Z')
  await db.batchDirectors.deleteMany()
  await db.closedDate.deleteMany()
  await db.service.deleteMany()
  await db.churchPerson.updateMany({ data: { removedAt: null } })
}
beforeAll(async () => { await seedFixtures(db); await reset() })
beforeEach(reset)
afterAll(async () => { await reset(); await db.$disconnect() })

function call(subject: string | undefined, method: string, path: string, body?: unknown) {
  return api.request(path, {
    method,
    headers: { ...(subject ? { Authorization: `Bearer ${fixture.token(`fixture-${subject}`)}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}
const period = (subject: string | undefined, query = 'month=2026-11&weekdays=5') => call(subject, 'GET', `/api/service-batches/period?${query}`)
const post = (subject: string | undefined, body: unknown) => call(subject, 'POST', '/api/service-batches', body)
const entry = (date: string, directorId = 'person-a', over: Record<string, unknown> = {}) => ({ date, title: 'Servicio de viernes', time: '19:30', directorId, ...over })
const batch = (entries: unknown[], over: Record<string, unknown> = {}) => ({ month: '2026-11', directorIds: ['person-a', 'person-no-account'], entries, ...over })
const state = () => db.batchDirectors.findUnique({ where: { churchId: 'church-a' } })

test('only an editor or an admin reads the period and creates a batch; no session is refused', async () => {
  expect((await period('member')).status).toBe(403)
  expect((await post('member', batch([entry('2026-11-13')]))).status).toBe(403)
  expect((await period(undefined)).status).toBe(401)
  expect((await post(undefined, batch([entry('2026-11-13')]))).status).toBe(401)
  expect((await period('editor')).status).toBe(200)
  expect((await period('admin')).status).toBe(200)
  expect(await db.service.count()).toBe(0)
})

test('the period lists the weekday dates from today inclusive, locks full and closed dates and has no previous batch', async () => {
  await db.service.create({ data: { churchId: 'church-a', directorId: 'person-a', date: new Date('2026-11-20T00:00:00Z'), title: 'Oración', status: 'PUBLISHED' } })
  await db.closedDate.create({ data: { churchId: 'church-a', date: new Date('2026-11-27T00:00:00Z'), reason: 'Retiro' } })
  const body = await (await period('editor', 'month=2026-11&weekdays=4,5')).json()
  expect(body.previous).toBeNull()
  expect(body.entries.map((e: { date: string }) => e.date)).toEqual(['2026-11-12', '2026-11-13', '2026-11-19', '2026-11-20', '2026-11-26', '2026-11-27'])
  expect(body.entries.filter((e: { lock: unknown }) => e.lock)).toEqual([
    { date: '2026-11-20', slot: 'SINGLE', lock: { kind: 'service', title: 'Oración', director: 'Director person-a' } },
    { date: '2026-11-27', slot: 'SINGLE', lock: { kind: 'closed', reason: 'Retiro' } },
  ])
  clock = new Date('2026-11-13T06:00:00Z') // Friday 13th, 00:00 in Mexico City: Thursday 12th is already past
  expect((await (await period('editor', 'month=2026-11&weekdays=4')).json()).entries.map((e: { date: string }) => e.date)).toEqual(['2026-11-19', '2026-11-26'])
})

test('the period rejects a past month, bad weekdays and bad months', async () => {
  const past = await period('editor', 'month=2026-10&weekdays=5')
  expect(past.status).toBe(400)
  expect(await past.json()).toEqual({ error: 'Month in the past' })
  for (const query of ['month=2026-11&weekdays=', 'month=2026-11&weekdays=0,1,2,3', 'month=2026-11&weekdays=8', 'month=2026-13&weekdays=5', 'weekdays=5']) {
    expect((await period('editor', query)).status).toBe(400)
  }
})

test('a double Sunday yields morning and afternoon entries; if only one exists the other stays free', async () => {
  await db.service.create({ data: { churchId: 'church-b', directorId: 'person-b', date: new Date('2026-11-15T00:00:00Z'), slot: 'MORNING', time: '09:00', title: 'Culto de la mañana' } })
  try {
    const sundays = (await (await period('b-editor', 'month=2026-11&weekdays=0')).json()).entries
    expect(sundays.map((e: { date: string; slot: string; lock: { kind: string } | null }) => [e.date, e.slot, e.lock?.kind ?? null])).toEqual([
      ['2026-11-15', 'MORNING', 'service'], ['2026-11-15', 'AFTERNOON', null],
      ['2026-11-22', 'MORNING', null], ['2026-11-22', 'AFTERNOON', null],
      ['2026-11-29', 'MORNING', null], ['2026-11-29', 'AFTERNOON', null],
    ])
    // Church A (no double Sunday) sees one entry per Sunday.
    expect((await (await period('editor', 'month=2026-11&weekdays=0')).json()).entries.map((e: { slot: string }) => e.slot)).toEqual(['SINGLE', 'SINGLE', 'SINGLE'])
  } finally {
    await db.service.deleteMany({ where: { churchId: 'church-b' } })
  }
})

test('creates every entry as a draft with its director, atomically, in the active church, and stores the continuity', async () => {
  const response = await post('editor', batch([
    entry('2026-11-20', 'person-no-account'), entry('2026-11-13', 'person-a'), entry('2026-11-27', 'person-a', { title: 'Vigilia', time: '20:00' }),
  ]))
  expect(response.status).toBe(201)
  const { services } = await response.json()
  expect(services.map((s: { date: string; status: string; director: { id: string } }) => [s.date, s.status, s.director.id])).toEqual([
    ['2026-11-13', 'DRAFT', 'person-a'], ['2026-11-20', 'DRAFT', 'person-no-account'], ['2026-11-27', 'DRAFT', 'person-a'],
  ])
  expect(services[2]).toMatchObject({ title: 'Vigilia', time: '20:00', slot: 'SINGLE' })
  expect((await db.service.findMany()).every(row => row.churchId === 'church-a')).toBe(true)
  // The last director is the one of the last date of the sequence; the list is stored as sent.
  expect(await state()).toMatchObject({ directorIds: ['person-a', 'person-no-account'], lastDirectorId: 'person-a' })
  const next = await (await period('editor', 'month=2026-12&weekdays=5')).json()
  expect(next.previous).toEqual({ directorIds: ['person-a', 'person-no-account'], lastDirectorId: 'person-a' })
})

test('the church is never taken from the client and a person of another church cannot direct', async () => {
  expect((await post('editor', { ...batch([entry('2026-11-13')]), churchId: 'church-b' })).status).toBe(400)
  expect((await post('editor', batch([entry('2026-11-13', 'person-b')]))).status).toBe(400)
  expect((await post('editor', batch([entry('2026-11-13')], { directorIds: ['person-a', 'person-b'] }))).status).toBe(400)
  expect(await db.service.count()).toBe(0)
  expect(await state()).toBeNull()
})

test('a removed person of the directory cannot direct, and drops out of the continuity read', async () => {
  await post('editor', batch([entry('2026-11-13', 'person-a')]))
  await db.churchPerson.update({ where: { churchId_personId: { churchId: 'church-a', personId: 'person-no-account' } }, data: { removedAt: new Date() } })
  expect((await post('editor', batch([entry('2026-11-20')]))).status).toBe(400)
  expect((await (await period('editor', 'month=2026-12&weekdays=5')).json()).previous).toEqual({ directorIds: ['person-a'], lastDirectorId: 'person-a' })
})

test('past dates and past months are refused; today is valid all day', async () => {
  const past = await post('editor', batch([entry('2026-11-11')]))
  expect(past.status).toBe(400)
  expect(await past.json()).toEqual({ error: 'Date in the past' })
  expect((await post('editor', batch([entry('2026-10-30')], { month: '2026-10' }))).status).toBe(400)
  clock = new Date('2026-11-13T05:59:59Z')
  expect((await post('editor', batch([entry('2026-11-12')]))).status).toBe(201)
})

test('a full or closed date rejects the whole batch: nothing is created and the continuity is not touched', async () => {
  await db.service.create({ data: { churchId: 'church-a', directorId: 'person-a', date: new Date('2026-11-20T00:00:00Z'), title: 'Oración' } })
  const full = await post('editor', batch([entry('2026-11-13'), entry('2026-11-20')]))
  expect(full.status).toBe(409)
  expect(await full.json()).toEqual({ error: 'Date full', date: '2026-11-20' })
  await db.closedDate.create({ data: { churchId: 'church-a', date: new Date('2026-11-27T00:00:00Z') } })
  const closed = await post('editor', batch([entry('2026-11-13'), entry('2026-11-27')]))
  expect(closed.status).toBe(409)
  expect(await closed.json()).toEqual({ error: 'Date closed', date: '2026-11-27' })
  expect(await db.service.count()).toBe(1)
  expect(await state()).toBeNull()
})

test('a double Sunday takes two entries, one when the other exists, and refuses a third', async () => {
  const sunday = (slot: string, time: string, over: Record<string, unknown> = {}) => ({ date: '2026-11-15', slot, time, title: 'Culto', directorId: 'person-b', ...over })
  const both = await post('b-editor', { month: '2026-11', directorIds: ['person-b'], entries: [sunday('MORNING', '09:00'), sunday('AFTERNOON', '17:00', { directorId: 'person-no-account' })] })
  expect(both.status).toBe(201)
  expect((await both.json()).services.map((s: { slot: string; director: { id: string } }) => [s.slot, s.director.id])).toEqual([['MORNING', 'person-b'], ['AFTERNOON', 'person-no-account']])
  expect((await post('b-editor', { month: '2026-11', directorIds: ['person-b'], entries: [sunday('MORNING', '09:00')] })).status).toBe(409)
  // Only the afternoon is free on 22nd after one morning service exists.
  await db.service.create({ data: { churchId: 'church-b', directorId: 'person-b', date: new Date('2026-11-22T00:00:00Z'), slot: 'MORNING', title: 'Existente', time: '09:00' } })
  expect((await post('b-editor', { month: '2026-11', directorIds: ['person-b'], entries: [sunday('MORNING', '09:00', { date: '2026-11-22' })] })).status).toBe(409)
  expect((await post('b-editor', { month: '2026-11', directorIds: ['person-b'], entries: [sunday('AFTERNOON', '17:00', { date: '2026-11-22' })] })).status).toBe(201)
  // The slot must agree with the hour, and church A (no double) cannot send slots.
  expect((await post('b-editor', { month: '2026-11', directorIds: ['person-b'], entries: [sunday('MORNING', '17:00', { date: '2026-11-29' })] })).status).toBe(400)
  expect((await post('editor', batch([sunday('MORNING', '09:00', { directorId: 'person-a' })]))).status).toBe(400)
  await db.service.deleteMany({ where: { churchId: 'church-b' } })
})

test('the continuity is replaced by each batch and belongs to its church', async () => {
  await post('editor', batch([entry('2026-11-13', 'person-a')]))
  await post('editor', batch([entry('2026-11-20', 'person-no-account')], { directorIds: ['person-no-account'] }))
  expect(await state()).toMatchObject({ directorIds: ['person-no-account'], lastDirectorId: 'person-no-account' })
  expect((await (await period('b-editor', 'month=2026-12&weekdays=5')).json()).previous).toBeNull()
})

test('concurrent batches on the same dates cannot exceed capacity: one wins, the other is refused whole', async () => {
  const results = await Promise.all([1, 2, 3].map(n => post('editor', batch([entry('2026-11-13'), entry('2026-11-20')], { entries: [entry('2026-11-13', 'person-a', { title: `Lote ${n}` }), entry('2026-11-20', 'person-a', { title: `Lote ${n}` })] }))))
  expect(results.map(r => r.status).sort()).toEqual([201, 409, 409])
  expect(await db.service.count()).toBe(2)
})
