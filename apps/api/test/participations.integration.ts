import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { createApp } from '../src/app.js'
import { connectDatabase } from '../src/database.ts'
import { seedFixtures } from './fixtures.ts'
import { sessionFixture } from './session-fixture.mjs'

const url = process.env.TEST_DATABASE_URL
if (!url || !/^postgresql:\/\/planlyrics_fixture@127\.0\.0\.1:\d+\/plan_lyrics_access_fixture$/.test(url)) throw new Error('Use pnpm test:db')
const db = connectDatabase(url)
const fixture = sessionFixture()
// Thursday 12 Nov 2026, 12:00 in Mexico City. Church A holds services on Fridays (5) and Sundays (0).
let clock = new Date('2026-11-12T18:00:00Z')
const api = createApp(fixture.config, db, () => clock)
const people = ['luis', 'pedro', 'juan', 'ana'].map(name => `p-${name}`)
const churches = ['church-a', 'church-b']

const reset = async () => {
  clock = new Date('2026-11-12T18:00:00Z')
  await db.batchDirectors.deleteMany()
  await db.service.deleteMany()
  await db.rolePlan.deleteMany()
  await db.roleRestriction.deleteMany({ where: { churchId: { in: churches } } })
  await db.musicalRole.deleteMany({ where: { churchId: { in: churches } } })
  await db.church.updateMany({ where: { id: { in: churches } }, data: { rolesSeeded: false } })
  await db.churchPerson.updateMany({ data: { removedAt: null } })
}
beforeAll(async () => {
  await seedFixtures(db)
  for (const id of people) await db.person.upsert({ where: { id }, update: {}, create: { id, name: id.replace('p-', '').replace(/^./, c => c.toUpperCase()), churches: { create: { churchId: 'church-a' } } } })
  await reset()
})
beforeEach(reset)
afterAll(async () => { await reset(); await db.person.deleteMany({ where: { id: { in: people } } }); await db.$disconnect() })

function call(subject: string | undefined, method: string, path: string, body?: unknown) {
  return api.request(path, {
    method,
    headers: { ...(subject ? { Authorization: `Bearer ${fixture.token(`fixture-${subject}`)}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}
const json = async <T = any>(response: Response) => (await response.json()) as T // eslint-disable-line @typescript-eslint/no-explicit-any
const roleId = async (name: string, subject = 'member') => (await json<{ id: string; name: string }[]>(await call(subject, 'GET', '/api/roles'))).find(role => role.name === name)!.id
const [luis, pedro, juan, ana] = people
const rotation = (sequences: { weekday: number | null; personIds: string[] }[], over: Record<string, unknown> = {}) =>
  ({ enabled: true, mode: 'SHARED', startsOn: '2026-11-01', sequences, ...over })
const configure = async (name: string, habitualIds: string[], rot: ReturnType<typeof rotation> | null, subject = 'editor') =>
  call(subject, 'PUT', `/api/role-participations/${await roleId(name)}`, { habitualIds, rotation: rot ?? { enabled: false, mode: 'BY_DAY', startsOn: null, sequences: [] } })
const shared = (...personIds: string[]) => rotation([{ weekday: null, personIds }])
const createService = (date: string, over: Record<string, unknown> = {}, subject = 'editor') =>
  call(subject, 'POST', '/api/services', { title: 'Servicio', date, status: 'DRAFT', directorId: 'person-a', ...over })
const assignmentsOf = async (serviceId: string, subject = 'member') => (await json(await call(subject, 'GET', `/api/services/${serviceId}/assignments`))).assignments as
  { id: string; roleName: string; source: string; pending: string | null; person: { id: string } | null; proposed: { id: string } | null }[]
const pairs = async (serviceId: string) => (await assignmentsOf(serviceId)).map(row => `${row.roleName}:${row.person?.id ?? `pendiente(${row.pending})`}`).sort()
const serviceOn = async (date: string) => (await db.service.findFirstOrThrow({ where: { churchId: 'church-a', date: new Date(`${date}T00:00:00Z`) } })).id
const turnFor = async (date: string, role = 'Voces') => (await assignmentsOf(await serviceOn(date))).find(row => row.roleName === role && row.source === 'ROTATION')?.person?.id
const holder = async (date: string, role = 'Voces') => (await assignmentsOf(await serviceOn(date))).find(row => row.roleName === role)?.person?.id

test('everyone reads the configuration of the roles; editor and admin save it; member and anonymous cannot', async () => {
  const read = await call('member', 'GET', '/api/role-participations')
  expect(read.status).toBe(200)
  expect((await json<{ name: string }[]>(read)).map(role => role.name)).toEqual(['Batería', 'Guitarra', 'Piano', 'Voces'])
  expect((await configure('Voces', [luis], null, 'member')).status).toBe(403)
  expect((await call(undefined, 'GET', '/api/role-participations')).status).toBe(401)
  expect((await configure('Voces', [luis], null, 'admin')).status).toBe(200)
  const saved = await configure('Voces', [ana, luis], shared(pedro, juan))
  expect(saved.status).toBe(200)
  expect(await json(saved)).toMatchObject({
    name: 'Voces', habitual: [{ id: ana }, { id: luis }],
    rotation: { enabled: true, mode: 'SHARED', startsOn: '2026-11-01', sequences: [{ weekday: null, people: [{ id: pedro }, { id: juan }] }] },
  })
})

test('the church comes from the session: a church field, another church\'s role or person, and an unknown role are refused', async () => {
  const voices = await roleId('Voces')
  const body = { habitualIds: [], rotation: { enabled: false, mode: 'BY_DAY', startsOn: null, sequences: [] } }
  expect((await call('editor', 'PUT', `/api/role-participations/${voices}`, { ...body, churchId: 'church-b' })).status).toBe(400)
  expect((await call('editor', 'PUT', '/api/role-participations/nope', body)).status).toBe(404)
  const other = (await json<{ id: string }[]>(await call('b-editor', 'GET', '/api/roles')))[0].id
  expect((await call('editor', 'PUT', `/api/role-participations/${other}`, body)).status).toBe(404)
  expect((await call('editor', 'PUT', `/api/role-participations/${voices}`, { ...body, habitualIds: ['person-b'] })).status).toBe(400)
  expect((await call('editor', 'PUT', `/api/role-participations/${voices}`, { ...body, habitualIds: [luis, luis] })).status).toBe(400)
  expect((await configure('Voces', [luis], shared(luis))).status).toBe(400)
  expect(await db.rolePlan.count()).toBe(0)
})

test('a removed person cannot be chosen and disappears from what is read', async () => {
  await configure('Voces', [luis], shared(pedro, juan))
  await db.churchPerson.update({ where: { churchId_personId: { churchId: 'church-a', personId: luis } }, data: { removedAt: new Date() } })
  const voices = (await json<{ name: string; habitual: unknown[] }[]>(await call('member', 'GET', '/api/role-participations'))).find(role => role.name === 'Voces')!
  expect(voices.habitual).toEqual([])
  expect((await configure('Voces', [luis], null)).status).toBe(400)
})

test('creating a service loads the habitual people and the next rotation turn, and the sequence continues in the next service', async () => {
  await configure('Voces', [ana], shared(luis, pedro, juan))
  await configure('Guitarra', [pedro], null)
  const first = await json(await createService('2026-11-13'))
  expect(await pairs(first.id)).toEqual([`Guitarra:${pedro}`, `Voces:${ana}`, `Voces:${luis}`])
  expect((await createService('2026-11-15')).status).toBe(201)
  expect(await turnFor('2026-11-15')).toBe(pedro)
  // The preview shows who would take the next turn without moving the cursor.
  const voices = (await json<{ name: string; preview: { date: string; rotation: { id: string } | null }[] }[]>(await call('member', 'GET', '/api/role-participations'))).find(role => role.name === 'Voces')!
  expect(voices.preview.slice(0, 2).map(entry => [entry.date, entry.rotation?.id])).toEqual([['2026-11-13', juan], ['2026-11-15', luis]])
  expect((await db.rotationSequence.findFirstOrThrow()).nextPersonId).toBe(juan)
})

test('by weekday, a Sunday does not advance the Friday sequence', async () => {
  await configure('Voces', [], rotation([{ weekday: 5, personIds: [luis, pedro] }, { weekday: 0, personIds: [juan, ana] }], { mode: 'BY_DAY' }))
  for (const date of ['2026-11-13', '2026-11-15', '2026-11-20', '2026-11-22']) await createService(date)
  expect([await turnFor('2026-11-13'), await turnFor('2026-11-15'), await turnFor('2026-11-20'), await turnFor('2026-11-22')]).toEqual([luis, juan, pedro, ana])
})

test('a rotation does not reach services before its reference date', async () => {
  await configure('Voces', [], { ...shared(luis, pedro), startsOn: '2026-11-20' })
  await createService('2026-11-13')
  await createService('2026-11-20')
  expect(await turnFor('2026-11-13')).toBeUndefined()
  expect(await turnFor('2026-11-20')).toBe(luis)
})

test('a monthly batch generates the participations in date order and the next batch continues the rotation', async () => {
  await configure('Voces', [], shared(luis, pedro, juan))
  const batch = (month: string, dates: string[]) => call('editor', 'POST', '/api/service-batches', {
    month, directorIds: ['person-a'], entries: dates.map(date => ({ date, title: 'Servicio', time: '19:30', directorId: 'person-a' })),
  })
  // Friday 13, Sunday 15, Friday 20 and Sunday 22: entered out of order, generated by date.
  expect((await batch('2026-11', ['2026-11-20', '2026-11-13', '2026-11-22', '2026-11-15'])).status).toBe(201)
  expect([await turnFor('2026-11-13'), await turnFor('2026-11-15'), await turnFor('2026-11-20'), await turnFor('2026-11-22')]).toEqual([luis, pedro, juan, luis])
  expect((await batch('2026-12', ['2026-12-04', '2026-12-06'])).status).toBe(201)
  expect([await turnFor('2026-12-04'), await turnFor('2026-12-06')]).toEqual([pedro, juan])
})

test('a person proposed for two roles that the church does not combine leaves both pending; an allowed pair is assigned', async () => {
  const [guitar, piano] = [await roleId('Guitarra'), await roleId('Piano')]
  await call('admin', 'POST', '/api/role-restrictions', { first: guitar, second: piano })
  await configure('Guitarra', [ana, pedro], null)
  await configure('Piano', [ana], null)
  await configure('Voces', [ana], null)
  const service = await json(await createService('2026-11-13'))
  expect(await pairs(service.id)).toEqual([`Guitarra:${pedro}`, 'Guitarra:pendiente(COMBINATION)', 'Piano:pendiente(COMBINATION)', `Voces:${ana}`])
  const pending = (await assignmentsOf(service.id)).filter(row => row.pending)
  expect(pending.map(row => row.proposed?.id)).toEqual([ana, ana])
})

test('the director is never moved: a habitual drummer who directs that service stays pending in drums', async () => {
  await configure('Batería', ['person-a', pedro], null)
  const service = await json(await createService('2026-11-13'))
  expect(await pairs(service.id)).toEqual([`Batería:${pedro}`, 'Batería:pendiente(COMBINATION)'])
  expect((await createService('2026-11-20', { directorId: luis }).then(json)).id).toBeTruthy()
  expect(await pairs(await serviceOn('2026-11-20'))).toEqual([`Batería:${pedro}`, 'Batería:person-a'])
})

test('replacing a person changes only that service; the rotation and other services are untouched', async () => {
  await configure('Voces', [], shared(luis, pedro, juan))
  await createService('2026-11-13')
  await createService('2026-11-20')
  const [first] = await assignmentsOf(await serviceOn('2026-11-13'))
  expect((await call('member', 'PUT', `/api/assignments/${first.id}`, { personId: ana })).status).toBe(403)
  const replaced = await call('editor', 'PUT', `/api/assignments/${first.id}`, { personId: ana })
  expect(replaced.status).toBe(200)
  expect(await json(replaced)).toMatchObject({ person: { id: ana }, source: 'MANUAL' })
  expect([await holder('2026-11-13'), await holder('2026-11-20')]).toEqual([ana, pedro])
  expect(await pairs(await serviceOn('2026-11-13'))).toEqual([`Voces:${ana}`])
  // The cursor still points to the third person.
  expect((await db.rotationSequence.findFirstOrThrow()).nextPersonId).toBe(juan)
})

test('a replacement or an added person respects the forbidden combinations and duplicates', async () => {
  const [guitar, piano] = [await roleId('Guitarra'), await roleId('Piano')]
  await call('admin', 'POST', '/api/role-restrictions', { first: guitar, second: piano })
  await configure('Guitarra', [ana], null)
  await configure('Piano', [pedro], null)
  const service = await json(await createService('2026-11-13'))
  const rows = await assignmentsOf(service.id)
  const pianoRow = rows.find(row => row.roleName === 'Piano')!
  const refused = await call('editor', 'PUT', `/api/assignments/${pianoRow.id}`, { personId: ana })
  expect([refused.status, await json(refused)]).toEqual([409, { error: 'Combination not allowed' }])
  // A person who already holds the role is not duplicated; the director cannot take a forbidden role either.
  const again = await call('editor', 'POST', `/api/services/${service.id}/assignments`, { roleId: guitar, personId: ana })
  expect([again.status, await json(again)]).toEqual([409, { error: 'Already assigned' }])
  await call('admin', 'POST', '/api/role-restrictions', { first: 'DIRIGIR', second: piano })
  expect((await call('editor', 'POST', `/api/services/${service.id}/assignments`, { roleId: piano, personId: 'person-a' })).status).toBe(409)
  const added = await call('editor', 'POST', `/api/services/${service.id}/assignments`, { roleId: await roleId('Voces'), personId: ana })
  expect(added.status).toBe(201)
  const addedBody = await json(added)
  expect(addedBody).toMatchObject({ roleName: 'Voces', person: { id: ana }, source: 'MANUAL' })
  expect((await call('editor', 'POST', `/api/services/${service.id}/assignments`, { roleId: await roleId('Voces'), personId: 'person-b' })).status).toBe(400)
  const addedId = addedBody.id
  expect((await call('editor', 'DELETE', `/api/assignments/${addedId}`)).status).toBe(204)
  expect((await call('editor', 'DELETE', `/api/assignments/${addedId}`)).status).toBe(404)
})

test('swapping two turns of the same role exchanges their people; replacing never swaps; the others stay', async () => {
  await configure('Voces', [], shared(luis, pedro, juan))
  for (const date of ['2026-11-13', '2026-11-20', '2026-11-27']) await createService(date)
  const turns = await json<{ id: string; date: string; person: { id: string } }[]>(await call('member', 'GET', `/api/role-turns?roleId=${await roleId('Voces')}`))
  expect(turns.map(turn => [turn.date, turn.person.id])).toEqual([['2026-11-13', luis], ['2026-11-20', pedro], ['2026-11-27', juan]])
  expect((await call('member', 'POST', '/api/assignments/swap', { first: turns[0].id, second: turns[1].id })).status).toBe(403)
  const swapped = await call('editor', 'POST', '/api/assignments/swap', { first: turns[0].id, second: turns[1].id })
  expect(swapped.status).toBe(200)
  expect([await holder('2026-11-13'), await holder('2026-11-20'), await holder('2026-11-27')]).toEqual([pedro, luis, juan])
  expect((await call('editor', 'POST', '/api/assignments/swap', { first: turns[0].id, second: turns[0].id })).status).toBe(400)
})

test('a swap needs the same role and respects the combinations of both services', async () => {
  const [guitar, piano] = [await roleId('Guitarra'), await roleId('Piano')]
  await configure('Voces', [], shared(luis, pedro))
  await configure('Guitarra', [ana], null)
  await createService('2026-11-13')
  await createService('2026-11-20')
  const voices = await json<{ id: string }[]>(await call('member', 'GET', `/api/role-turns?roleId=${await roleId('Voces')}`))
  const [guitarRow] = (await assignmentsOf(await serviceOn('2026-11-20'))).filter(row => row.roleName === 'Guitarra')
  expect((await call('editor', 'POST', '/api/assignments/swap', { first: voices[0].id, second: guitarRow.id })).status).toBe(400)
  // Pedro would take Luis's turn in a service where he also plays guitar and the church forbids both.
  await call('admin', 'POST', '/api/role-restrictions', { first: await roleId('Voces'), second: guitar })
  await call('editor', 'POST', `/api/services/${await serviceOn('2026-11-13')}/assignments`, { roleId: piano, personId: pedro })
  const added = await call('editor', 'POST', `/api/services/${await serviceOn('2026-11-13')}/assignments`, { roleId: guitar, personId: pedro })
  expect(added.status).toBe(201)
  const refused = await call('editor', 'POST', '/api/assignments/swap', { first: voices[0].id, second: voices[1].id })
  expect([refused.status, await json(refused)]).toEqual([409, { error: 'Combination not allowed' }])
  expect([await holder('2026-11-13'), await holder('2026-11-20')]).toEqual([luis, pedro])
})

test('past services are a record: assignments cannot be replaced, added, removed or swapped', async () => {
  await configure('Voces', [], shared(luis, pedro))
  await createService('2026-11-13')
  await createService('2026-11-20')
  clock = new Date('2026-11-16T18:00:00Z')
  const [past] = await assignmentsOf(await serviceOn('2026-11-13'))
  const [future] = await assignmentsOf(await serviceOn('2026-11-20'))
  for (const result of [
    await call('editor', 'PUT', `/api/assignments/${past.id}`, { personId: ana }),
    await call('editor', 'POST', `/api/services/${await serviceOn('2026-11-13')}/assignments`, { roleId: await roleId('Voces'), personId: ana }),
    await call('editor', 'DELETE', `/api/assignments/${past.id}`),
    await call('editor', 'POST', '/api/assignments/swap', { first: past.id, second: future.id }),
  ]) expect([result.status]).toEqual([400])
  expect((await call('member', 'GET', `/api/services/${await serviceOn('2026-11-13')}/assignments`)).status).toBe(200)
})

test('assignments of another church do not exist for this church', async () => {
  await configure('Voces', [luis], null)
  await createService('2026-11-13')
  const service = await serviceOn('2026-11-13')
  const [row] = await assignmentsOf(service)
  expect((await call('b-editor', 'GET', `/api/services/${service}/assignments`)).status).toBe(404)
  expect((await call('b-editor', 'PUT', `/api/assignments/${row.id}`, { personId: 'person-b' })).status).toBe(404)
  expect((await call('b-editor', 'DELETE', `/api/assignments/${row.id}`)).status).toBe(404)
  expect((await call('b-editor', 'POST', '/api/assignments/swap', { first: row.id, second: row.id })).status).toBe(400)
  expect((await call(undefined, 'GET', `/api/services/${service}/assignments`)).status).toBe(401)
  expect(await pairs(service)).toEqual([`Voces:${luis}`])
})

test('deleting a role with future assignments asks first; confirming keeps them as pending and past ones as a record', async () => {
  await configure('Voces', [luis], null)
  await createService('2026-11-13')
  await createService('2026-11-20')
  clock = new Date('2026-11-16T18:00:00Z')
  const voices = await roleId('Voces')
  const asked = await call('admin', 'DELETE', `/api/roles/${voices}`)
  expect([asked.status, await json(asked)]).toEqual([409, { error: 'Future assignments', services: 1 }])
  expect((await call('editor', 'DELETE', `/api/roles/${voices}?confirm=future-assignments`)).status).toBe(403)
  expect(await db.musicalRole.count({ where: { id: voices } })).toBe(1)
  expect((await call('admin', 'DELETE', `/api/roles/${voices}?confirm=future-assignments`)).status).toBe(204)
  expect(await db.musicalRole.count({ where: { id: voices } })).toBe(0)
  const past = await db.assignment.findFirstOrThrow({ where: { service: { date: new Date('2026-11-13T00:00:00Z') } } })
  expect(past).toMatchObject({ roleId: null, roleName: 'Voces', personId: luis, pending: null })
  const ahead = await db.assignment.findFirstOrThrow({ where: { service: { date: new Date('2026-11-20T00:00:00Z') } } })
  expect(ahead).toMatchObject({ roleId: null, roleName: 'Voces', personId: null, pending: 'ROLE_REMOVED' })
  const [shown] = await assignmentsOf(await serviceOn('2026-11-20'))
  expect(shown).toMatchObject({ roleName: 'Voces', pending: 'ROLE_REMOVED', person: null })
  // A marker without a role cannot be given a person; it can only be removed.
  expect((await call('editor', 'PUT', `/api/assignments/${shown.id}`, { personId: ana })).status).toBe(409)
  expect((await call('editor', 'DELETE', `/api/assignments/${shown.id}`)).status).toBe(204)
})

test('a role without assignments ahead is deleted at once, and only a service from today on counts as ahead', async () => {
  await configure('Voces', [luis], null)
  await createService('2026-11-13')
  clock = new Date('2026-11-14T18:00:00Z')
  expect((await call('admin', 'DELETE', `/api/roles/${await roleId('Voces')}`)).status).toBe(204)
  await configure('Guitarra', [pedro], null)
  await createService('2026-11-20')
  clock = new Date('2026-11-20T18:00:00Z')
  const guitar = await roleId('Guitarra')
  expect((await call('admin', 'DELETE', `/api/roles/${guitar}`)).status).toBe(409)
})

test('the database never keeps a person together with a pending marker, nor an empty assignment', async () => {
  await configure('Voces', [luis], null)
  await createService('2026-11-13')
  const row = await db.assignment.findFirstOrThrow()
  await expect(db.assignment.update({ where: { id: row.id }, data: { pending: 'COMBINATION' } })).rejects.toThrow()
  await expect(db.assignment.update({ where: { id: row.id }, data: { personId: null } })).rejects.toThrow()
})
