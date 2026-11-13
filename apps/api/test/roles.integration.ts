import { readFileSync } from 'node:fs'
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
const churches = ['church-a', 'church-b']
// Back to a church that was never seeded: the API creates its defaults the first time it is read.
const reset = async () => {
  await db.roleRestriction.deleteMany({ where: { churchId: { in: churches } } })
  await db.musicalRole.deleteMany({ where: { churchId: { in: churches } } })
  await db.church.updateMany({ where: { id: { in: churches } }, data: { rolesSeeded: false } })
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
type Role = { id: string; name: string }
type Restriction = { id: string; first: string; second: string }
const roles = async (subject = 'member') => (await call(subject, 'GET', '/api/roles')).json() as Promise<Role[]>
const restrictions = async (subject = 'member') => (await call(subject, 'GET', '/api/role-restrictions')).json() as Promise<Restriction[]>
const names = async (subject = 'member') => (await roles(subject)).map(role => role.name)
const idOf = async (name: string, subject = 'member') => (await roles(subject)).find(role => role.name === name)!.id

test('a church starts with batería, guitarra, piano and voces in alphabetical order and only Dirigir + Batería restricted', async () => {
  expect(await names()).toEqual(['Batería', 'Guitarra', 'Piano', 'Voces'])
  const drums = await idOf('Batería')
  expect(await restrictions()).toEqual([{ id: expect.any(String), first: 'DIRIGIR', second: drums }])
})

test('seeding is idempotent, even when several first reads race', async () => {
  await Promise.all([roles(), roles('admin'), restrictions(), roles('editor')])
  await roles()
  expect(await db.musicalRole.count({ where: { churchId: 'church-a' } })).toBe(4)
  expect(await db.roleRestriction.count({ where: { churchId: 'church-a' } })).toBe(1)
})

test('the migration seed gives an existing church the same defaults and the API leaves them alone', async () => {
  const sql = readFileSync(new URL('../prisma/migrations/20261114120000_musical_roles/migration.sql', import.meta.url), 'utf8')
  const seed = sql.slice(sql.indexOf('INSERT INTO "MusicalRole"')).split(';').map(statement => statement.trim()).filter(Boolean)
  for (const statement of seed) await db.$executeRawUnsafe(statement)
  expect(await names()).toEqual(['Batería', 'Guitarra', 'Piano', 'Voces'])
  const [only] = await restrictions()
  expect(only).toMatchObject({ first: 'DIRIGIR', second: await idOf('Batería') })
  expect(await restrictions()).toHaveLength(1)
  expect(await db.musicalRole.count({ where: { churchId: 'church-a' } })).toBe(4)
  // The migration also seeds church B, which the API then reads as already seeded.
  expect(await names('b-editor')).toEqual(['Batería', 'Guitarra', 'Piano', 'Voces'])
})

test('the administrator creates a role; everyone reads it in alphabetical order', async () => {
  const created = await call('admin', 'POST', '/api/roles', { name: '  Bajo  ' })
  expect(created.status).toBe(201)
  expect(await created.json()).toEqual({ id: expect.any(String), name: 'Bajo' })
  expect(await names('member')).toEqual(['Bajo', 'Batería', 'Guitarra', 'Piano', 'Voces'])
  expect(created.headers.get('cache-control')).toBe('no-store')
})

test('a role name needs text and is never repeated ignoring case and accents; Dirigir is reserved', async () => {
  expect((await call('admin', 'POST', '/api/roles', { name: '   ' })).status).toBe(400)
  expect((await call('admin', 'POST', '/api/roles', {})).status).toBe(400)
  expect((await call('admin', 'POST', '/api/roles', { name: 'x'.repeat(41) })).status).toBe(400)
  for (const name of ['bateria', 'BATERÍA', ' batería ', 'dirigir', 'Dirigir']) {
    const response = await call('admin', 'POST', '/api/roles', { name })
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'Name exists' })
  }
  expect(await call('admin', 'POST', '/api/roles', { name: 'Bajo' }).then(r => r.status)).toBe(201)
  expect((await call('admin', 'POST', '/api/roles', { name: 'BAJO' })).status).toBe(409)
  expect(await names()).toEqual(['Bajo', 'Batería', 'Guitarra', 'Piano', 'Voces'])
})

test('two simultaneous creations of the same name leave exactly one role', async () => {
  const statuses = (await Promise.all([1, 2, 3].map(() => call('admin', 'POST', '/api/roles', { name: 'Trompeta' })))).map(response => response.status).sort()
  expect(statuses).toEqual([201, 409, 409])
  expect((await names()).filter(name => name === 'Trompeta')).toHaveLength(1)
})

test('only the church administrator changes roles and restrictions; editor, member and anonymous cannot', async () => {
  const drums = await idOf('Batería')
  const [restriction] = await restrictions()
  for (const subject of ['editor', 'member']) {
    expect((await call(subject, 'POST', '/api/roles', { name: 'Bajo' })).status).toBe(403)
    expect((await call(subject, 'DELETE', `/api/roles/${drums}`)).status).toBe(403)
    expect((await call(subject, 'POST', '/api/role-restrictions', { first: 'DIRIGIR', second: await idOf('Piano') })).status).toBe(403)
    expect((await call(subject, 'DELETE', `/api/role-restrictions/${restriction.id}`)).status).toBe(403)
    expect((await call(subject, 'GET', '/api/roles')).status).toBe(200)
    expect((await call(subject, 'GET', '/api/role-restrictions')).status).toBe(200)
  }
  for (const [method, path] of [['GET', '/api/roles'], ['POST', '/api/roles'], ['GET', '/api/role-restrictions'], ['DELETE', `/api/roles/${drums}`]]) {
    expect((await call(undefined, method, path, method === 'POST' ? { name: 'Bajo' } : undefined)).status).toBe(401)
  }
  expect(await names()).toEqual(['Batería', 'Guitarra', 'Piano', 'Voces'])
  expect(await restrictions()).toHaveLength(1)
})

test('a person with no church or several churches has no active church for roles', async () => {
  expect((await call('multi', 'GET', '/api/roles')).status).toBe(409)
  expect((await call('library', 'GET', '/api/roles')).status).toBe(404)
})

test('deleting a role removes it and the restrictions that mention it; the other roles stay', async () => {
  const [drums, guitar] = [await idOf('Batería'), await idOf('Guitarra')]
  await call('admin', 'POST', '/api/role-restrictions', { first: guitar, second: drums })
  expect(await restrictions()).toHaveLength(2)
  expect((await call('admin', 'DELETE', `/api/roles/${drums}`)).status).toBe(204)
  expect(await names()).toEqual(['Guitarra', 'Piano', 'Voces'])
  expect(await restrictions()).toEqual([])
  expect((await call('admin', 'DELETE', `/api/roles/${drums}`)).status).toBe(404)
  // The name is free again.
  expect((await call('admin', 'POST', '/api/roles', { name: 'Batería' })).status).toBe(201)
})

test('a church that deletes every role does not get the defaults back', async () => {
  for (const role of await roles('admin')) expect((await call('admin', 'DELETE', `/api/roles/${role.id}`)).status).toBe(204)
  expect(await roles()).toEqual([])
  expect(await restrictions()).toEqual([])
})

test('restrictions add without order, never twice, never to themselves and only between known roles', async () => {
  const [guitar, piano] = [await idOf('Guitarra'), await idOf('Piano')]
  const added = await call('admin', 'POST', '/api/role-restrictions', { first: piano, second: guitar })
  expect(added.status).toBe(201)
  const row = (await added.json()) as Restriction
  expect([row.first, row.second].sort()).toEqual([guitar, piano].sort())
  expect(row.first < row.second).toBe(true)
  for (const body of [{ first: guitar, second: piano }, { first: piano, second: guitar }]) {
    const repeated = await call('admin', 'POST', '/api/role-restrictions', body)
    expect(repeated.status).toBe(409)
    expect(await repeated.json()).toEqual({ error: 'Restriction exists' })
  }
  expect((await call('admin', 'POST', '/api/role-restrictions', { first: guitar, second: guitar })).status).toBe(400)
  expect((await call('admin', 'POST', '/api/role-restrictions', { first: 'DIRIGIR', second: 'DIRIGIR' })).status).toBe(400)
  expect((await call('admin', 'POST', '/api/role-restrictions', { first: guitar, second: 'no-existe' })).status).toBe(400)
  expect((await call('admin', 'POST', '/api/role-restrictions', { first: guitar })).status).toBe(400)
  expect((await call('admin', 'POST', '/api/role-restrictions', { first: guitar, second: piano, churchId: 'church-b' })).status).toBe(400)
  expect(await restrictions()).toHaveLength(2)
})

test('Dirigir joins any role of the catalog, and the default restriction can be removed', async () => {
  const [restriction] = await restrictions()
  const piano = await idOf('Piano')
  expect((await call('admin', 'POST', '/api/role-restrictions', { first: piano, second: 'DIRIGIR' })).status).toBe(201)
  expect((await call('admin', 'DELETE', `/api/role-restrictions/${restriction.id}`)).status).toBe(204)
  expect((await call('admin', 'DELETE', `/api/role-restrictions/${restriction.id}`)).status).toBe(404)
  expect((await restrictions()).map(row => [row.first, row.second].sort())).toEqual([['DIRIGIR', piano].sort()])
  // Removing the default restriction does not bring it back on the next read.
  expect(await restrictions()).toHaveLength(1)
})

test('the church always comes from the access: roles and restrictions of another church are out of reach', async () => {
  const otherRoles = await roles('b-editor')
  const otherRestriction = (await restrictions('b-editor'))[0]
  expect(otherRoles).toHaveLength(4)
  const guitar = await idOf('Guitarra')
  // A role of church B cannot be deleted, restricted or reached from church A.
  expect((await call('admin', 'DELETE', `/api/roles/${otherRoles[0].id}`)).status).toBe(404)
  expect((await call('admin', 'POST', '/api/role-restrictions', { first: guitar, second: otherRoles[0].id })).status).toBe(400)
  expect((await call('admin', 'DELETE', `/api/role-restrictions/${otherRestriction.id}`)).status).toBe(404)
  expect((await call('admin', 'POST', '/api/roles', { name: 'Bajo', churchId: 'church-b' })).status).toBe(400)
  expect(await roles('b-editor')).toEqual(otherRoles)
  expect(await restrictions('b-editor')).toEqual([otherRestriction])
  // The same name is free in each church.
  expect((await call('admin', 'POST', '/api/roles', { name: 'Bajo' })).status).toBe(201)
  expect(await names('b-editor')).toEqual(['Batería', 'Guitarra', 'Piano', 'Voces'])
})
