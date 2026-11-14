import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { createApp } from '../src/app.js'
import { connectDatabase } from '../src/database.ts'
import { seedFixtures } from './fixtures.ts'
import { sessionFixture } from './session-fixture.mjs'

const url = process.env.TEST_DATABASE_URL
if (!url || !/^postgresql:\/\/planlyrics_fixture@127\.0\.0\.1:\d+\/plan_lyrics_access_fixture$/.test(url)) throw new Error('Use pnpm test:db')
const db = connectDatabase(url)
const fixture = sessionFixture()
// Thursday 12 Nov 2026, 12:00 in Mexico City. Church A holds services on Fridays and Sundays.
let clock = new Date('2026-11-12T18:00:00Z')
const api = createApp(fixture.config, db, () => clock)
const luis = 'p-luis'
const pedro = 'p-pedro'
// The user `combined` is only a member of church A; this person ties an account to a preaching assignment.
const withAccount = 'p-account'

const reset = async () => {
  clock = new Date('2026-11-12T18:00:00Z')
  await db.service.deleteMany()
  await db.batchDirectors.deleteMany()
  await db.church.update({ where: { id: 'church-a' }, data: { usesPreaching: true } })
  await db.churchPerson.updateMany({ data: { removedAt: null } })
}
beforeAll(async () => {
  await seedFixtures(db)
  for (const [id, name, userId] of [[luis, 'Luis', null], [pedro, 'Pedro', null], [withAccount, 'Ana con cuenta', 'combined']] as const) {
    await db.person.upsert({ where: { id }, update: {}, create: { id, name, userId, churches: { create: { churchId: 'church-a' } } } })
  }
  await reset()
})
beforeEach(reset)
afterAll(async () => {
  await reset()
  await db.church.update({ where: { id: 'church-a' }, data: { usesPreaching: false } })
  await db.person.deleteMany({ where: { id: { in: [luis, pedro, withAccount] } } })
  await db.$disconnect()
})

function call(subject: string | undefined, method: string, path: string, body?: unknown) {
  return api.request(path, {
    method,
    headers: { ...(subject ? { Authorization: `Bearer ${fixture.token(`fixture-${subject}`)}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}
const json = async <T = any>(response: Response) => (await response.json()) as T // eslint-disable-line @typescript-eslint/no-explicit-any
const create = async (date: string, over: Record<string, unknown> = {}) =>
  (await json<{ id: string }>(await call('editor', 'POST', '/api/services', { title: 'Servicio', date, status: 'DRAFT', directorId: 'person-a', ...over }))).id
const section = (over: Record<string, unknown> = {}) => ({ preacherId: luis, topic: 'La fe', passages: ['Hebreos 11:1', 'Romanos 10:17'], notes: '- Punto uno\n- Punto **dos**', ...over })
const save = (subject: string | undefined, serviceId: string, body: unknown) => call(subject, 'PUT', `/api/services/${serviceId}/preaching`, body)
const read = (subject: string | undefined, serviceId: string) => call(subject, 'GET', `/api/services/${serviceId}/preaching`)
const swap = (subject: string | undefined, first: string, second: string) => call(subject, 'POST', '/api/preaching/swap', { first, second })
const preacherOf = async (serviceId: string) => (await db.servicePreaching.findUnique({ where: { serviceId } }))?.preacherId ?? null

test('an editor or an admin saves the section, with a preacher who has no account; members and anonymous cannot', async () => {
  const id = await create('2026-11-13')
  expect((await save(undefined, id, section())).status).toBe(401)
  expect((await save('member', id, section())).status).toBe(403)
  expect((await save('combined', id, section())).status).toBe(403)
  for (const subject of ['editor', 'admin']) {
    const response = await save(subject, id, section({ topic: `La fe (${subject})` }))
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await json(response)).toEqual({
      serviceId: id, preacher: { id: luis, name: 'Luis' }, topic: `La fe (${subject})`, passages: ['Hebreos 11:1', 'Romanos 10:17'],
      canSeeNotes: true, notes: '- Punto uno\n- Punto **dos**',
    })
  }
  expect((await save('multi', id, section())).status).toBe(409) // several memberships: no active church
})

test('notes reach administrators, editors and the assigned preacher with an account, and nobody else', async () => {
  const mine = await create('2026-11-13')
  const other = await create('2026-11-15')
  await save('editor', mine, section({ preacherId: withAccount }))
  await save('editor', other, section({ preacherId: luis }))
  for (const subject of ['editor', 'admin']) expect((await json(await read(subject, mine))).notes).toBe('- Punto uno\n- Punto **dos**')
  // The preacher with an account reads the notes of their own date, but being a preacher gives nothing more.
  expect(await json(await read('combined', mine))).toMatchObject({ canSeeNotes: true, notes: '- Punto uno\n- Punto **dos**', preacher: { id: withAccount } })
  const hidden = await json(await read('combined', other))
  expect(hidden).toEqual({ serviceId: other, preacher: { id: luis, name: 'Luis' }, topic: 'La fe', passages: ['Hebreos 11:1', 'Romanos 10:17'], canSeeNotes: false })
  expect('notes' in hidden).toBe(false)
  expect('notes' in await json(await read('member', mine))).toBe(false)
  expect((await read(undefined, mine)).status).toBe(401)
  // No other response carries notes: the service lists and the assignments leave the section out.
  const month = JSON.stringify(await json(await call('editor', 'GET', '/api/services?month=2026-11')))
  expect(month).not.toContain('Punto')
  expect(JSON.stringify(await json(await call('editor', 'GET', `/api/services/${mine}/assignments`)))).not.toContain('Punto')
})

test('a removed preacher or a person without an account never reads the notes', async () => {
  const id = await create('2026-11-13')
  await save('editor', id, section({ preacherId: withAccount }))
  await db.churchPerson.update({ where: { churchId_personId: { churchId: 'church-a', personId: withAccount } }, data: { removedAt: new Date() } })
  expect((await json(await read('combined', id))).canSeeNotes).toBe(false)
  await db.churchPerson.update({ where: { churchId_personId: { churchId: 'church-a', personId: withAccount } }, data: { removedAt: null } })
  await save('editor', id, section({ preacherId: luis }))
  expect((await json(await read('combined', id))).canSeeNotes).toBe(false)
})

test('the section is optional, starts empty and an emptied one is not stored', async () => {
  const id = await create('2026-11-13')
  expect(await json(await read('member', id))).toEqual({ serviceId: id, preacher: null, topic: '', passages: [], canSeeNotes: false })
  expect(await json(await read('editor', id))).toEqual({ serviceId: id, preacher: null, topic: '', passages: [], canSeeNotes: true, notes: '' })
  // Topic and notes may exist before anybody preaches.
  expect((await save('editor', id, section({ preacherId: null }))).status).toBe(200)
  expect(await db.servicePreaching.count({ where: { serviceId: id } })).toBe(1)
  expect((await save('editor', id, { preacherId: null, topic: ' ', passages: [], notes: '' })).status).toBe(200)
  expect(await db.servicePreaching.count({ where: { serviceId: id } })).toBe(0)
})

test('the same person may direct and preach a service, and may preach several dates in a row', async () => {
  // The default restriction (Dirigir + Batería) only governs the musical roles, never preaching.
  const first = await create('2026-11-13')
  const second = await create('2026-11-15', { directorId: luis })
  expect((await save('editor', first, section({ preacherId: 'person-a' }))).status).toBe(200)
  expect((await save('editor', second, section({ preacherId: luis }))).status).toBe(200)
  const third = await create('2026-11-20')
  expect((await save('editor', third, section({ preacherId: luis }))).status).toBe(200)
  expect(await Promise.all([second, third].map(preacherOf))).toEqual([luis, luis])
})

test('text is cleaned and limited on the server: nothing is truncated and nothing becomes markup', async () => {
  const id = await create('2026-11-13')
  const response = await save('editor', id, section({
    topic: '  La   fe‮  ', passages: ['  Juan 3:16 \n\nSalmo  23 ', '<b>x</b>'], notes: '  - uno \r\n\r\n\r\n\r\n- dos​  ',
  }))
  expect(await json(response)).toMatchObject({ topic: 'La fe', passages: ['Juan 3:16', 'Salmo 23', '<b>x</b>'], notes: '- uno\n\n- dos' })
  for (const bad of [
    { topic: 'x'.repeat(161) }, { passages: Array.from({ length: 21 }, (_, index) => `Salmo ${index}`) }, { passages: ['x'.repeat(81)] },
    { notes: 'x'.repeat(4001) }, { notes: Array.from({ length: 101 }, () => '- a').join('\n') }, { topic: 3 }, { passages: 'Juan 3:16' }, { notes: null },
  ]) expect((await save('editor', id, section(bad))).status, JSON.stringify(bad).slice(0, 40)).toBe(400)
  expect((await save('editor', id, 'no es json')).status).toBe(400)
  expect(await db.servicePreaching.findUniqueOrThrow({ where: { serviceId: id } })).toMatchObject({ topic: 'La fe', notes: '- uno\n\n- dos' })
})

test('the church always comes from the session: another church\'s people and services do not exist', async () => {
  const id = await create('2026-11-13')
  expect((await save('editor', id, { ...section(), churchId: 'church-b' })).status).toBe(400)
  expect((await save('editor', id, section({ preacherId: 'person-b' }))).status).toBe(400)
  expect((await save('editor', id, section({ preacherId: 'no-existe' }))).status).toBe(400)
  const foreign = await db.service.create({ data: { churchId: 'church-b', directorId: 'person-b', date: new Date('2026-11-15T00:00:00Z'), title: 'Otra iglesia', status: 'DRAFT', slot: 'MORNING' } })
  expect((await save('editor', foreign.id, section({ preacherId: null }))).status).toBe(404)
  expect((await read('editor', foreign.id)).status).toBe(404)
  expect((await read('editor', 'no-existe')).status).toBe(404)
  expect(await db.servicePreaching.count()).toBe(0)
  // Defence in depth: even a direct write cannot point at a preacher or a service of another church.
  await expect(db.servicePreaching.create({ data: { serviceId: id, churchId: 'church-a', preacherId: 'person-b' } })).rejects.toThrow()
  await expect(db.servicePreaching.create({ data: { serviceId: foreign.id, churchId: 'church-a' } })).rejects.toThrow()
})

test('a past service is a record; today still accepts changes', async () => {
  const id = await create('2026-11-12')
  expect((await save('editor', id, section())).status).toBe(200)
  clock = new Date('2026-11-13T18:00:00Z')
  const refused = await save('editor', id, section({ topic: 'Otro' }))
  expect(refused.status).toBe(400)
  expect(await json(refused)).toEqual({ error: 'Date in the past' })
  expect((await read('editor', id)).status).toBe(200)
})

test('a preacher who left the directory stays on the date, but cannot be chosen again', async () => {
  const id = await create('2026-11-13')
  await save('editor', id, section({ preacherId: luis }))
  await db.churchPerson.update({ where: { churchId_personId: { churchId: 'church-a', personId: luis } }, data: { removedAt: new Date() } })
  expect((await save('editor', id, section({ preacherId: luis, topic: 'Nuevo tema' }))).status).toBe(200)
  expect((await save('editor', id, section({ preacherId: pedro, topic: 'Nuevo tema' }))).status).toBe(200)
  expect((await save('editor', id, section({ preacherId: luis }))).status).toBe(400)
})

test('with «Usa predicación» off every read and write is refused and the stored data is kept', async () => {
  const id = await create('2026-11-13')
  const other = await create('2026-11-15')
  await save('editor', id, section())
  await save('editor', other, section({ preacherId: pedro }))
  await db.church.update({ where: { id: 'church-a' }, data: { usesPreaching: false } })
  const refused = await save('editor', id, section({ topic: 'Otro' }))
  expect([refused.status, await json(refused)]).toEqual([409, { error: 'Preaching disabled' }])
  expect((await read('editor', id)).status).toBe(409)
  expect((await read('member', id)).status).toBe(409)
  expect((await swap('editor', id, other)).status).toBe(409)
  expect((await call('editor', 'GET', '/api/preaching-turns')).status).toBe(409)
  expect((await save('member', id, section())).status).toBe(403)
  expect(await db.servicePreaching.findUniqueOrThrow({ where: { serviceId: id } })).toMatchObject({ topic: 'La fe', preacherId: luis })
  await db.church.update({ where: { id: 'church-a' }, data: { usesPreaching: true } })
  expect((await json(await read('editor', id))).topic).toBe('La fe')
})

test('swapping trades only the preachers of two dates; topics, passages and notes stay with their date', async () => {
  const [a, b, c] = [await create('2026-11-13'), await create('2026-11-15'), await create('2026-11-20')]
  await save('editor', a, section({ preacherId: luis, topic: 'Tema A', notes: '- nota A' }))
  await save('editor', b, section({ preacherId: pedro, topic: 'Tema B', passages: ['Mateo 5'], notes: '- nota B' }))
  await save('editor', c, section({ preacherId: luis, topic: 'Tema C' }))
  expect((await swap('member', a, b)).status).toBe(403)
  expect((await swap('combined', a, b)).status).toBe(403)
  expect((await swap(undefined, a, b)).status).toBe(401)
  const done = await swap('editor', a, b)
  expect([done.status, await json(done)]).toEqual([200, { swapped: [a, b] }])
  expect(await Promise.all([a, b, c].map(preacherOf))).toEqual([pedro, luis, luis])
  expect(await db.servicePreaching.findUniqueOrThrow({ where: { serviceId: a } })).toMatchObject({ topic: 'Tema A', notes: '- nota A', passages: ['Hebreos 11:1', 'Romanos 10:17'] })
  expect(await db.servicePreaching.findUniqueOrThrow({ where: { serviceId: b } })).toMatchObject({ topic: 'Tema B', notes: '- nota B', passages: ['Mateo 5'] })
  // The same person on both dates, or a date without preacher, has nothing to trade.
  expect((await swap('editor', b, c)).status).toBe(400)
  const empty = await create('2026-11-22')
  expect((await swap('editor', a, empty)).status).toBe(400)
  expect((await swap('editor', a, a)).status).toBe(400)
  expect((await call('editor', 'POST', '/api/preaching/swap', { first: a, second: b, churchId: 'church-b' })).status).toBe(400)
  expect(await Promise.all([a, b, c].map(preacherOf))).toEqual([pedro, luis, luis])
})

test('a swap never reaches another church and refuses past dates and people who left', async () => {
  const [a, b] = [await create('2026-11-13'), await create('2026-11-15')]
  await save('editor', a, section({ preacherId: luis }))
  await save('editor', b, section({ preacherId: pedro }))
  const foreign = await db.service.create({ data: { churchId: 'church-b', directorId: 'person-b', date: new Date('2026-11-15T00:00:00Z'), title: 'Otra', status: 'DRAFT', slot: 'MORNING' } })
  await db.servicePreaching.create({ data: { serviceId: foreign.id, churchId: 'church-b', preacherId: 'person-b' } })
  expect((await swap('editor', a, foreign.id)).status).toBe(404)
  expect((await swap('editor', a, 'no-existe')).status).toBe(404)
  await db.churchPerson.update({ where: { churchId_personId: { churchId: 'church-a', personId: pedro } }, data: { removedAt: new Date() } })
  expect((await swap('editor', a, b)).status).toBe(400)
  await db.churchPerson.update({ where: { churchId_personId: { churchId: 'church-a', personId: pedro } }, data: { removedAt: null } })
  clock = new Date('2026-11-14T18:00:00Z') // the 13th is past
  const past = await swap('editor', a, b)
  expect([past.status, await json(past)]).toEqual([400, { error: 'Date in the past' }])
  expect(await Promise.all([a, b].map(preacherOf))).toEqual([luis, pedro])
})

test('the upcoming turns list who preaches next, for those who edit only, without notes', async () => {
  const [a, b] = [await create('2026-11-13'), await create('2026-11-15')]
  await save('editor', a, section({ preacherId: luis }))
  await save('editor', b, section({ preacherId: null }))
  expect((await call('member', 'GET', '/api/preaching-turns')).status).toBe(403)
  expect((await call(undefined, 'GET', '/api/preaching-turns')).status).toBe(401)
  const turns = await json(await call('editor', 'GET', '/api/preaching-turns'))
  expect(turns).toEqual([{ serviceId: a, date: '2026-11-13', slot: 'SINGLE', title: 'Servicio', person: { id: luis, name: 'Luis' } }])
  expect(JSON.stringify(turns)).not.toContain('Punto')
  expect(await json(await call('editor', 'GET', '/api/preaching-turns?from=2026-11-14'))).toEqual([])
  expect((await call('editor', 'GET', '/api/preaching-turns?from=mañana')).status).toBe(400)
})

test('a monthly batch can assign preachers to its dates, the same person several times in a row', async () => {
  const entries = [
    { date: '2026-11-13', title: 'Viernes', time: '19:30', directorId: 'person-a', preacherId: luis },
    { date: '2026-11-20', title: 'Viernes', time: '19:30', directorId: 'person-a', preacherId: luis },
    { date: '2026-11-27', title: 'Viernes', time: '19:30', directorId: 'person-a' },
  ]
  const response = await call('editor', 'POST', '/api/service-batches', { month: '2026-11', directorIds: ['person-a'], entries })
  expect(response.status).toBe(201)
  const rows = await db.servicePreaching.findMany({ include: { service: { select: { date: true } } }, orderBy: { service: { date: 'asc' } } })
  expect(rows.map(row => [row.service.date.toISOString().slice(0, 10), row.preacherId, row.topic, row.notes])).toEqual([['2026-11-13', luis, '', ''], ['2026-11-20', luis, '', '']])
  expect((await json(await read('editor', rows[0].serviceId))).preacher).toEqual({ id: luis, name: 'Luis' })
})

test('a batch with preachers is all or nothing: another church\'s person, a removed one or a church without preaching reject it whole', async () => {
  const body = (preacherId: string) => ({ month: '2026-11', directorIds: ['person-a'], entries: [
    { date: '2026-11-13', title: 'Viernes', time: '19:30', directorId: 'person-a', preacherId },
    { date: '2026-11-20', title: 'Viernes', time: '19:30', directorId: 'person-a' },
  ] })
  expect((await call('editor', 'POST', '/api/service-batches', body('person-b'))).status).toBe(400)
  await db.churchPerson.update({ where: { churchId_personId: { churchId: 'church-a', personId: luis } }, data: { removedAt: new Date() } })
  expect((await call('editor', 'POST', '/api/service-batches', body(luis))).status).toBe(400)
  await db.churchPerson.update({ where: { churchId_personId: { churchId: 'church-a', personId: luis } }, data: { removedAt: null } })
  await db.church.update({ where: { id: 'church-a' }, data: { usesPreaching: false } })
  const refused = await call('editor', 'POST', '/api/service-batches', body(luis))
  expect([refused.status, await json(refused)]).toEqual([409, { error: 'Preaching disabled' }])
  expect(await db.service.count()).toBe(0)
  expect(await db.servicePreaching.count()).toBe(0)
  // Without preachers the batch behaves as before, with preaching on or off.
  const plain = { ...body(luis), entries: [{ date: '2026-11-13', title: 'Viernes', time: '19:30', directorId: 'person-a' }] }
  expect((await call('editor', 'POST', '/api/service-batches', plain)).status).toBe(201)
})
