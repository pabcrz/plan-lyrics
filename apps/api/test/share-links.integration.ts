import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { createApp } from '../src/app.js'
import { connectDatabase } from '../src/database.ts'
import { nameKey } from '../src/people-rules.js'
import { createLimiter } from '../src/rate-limit.js'
import { seedFixtures } from './fixtures.ts'
import { sessionFixture } from './session-fixture.mjs'

const url = process.env.TEST_DATABASE_URL
if (!url || !/^postgresql:\/\/planlyrics_fixture@127\.0\.0\.1:\d+\/plan_lyrics_access_fixture$/.test(url)) throw new Error('Use pnpm test:db')
const db = connectDatabase(url)
const fixture = sessionFixture()
// Thursday 12 Nov 2026, 12:00 in Mexico City.
let clock = new Date('2026-11-12T18:00:00Z')
const secret = 'fixture-share-secret-fixture-share-secret'
const api = createApp(fixture.config, db, () => clock, { shareSecret: secret, publicLimiter: createLimiter({ limit: 10_000, windowMs: 60_000 }) })
const luis = 'p-share-luis'

beforeAll(async () => {
  await seedFixtures(db)
  await db.person.upsert({ where: { id: luis }, update: {}, create: { id: luis, name: 'Luis Ficticio', churches: { create: { churchId: 'church-a' } } } })
})
const reset = async () => {
  clock = new Date('2026-11-12T18:00:00Z')
  await db.shareLink.deleteMany()
  await db.service.deleteMany()
  await db.closedDate.deleteMany()
  await db.song.deleteMany()
  await db.church.update({ where: { id: 'church-a' }, data: { usesPreaching: true } })
}
beforeEach(reset)
afterAll(async () => {
  await reset()
  await db.church.update({ where: { id: 'church-a' }, data: { usesPreaching: false } })
  await db.person.deleteMany({ where: { id: luis } })
  await db.$disconnect()
})

function call(subject: string | undefined, method: string, path: string, body?: unknown, app = api) {
  return app.request(path, {
    method,
    headers: { ...(subject ? { Authorization: `Bearer ${fixture.token(`fixture-${subject}`)}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}
const json = async <T = any>(response: Response) => (await response.json()) as T // eslint-disable-line @typescript-eslint/no-explicit-any
const at = (date: string) => new Date(`${date}T00:00:00Z`)
const service = (date: string, over: Record<string, unknown> = {}) =>
  db.service.create({ data: { churchId: 'church-a', directorId: 'person-a', title: 'Servicio ficticio', date: at(date), time: '19:30', ...over } })
const song = (title: string, author: string) => db.song.create({ data: { title, author, titleKey: nameKey(title), authorKey: nameKey(author) } })
const range = { kind: 'range', from: '2026-11-01', to: '2026-11-30' }
const create = (subject: string | undefined, over: Record<string, unknown> = {}) => call(subject, 'POST', '/api/share-links', { version: 'FULL', scope: range, ...over })
const open = (path: string) => call(undefined, 'GET', `/api/public${path.replace('/m/', '/links/')}`)
const tokenOf = (path: string) => path.slice('/m/'.length)

// The setlist has a song with a link and a key, a moment, and the service has a full preaching section.
async function fullService(date = '2026-11-13') {
  const created = await service(date)
  const [one, other] = [await song('Canción ficticia uno', 'Autora Uno'), await song('Canción ficticia dos', 'Autor Dos')]
  await db.setlistEntry.createMany({ data: [
    { serviceId: created.id, position: 0, songId: one.id, key: 'G', link: 'https://www.youtube.com/watch?v=ficticio' },
    { serviceId: created.id, position: 1, moment: 'Ofrenda' },
    { serviceId: created.id, position: 2, songId: other.id, key: 'Bbm' },
  ] })
  await db.servicePreaching.create({ data: { serviceId: created.id, churchId: 'church-a', preacherId: luis, topic: 'La fe', passages: ['Hebreos 11:1'], notes: '- Nota interna **uno**' } })
  return created
}

test('only whoever administers or edits services creates and lists links; members and anonymous cannot', async () => {
  await service('2026-11-13')
  expect((await create(undefined)).status).toBe(401)
  expect((await call(undefined, 'GET', '/api/share-links')).status).toBe(401)
  for (const subject of ['member', 'combined', 'library', 'accounts']) {
    expect((await create(subject)).status).toBe(subject === 'member' || subject === 'combined' ? 403 : 404)
    expect((await call(subject, 'GET', '/api/share-links')).status).toBe(subject === 'member' || subject === 'combined' ? 403 : 404)
  }
  expect(await db.shareLink.count()).toBe(0)
  for (const subject of ['editor', 'admin']) {
    const response = await create(subject)
    expect(response.status).toBe(201)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  }
  expect((await json(await call('editor', 'GET', '/api/share-links'))).length).toBe(2)
})

test('a link for a range is valid until 30 days after the last service it covers and stores no token', async () => {
  await service('2026-11-13')
  await service('2026-11-27')
  await service('2026-12-04')
  const response = await create('editor')
  const link = await json(response)
  expect(link).toEqual({
    id: expect.any(String), version: 'FULL', scope: { kind: 'range', from: '2026-11-01', to: '2026-11-30' },
    blocks: { keys: false, notes: false, people: true }, status: 'ACTIVE', activeUntil: '2026-12-27', reactivated: false, canReactivate: false,
    createdAt: expect.any(String), path: expect.stringMatching(/^\/m\/[A-Za-z0-9_-]{43}$/),
  })
  // The database holds the nonce and the hash, never the token itself.
  const stored = JSON.stringify(await db.shareLink.findMany())
  expect(stored).not.toContain(tokenOf(link.path))
  expect(await db.shareLink.findFirst({ where: { tokenHash: { not: '' } } })).toMatchObject({ churchId: 'church-a', tokenHash: expect.stringMatching(/^[0-9a-f]{64}$/) })
  // Whoever manages links can copy the same link again.
  expect((await json(await call('admin', 'GET', '/api/share-links')))[0].path).toBe(link.path)
})

test('a link for one service covers only that service and lasts 30 days after it', async () => {
  const first = await service('2026-11-13')
  await service('2026-11-20')
  const link = await json(await create('editor', { version: 'PRAISE', scope: { kind: 'service', serviceId: first.id } }))
  expect(link.scope).toEqual({ kind: 'service', serviceId: first.id, date: '2026-11-13' })
  expect(link.activeUntil).toBe('2026-12-13')
  const view = await json(await open(link.path))
  expect(view.services.map((item: { date: string }) => item.date)).toEqual(['2026-11-13'])
})

test('the request is validated in the server: no church, no unknown fields, no blocks the version cannot show', async () => {
  await service('2026-11-13')
  const before = await db.shareLink.count()
  for (const over of [
    { churchId: 'church-b' }, { token: 'abc' }, { version: 'ALL' }, { version: 'PRAISE', blocks: { notes: true } }, { version: 'PREACHING', blocks: { keys: true } },
    { scope: { kind: 'range', from: '2026-11-30', to: '2026-11-01' } }, { scope: { kind: 'range', from: '2026-01-01', to: '2028-01-01' } }, { scope: { kind: 'service' } },
  ]) expect((await create('editor', over)).status, JSON.stringify(over)).toBe(400)
  expect((await call('editor', 'POST', '/api/share-links', 'no json')).status).toBe(400)
  expect(await db.shareLink.count()).toBe(before)
})

test('a range without services, a service of another church and a scope already over are refused', async () => {
  expect(await json(await create('editor'))).toEqual({ error: 'No services in scope' })
  const other = await db.service.create({ data: { churchId: 'church-b', directorId: 'person-b', title: 'Otra iglesia', date: at('2026-11-13') } })
  expect((await create('editor', { scope: { kind: 'service', serviceId: other.id } })).status).toBe(404)
  // The only service of church A is of church B's date range: it does not count for A.
  expect((await create('editor')).status).toBe(409)
  await service('2026-09-01')
  expect(await json(await create('editor', { scope: { kind: 'range', from: '2026-09-01', to: '2026-09-30' } }))).toEqual({ error: 'Scope in the past' })
  const cancelled = await service('2026-11-14', { status: 'CANCELLED' })
  expect((await create('editor', { scope: { kind: 'service', serviceId: cancelled.id } })).status).toBe(404)
  expect(await db.shareLink.count()).toBe(0)
})

test('the praise version shows dates, director and setlist; tones only when asked; never links, notes or ids', async () => {
  await fullService()
  const plain = await json(await open((await json(await create('editor', { version: 'PRAISE' }))).path))
  expect(plain).toEqual({
    version: 'PRAISE', church: 'Fixture Church A', activeUntil: '2026-12-13', blocks: { keys: false, notes: false, people: true }, closedDates: [],
    services: [{
      date: '2026-11-13', slot: 'SINGLE', director: 'Director person-a',
      setlist: [
        { kind: 'SONG', title: 'Canción ficticia uno', author: 'Autora Uno' }, { kind: 'MOMENT', name: 'Ofrenda' }, { kind: 'SONG', title: 'Canción ficticia dos', author: 'Autor Dos' },
      ],
    }],
  })
  const raw = JSON.stringify(plain)
  for (const leaked of ['youtube', 'La fe', 'Nota interna', 'Luis Ficticio', 'church-a', '19:30']) expect(raw).not.toContain(leaked)
  const withKeys = await json(await open((await json(await create('editor', { version: 'PRAISE', blocks: { keys: true } }))).path))
  expect(withKeys.services[0].setlist.map((entry: { key?: string | null }) => entry.key)).toEqual(['G', undefined, 'Bbm'])
  const anonymous = await json(await open((await json(await create('editor', { version: 'PRAISE', blocks: { people: false } }))).path))
  expect(anonymous.services[0]).not.toHaveProperty('director')
})

test('the preaching version shows the preacher, topic and passages; notes only when the block is on', async () => {
  await fullService()
  const plain = await json(await open((await json(await create('editor', { version: 'PREACHING' }))).path))
  expect(plain.services).toEqual([{ date: '2026-11-13', slot: 'SINGLE', preaching: { topic: 'La fe', passages: ['Hebreos 11:1'], preacher: 'Luis Ficticio' } }])
  expect(JSON.stringify(plain)).not.toMatch(/Nota interna|Director person-a|Canción|Ofrenda/)
  const notes = await json(await open((await json(await create('editor', { version: 'PREACHING', blocks: { notes: true, people: false } }))).path))
  expect(notes.services[0].preaching).toEqual({ topic: 'La fe', passages: ['Hebreos 11:1'], notes: '- Nota interna **uno**' })
})

test('the full version adds the time, with the setlist in order, and notes still depend on their block', async () => {
  await fullService()
  const view = await json(await open((await json(await create('editor', { blocks: { keys: true } }))).path))
  expect(view.services[0]).toMatchObject({ date: '2026-11-13', time: '19:30', director: 'Director person-a', preaching: { topic: 'La fe', preacher: 'Luis Ficticio' } })
  expect(view.services[0].preaching).not.toHaveProperty('notes')
  expect(view.services[0].setlist.map((entry: { title?: string; name?: string }) => entry.title ?? entry.name)).toEqual(['Canción ficticia uno', 'Ofrenda', 'Canción ficticia dos'])
  const withNotes = await json(await open((await json(await create('editor', { blocks: { notes: true } }))).path))
  expect(withNotes.services[0].preaching.notes).toBe('- Nota interna **uno**')
})

test('with preaching switched off nothing of it is asked for or shown, and the data is kept', async () => {
  await fullService()
  const link = await json(await create('editor', { blocks: { notes: true } }))
  await db.church.update({ where: { id: 'church-a' }, data: { usesPreaching: false } })
  const view = await json(await open(link.path))
  expect(view.blocks.notes).toBe(false)
  expect(JSON.stringify(view)).not.toMatch(/La fe|Nota interna|Luis Ficticio/)
  expect(await json(await create('editor', { version: 'PREACHING' }))).toEqual({ error: 'Preaching disabled' })
  expect(await json(await create('editor', { blocks: { notes: true } }))).toEqual({ error: 'Preaching disabled' })
  expect((await create('editor')).status).toBe(201)
  expect(await db.servicePreaching.count()).toBe(1)
})

test('«No hay culto» appears in a range link; cancelled services never do', async () => {
  await service('2026-11-13')
  await service('2026-11-20', { status: 'CANCELLED' })
  await db.closedDate.create({ data: { churchId: 'church-a', date: at('2026-11-25'), reason: 'Feriado' } })
  await db.closedDate.create({ data: { churchId: 'church-b', date: at('2026-11-26'), reason: 'De otra iglesia' } })
  const view = await json(await open((await json(await create('editor', { version: 'PRAISE' }))).path))
  expect(view.services.map((item: { date: string }) => item.date)).toEqual(['2026-11-13'])
  expect(view.closedDates).toEqual([{ date: '2026-11-25', reason: 'Feriado' }])
})

test('churches are isolated: a link only ever shows its own church', async () => {
  await service('2026-11-13')
  await db.service.create({ data: { churchId: 'church-b', directorId: 'person-b', title: 'Secreto de B', date: at('2026-11-14') } })
  const a = await json(await create('editor'))
  const b = await json(await call('b-editor', 'POST', '/api/share-links', { version: 'FULL', scope: range }))
  const viewA = await json(await open(a.path))
  const viewB = await json(await open(b.path))
  expect(viewA.church).toBe('Fixture Church A')
  expect(viewA.services.map((item: { date: string }) => item.date)).toEqual(['2026-11-13'])
  expect(viewB.church).toBe('Fixture Church B')
  expect(viewB.services.map((item: { date: string }) => item.date)).toEqual(['2026-11-14'])
  expect(JSON.stringify(viewA)).not.toMatch(/Secreto|Director person-b/)
  // Listing, revoking and reactivating are scoped to the caller's church.
  expect((await json(await call('b-editor', 'GET', '/api/share-links'))).map((item: { id: string }) => item.id)).toEqual([b.id])
  expect((await call('b-editor', 'POST', `/api/share-links/${a.id}/revoke`)).status).toBe(404)
  expect((await call('b-editor', 'POST', `/api/share-links/${a.id}/reactivate`)).status).toBe(404)
  expect((await db.shareLink.findUniqueOrThrow({ where: { id: a.id } })).revokedAt).toBeNull()
  // The database itself refuses a link that points at another church's service.
  const foreign = await db.service.findFirstOrThrow({ where: { churchId: 'church-b' } })
  await expect(db.shareLink.create({ data: {
    churchId: 'church-a', serviceId: foreign.id, nonce: 'n', tokenHash: 'h-foreign', version: 'PRAISE', fromDate: at('2026-11-14'), toDate: at('2026-11-14'), activeUntil: at('2026-12-14'),
  } })).rejects.toThrow()
})

test('a missing, malformed, expired or revoked token answers the same 404, private and not indexable', async () => {
  await service('2026-11-13')
  const live = await json(await create('editor'))
  const revoked = await json(await create('editor'))
  await call('editor', 'POST', `/api/share-links/${revoked.id}/revoke`)
  const expired = await json(await create('editor'))
  await db.shareLink.update({ where: { id: expired.id }, data: { activeUntil: at('2026-11-11') } })
  const guesses = [`/api/public/links/${'a'.repeat(43)}`, '/api/public/links/short', `/api/public/links/${'a'.repeat(44)}`, `/api/public/links/${tokenOf(revoked.path)}`, `/api/public/links/${tokenOf(expired.path)}`]
  const answers = await Promise.all(guesses.map(path => call(undefined, 'GET', path)))
  for (const answer of answers) {
    expect(answer.status).toBe(404)
    expect(await json(answer)).toEqual({ error: 'Not found' })
  }
  const ok = await open(live.path)
  for (const response of [ok, ...answers]) {
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow, noarchive')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')
  }
  expect(ok.status).toBe(200)
})

test('a link answers through its last day and stops the day after', async () => {
  await service('2026-11-13')
  const link = await json(await create('editor'))
  expect(link.activeUntil).toBe('2026-12-13')
  clock = new Date('2026-12-14T05:59:00Z')
  expect((await open(link.path)).status).toBe(200)
  // Midnight in Mexico City (UTC-6): it is already the 14th there.
  clock = new Date('2026-12-14T06:00:00Z')
  expect((await open(link.path)).status).toBe(404)
  const [listed] = await json(await call('editor', 'GET', '/api/share-links'))
  expect(listed).toMatchObject({ status: 'EXPIRED', path: null, canReactivate: true })
})

test('revoking is immediate, needs edit rights and cannot be repeated', async () => {
  await service('2026-11-13')
  const link = await json(await create('editor'))
  expect((await call(undefined, 'POST', `/api/share-links/${link.id}/revoke`)).status).toBe(401)
  expect((await call('member', 'POST', `/api/share-links/${link.id}/revoke`)).status).toBe(403)
  expect((await open(link.path)).status).toBe(200)
  const revoked = await call('admin', 'POST', `/api/share-links/${link.id}/revoke`)
  expect(revoked.status).toBe(200)
  expect(await json(revoked)).toMatchObject({ id: link.id, status: 'REVOKED', path: null, canReactivate: true })
  expect((await open(link.path)).status).toBe(404)
  expect(await json(await call('editor', 'POST', `/api/share-links/${link.id}/revoke`))).toEqual({ error: 'Link inactive' })
  expect((await call('editor', 'POST', '/api/share-links/missing/revoke')).status).toBe(404)
})

test('a deactivated link is reactivated once for 30 more days from today, read only', async () => {
  await service('2026-11-13')
  const link = await json(await create('editor'))
  expect(await json(await call('editor', 'POST', `/api/share-links/${link.id}/reactivate`))).toEqual({ error: 'Link active' })
  expect((await call('member', 'POST', `/api/share-links/${link.id}/reactivate`)).status).toBe(403)
  clock = new Date('2027-01-10T18:00:00Z')
  expect((await open(link.path)).status).toBe(404)
  const again = await call('editor', 'POST', `/api/share-links/${link.id}/reactivate`)
  expect(again.status).toBe(200)
  expect(await json(again)).toMatchObject({ id: link.id, status: 'ACTIVE', activeUntil: '2027-02-09', reactivated: true, canReactivate: false, path: link.path })
  // Same address as before: nobody has to be sent a new one.
  expect((await open(link.path)).status).toBe(200)
  // It cannot be reactivated again, expired or revoked (the strictest reading of the open decision).
  await call('editor', 'POST', `/api/share-links/${link.id}/revoke`)
  expect(await json(await call('editor', 'POST', `/api/share-links/${link.id}/reactivate`))).toEqual({ error: 'Reactivation used' })
  expect((await open(link.path)).status).toBe(404)
})

test('a revoked link that is still in date can be reactivated too', async () => {
  await service('2026-11-13')
  const link = await json(await create('editor'))
  await call('editor', 'POST', `/api/share-links/${link.id}/revoke`)
  const back = await json(await call('editor', 'POST', `/api/share-links/${link.id}/reactivate`))
  expect(back).toMatchObject({ status: 'ACTIVE', activeUntil: '2026-12-12', reactivated: true })
  expect((await open(back.path)).status).toBe(200)
})

test('two people reactivating at once: exactly one succeeds', async () => {
  await service('2026-11-13')
  const link = await json(await create('editor'))
  await call('editor', 'POST', `/api/share-links/${link.id}/revoke`)
  const results = await Promise.all([call('editor', 'POST', `/api/share-links/${link.id}/reactivate`), call('admin', 'POST', `/api/share-links/${link.id}/reactivate`)])
  expect(results.map(result => result.status).sort()).toEqual([200, 409])
})

test('the public view is throttled per address', async () => {
  const limited = createApp(fixture.config, db, () => clock, { shareSecret: secret, publicLimiter: createLimiter({ limit: 2, windowMs: 60_000 }) })
  const statuses: number[] = []
  for (let index = 0; index < 4; index += 1) statuses.push((await call(undefined, 'GET', `/api/public/links/${'a'.repeat(43)}`, undefined, limited)).status)
  expect(statuses).toEqual([404, 404, 429, 429])
  const blocked = await call(undefined, 'GET', `/api/public/links/${'a'.repeat(43)}`, undefined, limited)
  expect(blocked.headers.get('Retry-After')).toBe('60')
  expect(blocked.headers.get('X-Robots-Tag')).toBe('noindex, nofollow, noarchive')
})

test('without the server secret links cannot be created, but existing ones can still be revoked', async () => {
  await service('2026-11-13')
  const link = await json(await create('editor'))
  const bare = createApp(fixture.config, db, () => clock)
  expect(await json(await call('editor', 'POST', '/api/share-links', { version: 'FULL', scope: range }, bare))).toEqual({ error: 'Sharing unavailable' })
  expect((await json(await call('editor', 'GET', '/api/share-links', undefined, bare)))[0].path).toBeNull()
  expect((await call('editor', 'POST', `/api/share-links/${link.id}/revoke`, undefined, bare)).status).toBe(200)
  expect((await open(link.path)).status).toBe(404)
})

test('deleting a service removes the link of that service only', async () => {
  const first = await service('2026-11-13')
  await service('2026-11-20')
  await create('editor', { scope: { kind: 'service', serviceId: first.id } })
  await create('editor')
  await db.service.delete({ where: { id: first.id } })
  expect(await db.shareLink.count()).toBe(1)
})
