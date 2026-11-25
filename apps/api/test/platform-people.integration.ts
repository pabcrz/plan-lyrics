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
const reset = async () => {
  await db.person.deleteMany({ where: { name: { startsWith: 'Prueba ' } } })
  await db.musicalRole.deleteMany({ where: { id: { startsWith: 'prueba-' } } })
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
const create = async (name: string) => (await (await call('owner', 'POST', '/api/platform/people', { name })).json()) as { id: string }
const flags = { canPlay: false, canDirect: false, canPreach: false, roleIds: [] as string[] }

test('only the platform owner reaches these routes; everyone else gets the generic 404', async () => {
  for (const subject of ['admin', 'editor', 'accounts', 'member']) {
    expect((await call(subject, 'GET', '/api/platform/people')).status).toBe(404)
    expect((await call(subject, 'POST', '/api/platform/people', { name: 'Prueba Nadie' })).status).toBe(404)
  }
  expect((await call(undefined, 'GET', '/api/platform/people')).status).toBe(401)
})

test('creates a person with no church, lists it, and refuses a repeated name across the platform', async () => {
  const created = await call('owner', 'POST', '/api/platform/people', { name: '  Prueba   Carlos ', phone: '+525550101234', email: 'Carlos@Example.com' })
  expect(created.status).toBe(201)
  const person = await created.json() as { id: string; name: string }
  expect(person).toMatchObject({ name: 'Prueba Carlos', phone: '+525550101234', email: 'carlos@example.com', hasAccount: false, churches: [] })
  const listed = await (await call('owner', 'GET', '/api/platform/people')).json() as Array<{ id: string; churches: unknown[] }>
  expect(listed.find(item => item.id === person.id)?.churches).toEqual([])
  expect(listed.find(item => item.id === 'person-a')?.churches).toHaveLength(1)
  const again = await call('owner', 'POST', '/api/platform/people', { name: 'prueba carlos' })
  expect(again.status).toBe(409)
  expect(await again.json()).toMatchObject({ error: 'Name exists', existing: { id: person.id } })
})

test('edits the general data of any person, refusing only a name another person has', async () => {
  const carlos = await create('Prueba Carlos')
  const luis = await create('Prueba Luis')
  const edited = await call('owner', 'PATCH', `/api/platform/people/${carlos.id}`, { phone: '+525550101234', email: null })
  expect(edited.status).toBe(200)
  expect(await edited.json()).toMatchObject({ name: 'Prueba Carlos', phone: '+525550101234', email: null })
  expect((await call('owner', 'PATCH', `/api/platform/people/${carlos.id}`, { name: 'Prueba Luis' })).status).toBe(409)
  expect((await call('owner', 'PATCH', `/api/platform/people/${luis.id}`, { name: 'Prueba Luis' })).status).toBe(200)
  expect((await call('owner', 'PATCH', `/api/platform/people/${luis.id}`, {})).status).toBe(400)
  expect((await call('owner', 'PATCH', '/api/platform/people/no-existe', { name: 'Prueba X' })).status).toBe(404)
})

test('assigns a person to several churches with their own groups and roles, then reactivates a removed link', async () => {
  const carlos = await create('Prueba Carlos')
  await db.musicalRole.create({ data: { id: 'prueba-batería', churchId: 'church-a', name: 'Prueba Batería', nameKey: 'prueba bateria' } })
  const toA = await call('owner', 'PUT', `/api/platform/people/${carlos.id}/churches/church-a`, { ...flags, canPlay: true, canDirect: true, roleIds: ['prueba-batería'] })
  expect(toA.status).toBe(200)
  expect(await toA.json()).toEqual({ id: 'church-a', canPlay: true, canDirect: true, canPreach: false, roleIds: ['prueba-batería'] })
  expect((await call('owner', 'PUT', `/api/platform/people/${carlos.id}/churches/church-b`, flags)).status).toBe(200)
  const listed = await (await call('owner', 'GET', '/api/platform/people')).json() as Array<{ id: string; churches: Array<{ id: string }> }>
  expect(listed.find(item => item.id === carlos.id)?.churches.map(item => item.id).sort()).toEqual(['church-a', 'church-b'])
  expect((await call('owner', 'DELETE', `/api/platform/people/${carlos.id}/churches/church-b`)).status).toBe(204)
  expect((await call('owner', 'DELETE', `/api/platform/people/${carlos.id}/churches/church-b`)).status).toBe(404)
  const back = await call('owner', 'PUT', `/api/platform/people/${carlos.id}/churches/church-b`, { ...flags, canPreach: true })
  expect(await back.json()).toEqual({ id: 'church-b', canPlay: false, canDirect: false, canPreach: true, roleIds: [] })
  expect(await db.churchPerson.count({ where: { personId: carlos.id } })).toBe(2)
})

test('refuses roles without the worship group, roles of another church, and unknown people or churches', async () => {
  const carlos = await create('Prueba Carlos')
  await db.musicalRole.create({ data: { id: 'prueba-batería', churchId: 'church-a', name: 'Prueba Batería', nameKey: 'prueba bateria' } })
  expect((await call('owner', 'PUT', `/api/platform/people/${carlos.id}/churches/church-a`, { ...flags, roleIds: ['prueba-batería'] })).status).toBe(400)
  expect((await call('owner', 'PUT', `/api/platform/people/${carlos.id}/churches/church-b`, { ...flags, canPlay: true, roleIds: ['prueba-batería'] })).status).toBe(400)
  expect((await call('owner', 'PUT', `/api/platform/people/${carlos.id}/churches/no-existe`, flags)).status).toBe(404)
  expect((await call('owner', 'PUT', '/api/platform/people/no-existe/churches/church-a', flags)).status).toBe(404)
  expect(await db.churchPerson.count({ where: { personId: carlos.id } })).toBe(0)
})

test('leaving the worship group is refused while the person is still habitual in one of their roles', async () => {
  const carlos = await create('Prueba Carlos')
  await db.musicalRole.create({ data: { id: 'prueba-batería', churchId: 'church-a', name: 'Prueba Batería', nameKey: 'prueba bateria' } })
  await call('owner', 'PUT', `/api/platform/people/${carlos.id}/churches/church-a`, { ...flags, canPlay: true, roleIds: ['prueba-batería'] })
  await db.rolePlan.create({ data: { churchId: 'church-a', roleId: 'prueba-batería', habitualIds: [carlos.id] } })
  const refused = await call('owner', 'PUT', `/api/platform/people/${carlos.id}/churches/church-a`, flags)
  expect(refused.status).toBe(409)
  expect(await refused.json()).toMatchObject({ error: 'In use' })
  expect((await db.churchPerson.findUnique({ where: { churchId_personId: { churchId: 'church-a', personId: carlos.id } } }))?.canPlay).toBe(true)
})

test('lists every church with its musical roles', async () => {
  await db.musicalRole.create({ data: { id: 'prueba-batería', churchId: 'church-a', name: 'Prueba Batería', nameKey: 'prueba bateria' } })
  const churches = await (await call('owner', 'GET', '/api/platform/churches')).json() as Array<{ id: string; name: string; usesPreaching: boolean; roles: Array<{ id: string }> }>
  expect(churches.map(church => church.id)).toEqual(expect.arrayContaining(['church-a', 'church-b']))
  expect(churches.find(church => church.id === 'church-a')?.roles.map(role => role.id)).toContain('prueba-batería')
})
