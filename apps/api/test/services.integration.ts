import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { createApp } from '../src/app.js'
import { connectDatabase } from '../src/database.ts'
import { seedFixtures } from './fixtures.ts'
import { sessionFixture } from './session-fixture.mjs'

const url = process.env.TEST_DATABASE_URL
if (!url || !/^postgresql:\/\/planlyrics_fixture@127\.0\.0\.1:\d+\/plan_lyrics_access_fixture$/.test(url)) throw new Error('Use pnpm test:db')
const db = connectDatabase(url)
const fixture = sessionFixture()
// Fixed clock: Thursday 12 Nov 2026, 12:00 in Mexico City. Dates below are valid unless a test says otherwise.
let clock = new Date('2026-11-12T18:00:00Z')
const api = createApp(fixture.config, db, () => clock)
beforeAll(() => seedFixtures(db))
beforeEach(() => { clock = new Date('2026-11-12T18:00:00Z'); return db.service.deleteMany() })
afterAll(() => db.$disconnect())

function call(subject: string | undefined, path: string, body?: unknown) {
  return api.request(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(subject ? { Authorization: `Bearer ${fixture.token(`fixture-${subject}`)}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}
const friday = { title: 'Servicio de viernes', date: '2026-11-13', status: 'DRAFT', directorId: 'person-a' }
const create = (subject: string, body: unknown) => call(subject, '/api/services', body)

test('an editor and an admin create a service in their active church; a member only reads', async () => {
  const created = await create('editor', friday)
  expect(created.status).toBe(201)
  expect(await created.json()).toMatchObject({ title: 'Servicio de viernes', date: '2026-11-13', slot: 'SINGLE', time: null, status: 'DRAFT', director: { id: 'person-a', name: 'Director person-a' } })
  expect((await create('admin', { ...friday, date: '2026-11-20', time: '19:30', status: 'PUBLISHED' })).status).toBe(201)
  const denied = await create('member', { ...friday, date: '2026-11-27' })
  expect(denied.status).toBe(403)
  expect(await db.service.count()).toBe(2)
  const listed = await (await call('member', '/api/services?month=2026-11')).json()
  expect(listed.map((s: { date: string }) => s.date)).toEqual(['2026-11-13', '2026-11-20'])
})

test('a service lists how many songs its setlist has; moments are not counted', async () => {
  const created = await (await create('editor', friday)).json()
  expect(created.songCount).toBe(0)
  const song = await db.song.create({ data: { title: 'Canción de ejemplo', author: 'Autora Uno', titleKey: 'cancion de ejemplo', authorKey: 'autora uno' } })
  await db.setlistEntry.createMany({ data: [{ serviceId: created.id, position: 0, songId: song.id }, { serviceId: created.id, position: 1, moment: 'Ofrenda' }] })
  try {
    const listed = await (await call('member', '/api/services?month=2026-11')).json()
    expect(listed.find((item: { id: string }) => item.id === created.id).songCount).toBe(1)
  } finally {
    await db.setlistEntry.deleteMany({ where: { serviceId: created.id } })
    await db.song.delete({ where: { id: song.id } })
  }
})

test('the church comes from the session, never from the client', async () => {
  expect((await create('editor', { ...friday, churchId: 'church-b' })).status).toBe(400)
  const created = await (await create('editor', friday)).json()
  expect((await db.service.findUniqueOrThrow({ where: { id: created.id } })).churchId).toBe('church-a')
  // Church B cannot see it, and a person of church B cannot direct a church A service.
  expect(await (await call('b-editor', '/api/services?month=2026-11')).json()).toEqual([])
  expect((await create('editor', { ...friday, date: '2026-11-20', directorId: 'person-b' })).status).toBe(400)
})

test('requires a director', async () => {
  expect((await create('editor', { ...friday, directorId: undefined })).status).toBe(400)
  expect(await db.service.count()).toBe(0)
})

test('an ordinary date admits one service; a full date is rejected', async () => {
  expect((await create('editor', friday)).status).toBe(201)
  const second = await create('editor', { ...friday, title: 'Otro' })
  expect(second.status).toBe(409)
  expect(await second.json()).toEqual({ error: 'Date full' })
  expect(await db.service.count()).toBe(1)
})

test('a Sunday admits a single service when the church does not enable the double', async () => {
  const sunday = { ...friday, date: '2026-11-15' }
  expect((await create('editor', sunday)).status).toBe(201)
  expect((await create('editor', { ...sunday, title: 'Tarde', time: '17:00' })).status).toBe(409)
  expect((await create('editor', { ...sunday, date: '2026-11-22', slot: 'MORNING' })).status).toBe(400)
})

test('an enabled double Sunday admits morning and afternoon, then is full', async () => {
  const sunday = { title: 'Culto', date: '2026-11-15', status: 'PUBLISHED', directorId: 'person-b' }
  expect((await create('b-editor', sunday)).status).toBe(400) // slot required
  expect((await create('b-editor', { ...sunday, slot: 'MORNING', time: '13:00' })).status).toBe(400)
  expect((await create('b-editor', { ...sunday, slot: 'MORNING', time: '09:00' })).status).toBe(201)
  expect((await create('b-editor', { ...sunday, slot: 'MORNING' })).status).toBe(409)
  expect((await create('b-editor', { ...sunday, slot: 'AFTERNOON', time: '17:00' })).status).toBe(201)
  expect((await create('b-editor', { ...sunday, slot: 'AFTERNOON' })).status).toBe(409)
  expect((await create('b-editor', { ...sunday, date: '2026-11-13', slot: 'AFTERNOON' })).status).toBe(400)
  expect(await db.service.count()).toBe(2)
})

test('concurrent creations on the same date cannot exceed the capacity', async () => {
  const results = await Promise.all([1, 2, 3, 4].map(n => create('editor', { ...friday, title: `Servicio ${n}` })))
  expect(results.map(r => r.status).sort()).toEqual([201, 409, 409, 409])
  expect(await db.service.count()).toBe(1)
})

test('the active church comes from the only membership; none or several are refused', async () => {
  for (const subject of ['library', 'accounts', 'unknown', 'owner']) {
    expect((await call(subject, '/api/services?month=2026-11')).status).toBe(404)
    expect((await create(subject, friday)).status).toBe(404)
  }
  const ambiguous = await call('multi', '/api/services?month=2026-11')
  expect(ambiguous.status).toBe(409)
  expect(await ambiguous.json()).toEqual({ error: 'Active church required' })
  expect((await create('multi', friday)).status).toBe(409)
  expect(await db.service.count()).toBe(0)
})

test('rejects missing credentials before touching the database', async () => {
  for (const response of [await call(undefined, '/api/services?month=2026-11'), await call(undefined, '/api/services', friday), await call(undefined, '/api/active-church'), await call(undefined, '/api/people')]) {
    expect(response.status).toBe(401)
  }
})

test('lists a month only, with the director, in date order', async () => {
  await create('editor', { ...friday, date: '2026-12-04' })
  await create('editor', { ...friday, date: '2026-11-27' })
  await create('editor', { ...friday, date: '2026-11-12' })
  expect((await (await call('member', '/api/services?month=2026-11')).json()).map((s: { date: string }) => s.date)).toEqual(['2026-11-12', '2026-11-27'])
  expect((await call('member', '/api/services?month=2026-13')).status).toBe(400)
  expect((await call('member', '/api/services')).status).toBe(400)
})

test('reads the active church context and its directory only for that church', async () => {
  const context = await (await call('editor', '/api/active-church')).json()
  expect(context).toEqual({
    id: 'church-a', name: 'Fixture Church A', sundayDouble: false, usesPreaching: false, usesRotation: false, congregationShowsPreacher: false, canEdit: true, canConfigure: false, timeZone: 'America/Mexico_City',
    days: [
      { weekday: 0, slot: 'SINGLE', time: '10:00', title: 'Servicio dominical' },
      { weekday: 5, slot: 'SINGLE', time: '19:30', title: 'Servicio de viernes' },
    ],
  })
  expect((await (await call('member', '/api/active-church')).json()).canEdit).toBe(false)
  expect((await (await call('b-editor', '/api/active-church')).json()).sundayDouble).toBe(true)
  const people = await (await call('editor', '/api/people')).json()
  expect(people.map((p: { id: string }) => p.id).sort()).toEqual(['person-a', 'person-no-account'])
})

test('today is valid all day and past dates are rejected, with the boundary at Mexico City midnight', async () => {
  // 23:59:59 on 13 Nov in Mexico City is already 14 Nov in UTC: the 13th is still today.
  clock = new Date('2026-11-14T05:59:59Z')
  expect((await create('editor', friday)).status).toBe(201)
  const yesterday = await create('editor', { ...friday, date: '2026-11-12' })
  expect(yesterday.status).toBe(400)
  expect(await yesterday.json()).toEqual({ error: 'Date in the past' })
  // One second later it is 00:00:00 on the 14th: the 13th is now in the past.
  clock = new Date('2026-11-14T06:00:00Z')
  expect((await create('editor', { ...friday, date: '2026-11-13', title: 'Otro' })).status).toBe(400)
  expect((await create('editor', { ...friday, date: '2026-11-14', title: 'Hoy' })).status).toBe(201)
  expect(await db.service.count()).toBe(2)
})

// A service may be created with its director, its preacher or both; the other side is planned later.
const withPreaching = async (on: boolean) => { await db.church.update({ where: { id: 'church-a' }, data: { usesPreaching: on } }) }
const noDirector = { ...friday, directorId: undefined }

test('a service can be created with only its preacher, with both, and never with neither', async () => {
  await withPreaching(true)
  try {
    const only = await create('editor', { ...noDirector, preacher: { personId: 'person-a', topic: '  La   gracia ' } })
    expect(only.status).toBe(201)
    const created = await only.json()
    expect(created).toMatchObject({ director: null })
    expect(await db.servicePreaching.findUniqueOrThrow({ where: { serviceId: created.id } })).toMatchObject({ preacherId: 'person-a', topic: 'La gracia' })
    expect(await db.assignment.count({ where: { serviceId: created.id } })).toBe(0)
    const both = await create('editor', { ...friday, date: '2026-11-20', preacher: { personId: 'person-no-account' } })
    expect(both.status).toBe(201)
    expect(await both.json()).toMatchObject({ director: { id: 'person-a' } })
    expect((await create('editor', { ...noDirector, date: '2026-11-27' })).status).toBe(400)
    expect(await db.service.count()).toBe(2)
  } finally { await withPreaching(false) }
})

test('a preacher is refused, and nothing is created, while the church does not use preaching or for people who cannot preach', async () => {
  expect((await create('editor', { ...friday, preacher: { personId: 'person-a' } })).status).toBe(409)
  expect(await db.service.count()).toBe(0)
  await withPreaching(true)
  try {
    expect((await create('editor', { ...noDirector, preacher: { personId: 'person-b' } })).status).toBe(400)
    await db.churchPerson.update({ where: { churchId_personId: { churchId: 'church-a', personId: 'person-a' } }, data: { canPreach: false, canDirect: false } })
    expect((await create('editor', { ...noDirector, preacher: { personId: 'person-a' } })).status).toBe(400)
    expect((await create('editor', friday)).status).toBe(400)
    expect(await db.service.count()).toBe(0)
  } finally {
    await db.churchPerson.update({ where: { churchId_personId: { churchId: 'church-a', personId: 'person-a' } }, data: { canPreach: true, canDirect: true } })
    await withPreaching(false)
  }
})

test('the director of a service created without one is set by editors, only to people who can direct, and generates its assignments', async () => {
  await withPreaching(true)
  try {
    const { id } = await (await create('editor', { ...noDirector, preacher: { personId: 'person-no-account' } })).json()
    const path = `/api/services/${id}`
    const patch = (subject: string, target: string, body: unknown) => api.request(target, {
      method: 'PATCH', headers: { Authorization: `Bearer ${fixture.token(`fixture-${subject}`)}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    expect((await patch('member', path, { directorId: 'person-a' })).status).toBe(403)
    expect((await patch('editor', path, { directorId: 'person-b' })).status).toBe(400)
    await db.churchPerson.update({ where: { churchId_personId: { churchId: 'church-a', personId: 'person-a' } }, data: { canDirect: false } })
    expect((await patch('editor', path, { directorId: 'person-a' })).status).toBe(400)
    await db.churchPerson.update({ where: { churchId_personId: { churchId: 'church-a', personId: 'person-a' } }, data: { canDirect: true } })
    const set = await patch('editor', path, { directorId: 'person-a' })
    expect(set.status).toBe(200)
    expect(await set.json()).toMatchObject({ id, director: { id: 'person-a' } })
    expect((await patch('editor', '/api/services/missing', { directorId: 'person-a' })).status).toBe(404)
  } finally { await withPreaching(false) }
})

test('a service without a director has an empty musical side that still lists and accepts assignments', async () => {
  await withPreaching(true)
  try {
    const { id } = await (await create('editor', { ...noDirector, preacher: { personId: 'person-a' } })).json()
    const listed = await (await call('editor', `/api/services/${id}/assignments`)).json()
    expect(listed).toMatchObject({ service: { id, director: null }, assignments: [] })
    expect((await call('member', '/api/services?month=2026-11').then(r => r.json()))[0]).toMatchObject({ id, director: null })
  } finally { await withPreaching(false) }
})

test('correcting a service needs a session and an editor', async () => {
  const { id } = await (await create('editor', friday)).json()
  const patch = (subject: string | undefined) => api.request(`/api/services/${id}`, {
    method: 'PATCH', headers: { ...(subject ? { Authorization: `Bearer ${fixture.token(`fixture-${subject}`)}` } : {}), 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Otro' }),
  })
  expect((await patch(undefined)).status).toBe(401)
  expect((await patch('member')).status).toBe(403)
  expect((await patch('editor')).status).toBe(200)
})
