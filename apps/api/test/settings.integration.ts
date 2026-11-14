import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { createApp } from '../src/app.js'
import { connectDatabase } from '../src/database.ts'
import { seedFixtures } from './fixtures.ts'
import { sessionFixture } from './session-fixture.mjs'

const url = process.env.TEST_DATABASE_URL
if (!url || !/^postgresql:\/\/planlyrics_fixture@127\.0\.0\.1:\d+\/plan_lyrics_access_fixture$/.test(url)) throw new Error('Use pnpm test:db')
const db = connectDatabase(url)
const fixture = sessionFixture()
const api = createApp(fixture.config, db, () => new Date('2026-11-12T18:00:00Z'))
const original = [
  { weekday: 5, slot: 'SINGLE', time: '19:30', title: 'Servicio de viernes' },
  { weekday: 0, slot: 'SINGLE', time: '10:00', title: 'Servicio dominical' },
]
const reset = async () => {
  await db.service.deleteMany()
  await db.church.update({ where: { id: 'church-a' }, data: { name: 'Fixture Church A', sundayDouble: false, usesPreaching: false, congregationShowsPreacher: false } })
  await db.serviceDay.deleteMany({ where: { churchId: 'church-a' } })
  await db.serviceDay.createMany({ data: original.map(day => ({ ...day, churchId: 'church-a' })) })
}
beforeAll(() => seedFixtures(db))
beforeEach(reset)
afterAll(async () => { await reset(); await db.$disconnect() })

function call(subject: string | undefined, method: string, path: string, body?: unknown) {
  return api.request(path, {
    method,
    headers: { ...(subject ? { Authorization: `Bearer ${fixture.token(`fixture-${subject}`)}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}
const save = (subject: string | undefined, body: unknown) => call(subject, 'PUT', '/api/active-church', body)
const valid = { name: 'Betel', sundayDouble: false, usesPreaching: true, days: [
  { weekday: 2, slot: 'SINGLE', time: '19:00', title: 'Estudio bíblico' },
  { weekday: 0, slot: 'SINGLE', time: '10:30', title: 'Culto dominical' },
] }

test('the church administrator saves; the response and any member read the new settings', async () => {
  const response = await save('admin', valid)
  expect(response.status).toBe(200)
  const saved = await response.json()
  expect(saved).toMatchObject({ id: 'church-a', name: 'Betel', sundayDouble: false, usesPreaching: true, canConfigure: true })
  expect(saved.days).toEqual([
    { weekday: 0, slot: 'SINGLE', time: '10:30', title: 'Culto dominical' },
    { weekday: 2, slot: 'SINGLE', time: '19:00', title: 'Estudio bíblico' },
  ])
  const read = await (await call('member', 'GET', '/api/active-church')).json()
  expect(read).toMatchObject({ name: 'Betel', usesPreaching: true, canEdit: false, canConfigure: false, days: saved.days })
})

test('the double Sunday saves both slots and turning it off replaces them', async () => {
  const double = { ...valid, sundayDouble: true, days: [
    { weekday: 0, slot: 'MORNING', time: '09:00', title: 'Mañana' },
    { weekday: 0, slot: 'AFTERNOON', time: '17:15', title: 'Tarde' },
  ] }
  expect((await save('admin', double)).status).toBe(200)
  expect(await db.serviceDay.count({ where: { churchId: 'church-a', slot: { in: ['MORNING', 'AFTERNOON'] } } })).toBe(2)
  expect((await save('admin', valid)).status).toBe(200)
  expect(await db.serviceDay.count({ where: { churchId: 'church-a', slot: { in: ['MORNING', 'AFTERNOON'] } } })).toBe(0)
  expect((await call('admin', 'GET', '/api/active-church').then(r => r.json())).sundayDouble).toBe(false)
})

test('only the church administrator (or the platform owner) writes; editor, member and anonymous are refused', async () => {
  for (const subject of ['editor', 'member']) {
    expect((await save(subject, valid)).status).toBe(403)
  }
  expect((await save(undefined, valid)).status).toBe(401)
  expect((await db.church.findUniqueOrThrow({ where: { id: 'church-a' } })).name).toBe('Fixture Church A')
  expect((await call('editor', 'GET', '/api/active-church').then(r => r.json())).canConfigure).toBe(false)
})

test('the platform owner writes when the church is their active church', async () => {
  await db.membership.create({ data: { userId: 'owner', churchId: 'church-a', role: 'MEMBER' } })
  try {
    expect((await save('owner', valid)).status).toBe(200)
  } finally { await db.membership.delete({ where: { userId_churchId: { userId: 'owner', churchId: 'church-a' } } }) }
})

test('the church comes from the access, never from the body, and other churches stay untouched', async () => {
  const before = await db.serviceDay.findMany({ where: { churchId: 'church-b' }, orderBy: { slot: 'asc' } })
  expect((await save('admin', { ...valid, churchId: 'church-b' })).status).toBe(400)
  expect((await save('admin', valid)).status).toBe(200)
  expect(await db.serviceDay.findMany({ where: { churchId: 'church-b' }, orderBy: { slot: 'asc' } })).toEqual(before)
  expect((await db.church.findUniqueOrThrow({ where: { id: 'church-b' } })).name).toBe('Fixture Church B')
})

test('invalid settings are rejected with the failing fields and change nothing', async () => {
  const bad = await save('admin', { ...valid, name: ' ', days: [{ weekday: 2, slot: 'SINGLE', time: '19:10', title: '' }] })
  expect(bad.status).toBe(400)
  expect(await bad.json()).toEqual({ error: 'Invalid request', issues: ['name', 'days.2.SINGLE.title'] })
  expect((await save('admin', { ...valid, days: [] })).status).toBe(400)
  expect((await save('admin', { ...valid, days: [{ weekday: 2, slot: 'MORNING', time: '09:00', title: 'x' }, { weekday: 2, slot: 'AFTERNOON', time: '17:00', title: 'y' }] })).status).toBe(400)
  expect((await db.church.findUniqueOrThrow({ where: { id: 'church-a' } })).name).toBe('Fixture Church A')
  expect(await db.serviceDay.count({ where: { churchId: 'church-a' } })).toBe(2)
})

test('saving does not modify services already created', async () => {
  await db.service.create({ data: { churchId: 'church-a', directorId: 'person-a', title: 'Servicio de viernes', date: new Date('2026-11-20T00:00:00Z'), time: '19:30' } })
  expect((await save('admin', { ...valid, days: [{ weekday: 5, slot: 'SINGLE', time: '20:00', title: 'Otro título' }] })).status).toBe(200)
  const kept = await db.service.findFirstOrThrow()
  expect({ title: kept.title, time: kept.time, slot: kept.slot }).toEqual({ title: 'Servicio de viernes', time: '19:30', slot: 'SINGLE' })
})

test('the congregation switch is saved with the settings, kept when a save leaves it out, and only the administrator changes it', async () => {
  expect(await (await call('member', 'GET', '/api/active-church')).json()).toMatchObject({ congregationShowsPreacher: false })
  const on = await save('admin', { ...valid, congregationShowsPreacher: true })
  expect(on.status).toBe(200)
  expect(await on.json()).toMatchObject({ congregationShowsPreacher: true, name: 'Betel' })
  // A save that does not mention it (the settings screen) changes nothing about it.
  expect(await (await save('admin', { ...valid, name: 'Otro nombre' })).json()).toMatchObject({ congregationShowsPreacher: true, name: 'Otro nombre' })
  expect((await save('editor', { ...valid, congregationShowsPreacher: false })).status).toBe(403)
  expect((await save('admin', { ...valid, congregationShowsPreacher: 'si' })).status).toBe(400)
  expect(await (await call('member', 'GET', '/api/active-church')).json()).toMatchObject({ congregationShowsPreacher: true })
  expect(await (await save('admin', { ...valid, congregationShowsPreacher: false })).json()).toMatchObject({ congregationShowsPreacher: false })
})
