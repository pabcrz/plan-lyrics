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
const api = createApp(fixture.config, db, () => new Date('2026-11-12T18:00:00Z'))
const fixturePeople = { 'person-a': 'Director person-a', 'person-b': 'Director person-b', 'person-no-account': 'Fixture Participant' }
const reset = async () => {
  await db.service.deleteMany()
  // Fixture people first (a test may rename them), then everything the tests created.
  for (const [id, name] of Object.entries(fixturePeople)) await db.person.update({ where: { id }, data: { name, phone: null, userId: null } })
  await db.person.deleteMany({ where: { id: { notIn: Object.keys(fixturePeople) }, name: { startsWith: 'Prueba ' } } })
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
const add = (subject: string | undefined, body: unknown) => call(subject, 'POST', '/api/people', body)

test('lists only the active church people, alphabetically, with the account state', async () => {
  await db.user.update({ where: { id: 'library' }, data: { person: { connect: { id: 'person-a' } } } })
  try {
    const listed = await (await call('member', 'GET', '/api/people')).json()
    expect(listed).toEqual([
      { id: 'person-a', name: 'Director person-a', hasAccount: true },
      { id: 'person-no-account', name: 'Fixture Participant', hasAccount: false },
    ])
    expect((await call('b-editor', 'GET', '/api/people').then(r => r.json())).map((p: { id: string }) => p.id)).toEqual(['person-b', 'person-no-account'])
  } finally { await db.person.update({ where: { id: 'person-a' }, data: { userId: null } }) }
  expect((await call(undefined, 'GET', '/api/people')).status).toBe(401)
})

test('an editor and an admin add people without an account; a member cannot', async () => {
  const first = await add('editor', { name: '  Prueba   Uno ', phone: '55 1234 5678' })
  expect(first.status).toBe(201)
  expect(await first.json()).toMatchObject({ name: 'Prueba Uno', phone: '55 1234 5678', hasAccount: false })
  expect((await add('admin', { name: 'Prueba Dos' })).status).toBe(201)
  expect((await add('member', { name: 'Prueba Tres' })).status).toBe(403)
  expect((await add(undefined, { name: 'Prueba Tres' })).status).toBe(401)
  const row = await db.person.findFirstOrThrow({ where: { name: 'Prueba Uno' }, include: { churches: true } })
  expect(row.userId).toBeNull()
  expect(row.churches.map(link => link.churchId)).toEqual(['church-a'])
})

test('the church comes from the access, never from the body', async () => {
  expect((await add('editor', { name: 'Prueba Uno', churchId: 'church-b' })).status).toBe(400)
  expect((await add('editor', { name: 'Prueba Uno', userId: 'owner' })).status).toBe(400)
  expect((await add('editor', { name: ' ' })).status).toBe(400)
  expect((await add('editor', { name: 'Prueba Uno', phone: 'llámame' })).status).toBe(400)
  expect(await db.person.count({ where: { name: { startsWith: 'Prueba ' } } })).toBe(0)
})

test('a name that matches an existing person (ignoring case and accents) is not created again', async () => {
  const ok = await add('editor', { name: 'Prueba Pérez' })
  expect(ok.status).toBe(201)
  const dup = await add('admin', { name: '  PRUEBA   perez ' })
  expect(dup.status).toBe(409)
  expect(await dup.json()).toMatchObject({ error: 'Name exists', existing: { name: 'Prueba Pérez' } })
  expect(await db.person.count({ where: { name: { startsWith: 'Prueba ' } } })).toBe(1)
  // Phone never disambiguates; completing the name does.
  expect((await add('editor', { name: 'Prueba Pérez', phone: '999 999 9999' })).status).toBe(409)
  expect((await add('editor', { name: 'Prueba Pérez Rodríguez' })).status).toBe(201)
})

test('the same name in another church does not block, and does not link the other church person', async () => {
  expect((await add('b-editor', { name: 'Prueba Compartida' })).status).toBe(201)
  expect((await add('editor', { name: 'Prueba Compartida' })).status).toBe(201)
  expect(await db.person.count({ where: { name: 'Prueba Compartida' } })).toBe(2)
})

test('reads one person with account state, upcoming services and sharing, hiding other churches', async () => {
  await db.service.create({ data: { churchId: 'church-a', directorId: 'person-no-account', title: 'Culto', date: new Date('2026-11-20T00:00:00Z') } })
  await db.service.create({ data: { churchId: 'church-a', directorId: 'person-no-account', title: 'Pasado', date: new Date('2026-11-06T00:00:00Z') } })
  const shared = await (await call('member', 'GET', '/api/people/person-no-account')).json()
  expect(shared).toEqual({ id: 'person-no-account', name: 'Fixture Participant', phone: null, hasAccount: false, sharedWithOtherChurches: true, upcomingServices: 1 })
  const own = await (await call('member', 'GET', '/api/people/person-a')).json()
  expect(own).toMatchObject({ sharedWithOtherChurches: false, upcomingServices: 0 })
  expect((await call('member', 'GET', '/api/people/person-b')).status).toBe(404)
  expect((await call('member', 'GET', '/api/people/missing')).status).toBe(404)
})

test('personal data is general: a shared person is edited from either church and both see it', async () => {
  const edited = await call('editor', 'PATCH', '/api/people/person-no-account', { name: 'Prueba Compartido', phone: '555-0100' })
  expect(edited.status).toBe(200)
  expect(await edited.json()).toMatchObject({ name: 'Prueba Compartido', phone: '555-0100' })
  expect((await call('b-editor', 'GET', '/api/people/person-no-account').then(r => r.json())).phone).toBe('555-0100')
  expect((await call('b-editor', 'PATCH', '/api/people/person-no-account', { phone: null })).status).toBe(200)
  expect((await call('member', 'GET', '/api/people/person-no-account').then(r => r.json())).phone).toBeNull()
})

test('editing never reaches a person of another church, church data or the account link', async () => {
  expect((await call('editor', 'PATCH', '/api/people/person-b', { name: 'Prueba Intruso' })).status).toBe(404)
  expect((await db.person.findUniqueOrThrow({ where: { id: 'person-b' } })).name).toBe('Director person-b')
  for (const extra of [{ churchId: 'church-b' }, { userId: 'owner' }, { roles: ['x'] }]) {
    expect((await call('admin', 'PATCH', '/api/people/person-a', { name: 'Prueba X', ...extra })).status).toBe(400)
  }
  expect((await call('admin', 'PATCH', '/api/people/person-a', {})).status).toBe(400)
  expect((await call('member', 'PATCH', '/api/people/person-a', { name: 'Prueba X' })).status).toBe(403)
  expect(await db.churchPerson.count({ where: { personId: 'person-a' } })).toBe(1)
  expect((await db.person.findUniqueOrThrow({ where: { id: 'person-a' } })).userId).toBeNull()
})

test('renaming to the name of another person of the church is refused; keeping or recasing your own is fine', async () => {
  const clash = await call('editor', 'PATCH', '/api/people/person-a', { name: 'fixture participant' })
  expect(clash.status).toBe(409)
  expect(await clash.json()).toMatchObject({ existing: { id: 'person-no-account' } })
  expect((await call('editor', 'PATCH', '/api/people/person-a', { name: 'DIRECTOR PERSON-A' })).status).toBe(200)
})

test('only the administrator removes a person; the person and past services stay, and lists and directors exclude them', async () => {
  await db.service.create({ data: { churchId: 'church-a', directorId: 'person-a', title: 'Pasado', date: new Date('2026-11-06T00:00:00Z'), status: 'COMPLETED' } })
  expect((await call('editor', 'DELETE', '/api/people/person-a')).status).toBe(403)
  expect((await call('member', 'DELETE', '/api/people/person-a')).status).toBe(403)
  expect((await call('admin', 'DELETE', '/api/people/person-b')).status).toBe(404)
  expect((await call('admin', 'DELETE', '/api/people/person-a')).status).toBe(204)
  expect((await call('admin', 'DELETE', '/api/people/person-a')).status).toBe(404)
  expect(await db.person.count({ where: { id: 'person-a' } })).toBe(1)
  expect((await call('member', 'GET', '/api/people').then(r => r.json())).map((p: { id: string }) => p.id)).toEqual(['person-no-account'])
  expect((await call('member', 'GET', '/api/people/person-a')).status).toBe(404)
  const past = await (await call('member', 'GET', '/api/services?month=2026-11')).json()
  expect(past[0].director).toEqual({ id: 'person-a', name: 'Director person-a' })
  const again = await call('editor', 'POST', '/api/services', { title: 'Nuevo', date: '2026-11-27', status: 'DRAFT', directorId: 'person-a' })
  expect(again.status).toBe(400)
})

test('removing from one church keeps the shared person in the other', async () => {
  expect((await call('admin', 'DELETE', '/api/people/person-no-account')).status).toBe(204)
  expect((await call('b-editor', 'GET', '/api/people/person-no-account').then(r => r.json()))).toMatchObject({ name: 'Fixture Participant', sharedWithOtherChurches: false })
  expect((await call('member', 'GET', '/api/people/person-no-account')).status).toBe(404)
})

test('a person with upcoming services can be removed; the count tells the administrator beforehand', async () => {
  await db.service.create({ data: { churchId: 'church-a', directorId: 'person-a', title: 'Futuro', date: new Date('2026-11-27T00:00:00Z') } })
  expect((await call('admin', 'GET', '/api/people/person-a').then(r => r.json())).upcomingServices).toBe(1)
  expect((await call('admin', 'DELETE', '/api/people/person-a')).status).toBe(204)
  expect(await db.service.count({ where: { directorId: 'person-a' } })).toBe(1)
})
