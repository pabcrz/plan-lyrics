import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { createApp } from '../src/app.js'
import { connectDatabase } from '../src/database.ts'
import { nameKey } from '../src/people-rules.js'
import { seedFixtures } from './fixtures.ts'
import { sessionFixture } from './session-fixture.mjs'

const url = process.env.TEST_DATABASE_URL
if (!url || !/^postgresql:\/\/planlyrics_fixture@127\.0\.0\.1:\d+\/plan_lyrics_access_fixture$/.test(url)) throw new Error('Use pnpm test:db')
const db = connectDatabase(url)
const fixture = sessionFixture()
const api = createApp(fixture.config, db)
beforeAll(() => seedFixtures(db))
// Only fictitious songs: titles and authors are invented for these tests.
beforeEach(async () => {
  await db.setlistEntry.deleteMany()
  await db.service.deleteMany()
  await db.songLyrics.deleteMany()
  await db.song.deleteMany()
})
afterAll(() => db.$disconnect())

function call(subject: string | undefined, method: string, path: string, body?: unknown) {
  return api.request(path, {
    method,
    headers: { ...(subject ? { Authorization: `Bearer ${fixture.token(`fixture-${subject}`)}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}
const newService = (churchId = 'church-a', directorId = 'person-a', date = '2026-11-15') =>
  db.service.create({ data: { churchId, directorId, title: 'Servicio de ejemplo', date: new Date(`${date}T00:00:00Z`) } })
const newSong = (title: string, author: string) => db.song.create({ data: { title, author, titleKey: nameKey(title), authorKey: nameKey(author) } })
const base = (serviceId: string) => `/api/services/${serviceId}/setlist`
type Entry = { id: string; kind: string; song: { id: string; title: string; author: string } | null; moment: string | null; key: string | null; link: string | null }
type Setlist = { version: number; canEdit: boolean; canCreateSongs: boolean; entries: Entry[]; service: { id: string; title: string; date: string } }
const read = async (subject: string, serviceId: string) => (await (await call(subject, 'GET', base(serviceId))).json()) as Setlist
const labels = (setlist: Setlist) => setlist.entries.map(entry => entry.song?.title ?? entry.moment)

test('every member reads the library; search ignores case and accents and needs every word', async () => {
  await newSong('Canción de ejemplo', 'Autora Uno')
  await newSong('Canción de ejemplo', 'Autor Dos')
  await newSong('Himno ficticio', 'Autor Dos')
  const search = async (q: string) => (await (await call('member', 'GET', `/api/songs?q=${encodeURIComponent(q)}`)).json()) as Array<{ title: string; author: string }>
  expect(await search('')).toHaveLength(3)
  expect((await search('CANCION')).map(song => song.author)).toEqual(['Autor Dos', 'Autora Uno'])
  expect(await search('cancion dos')).toEqual([expect.objectContaining({ title: 'Canción de ejemplo', author: 'Autor Dos' })])
  expect(await search('100%')).toEqual([])
  expect((await call('member', 'GET', `/api/songs?q=${'x'.repeat(121)}`)).status).toBe(400)
  expect((await call(undefined, 'GET', '/api/songs')).status).toBe(401)
})

test('the owner, library editors and church administrators and editors create songs; a plain member never does', async () => {
  const song = { title: 'Canción de ejemplo', author: 'Autora Uno' }
  for (const subject of ['member']) expect((await call(subject, 'POST', '/api/songs', song)).status).toBe(403)
  expect(await db.song.count()).toBe(0)
  for (const [subject, canCreate] of [['member', false], ['editor', true], ['admin', true], ['combined', true]] as const) expect(await (await call(subject, 'GET', '/api/songs/access')).json()).toEqual({ canCreate })
  const created = await call('combined', 'POST', '/api/songs', { title: '  Canción  de ejemplo ', author: 'Autora Uno' })
  expect(created.status).toBe(201)
  expect(await created.json()).toEqual({ id: expect.any(String), title: 'Canción de ejemplo', author: 'Autora Uno' })
  // A library editor without a church has no active church, so the screen cannot reach the library either.
  expect((await call('library', 'POST', '/api/songs', { title: 'Otra', author: 'Autor' })).status).toBe(404)
})

test('the author is optional: a song without one is stored with an empty author and identified by its title alone', async () => {
  const created = await call('combined', 'POST', '/api/songs', { title: 'Sin autor' })
  expect(created.status).toBe(201)
  expect(await created.json()).toEqual({ id: expect.any(String), title: 'Sin autor', author: '' })
  expect((await call('combined', 'POST', '/api/songs', { title: 'sin  AUTOR', author: '   ' })).status).toBe(409)
  expect((await call('combined', 'POST', '/api/songs', { title: 'Sin autor', author: 'Alguien' })).status).toBe(201)
  expect(await db.song.count()).toBe(2)
})

test('identity is title + author: the same title with another author is a different song', async () => {
  const create = (title: string, author: string) => call('combined', 'POST', '/api/songs', { title, author })
  expect((await create('Canción de ejemplo', 'Autora Uno')).status).toBe(201)
  expect((await create('Canción de ejemplo', 'Autor Dos')).status).toBe(201)
  const repeated = await create('CANCIÓN DE EJEMPLO', ' autora  UNO ')
  expect(repeated.status).toBe(409)
  expect(await repeated.json()).toMatchObject({ error: 'Song exists', existing: { title: 'Canción de ejemplo', author: 'Autora Uno' } })
  expect(await db.song.count()).toBe(2)
  for (const bad of [{ author: 'Sin título' }, { title: '  ', author: 'Autor' }, { title: 'Título', author: 'Autor', lyrics: 'la la' }, { title: 'Título', author: 'Autor', churchId: 'church-b' }]) {
    expect((await call('combined', 'POST', '/api/songs', bad)).status).toBe(400)
  }
  expect(await db.song.count()).toBe(2)
})

test('whoever may edit the library renames or deletes a song, a plain member cannot; one in a setlist is never deleted', async () => {
  const [one, two] = [await newSong('Canción uno', 'Autora Uno'), await newSong('Canción dos', 'Autor Dos')]
  const service = await newService()
  expect((await call('member', 'PATCH', `/api/songs/${one.id}`, { title: 'Nuevo', author: 'Autor' })).status).toBe(403)
  expect((await call('member', 'DELETE', `/api/songs/${one.id}`)).status).toBe(403)
  const renamed = await call('combined', 'PATCH', `/api/songs/${one.id}`, { title: ' Canción  UNO ', author: 'Autora Uno Bis' })
  expect(renamed.status).toBe(200)
  expect(await renamed.json()).toEqual({ id: one.id, title: 'Canción UNO', author: 'Autora Uno Bis' })
  expect((await call('combined', 'PATCH', `/api/songs/${one.id}`, { title: 'Canción uno', author: 'Autora Uno Bis' })).status).toBe(200)
  const clash = await call('combined', 'PATCH', `/api/songs/${one.id}`, { title: 'canción DOS', author: 'autor dos' })
  expect(clash.status).toBe(409)
  expect(await clash.json()).toMatchObject({ error: 'Song exists', existing: { id: two.id } })
  expect((await call('combined', 'PATCH', `/api/songs/${one.id}`, { author: 'Sin título' })).status).toBe(400)
  expect((await call('combined', 'PATCH', '/api/songs/no-existe', { title: 'Tema', author: 'Autor' })).status).toBe(404)
  await call('editor', 'POST', `/api/services/${service.id}/setlist/entries`, { songId: one.id })
  const used = await call('combined', 'DELETE', `/api/songs/${one.id}`)
  expect(used.status).toBe(409)
  expect(await used.json()).toEqual({ error: 'Song in use' })
  expect((await call('combined', 'DELETE', `/api/songs/${two.id}`)).status).toBe(204)
  expect((await call('combined', 'DELETE', `/api/songs/${two.id}`)).status).toBe(404)
  expect(await db.song.count()).toBe(1)
})

test('an editor prepares the setlist; the order is saved on the server and a member only reads', async () => {
  const service = await newService()
  const [one, two] = [await newSong('Canción uno', 'Autora Uno'), await newSong('Canción dos', 'Autor Dos')]
  const empty = await read('member', service.id)
  expect(empty).toMatchObject({ entries: [], version: 0, canEdit: false, canCreateSongs: false, service: { id: service.id, title: 'Servicio de ejemplo', date: '2026-11-15' } })
  const added = await call('editor', 'POST', `${base(service.id)}/entries`, { songId: one.id, key: 'Bbm', link: 'https://youtu.be/ejemplo' })
  expect(added.status).toBe(201)
  expect((await added.json()).entries[0]).toMatchObject({ kind: 'SONG', song: { title: 'Canción uno' }, key: 'Bbm', link: 'https://youtu.be/ejemplo' })
  await call('admin', 'POST', `${base(service.id)}/entries`, { moment: ' Ofrenda ' })
  await call('editor', 'POST', `${base(service.id)}/entries`, { songId: two.id })
  const asMember = await read('member', service.id)
  expect(labels(asMember)).toEqual(['Canción uno', 'Ofrenda', 'Canción dos'])
  expect(asMember).toMatchObject({ version: 3, canEdit: false })
  expect((await read('editor', service.id)).canEdit).toBe(true)
  // The same order comes back for another reader: it lives in the database, not in the client.
  expect(await db.setlistEntry.findMany({ where: { serviceId: service.id }, orderBy: { position: 'asc' }, select: { position: true } })).toEqual([{ position: 0 }, { position: 1 }, { position: 2 }])
})

test('a member cannot change the setlist, even a library editor who only is a member', async () => {
  const service = await newService()
  const song = await newSong('Canción uno', 'Autora Uno')
  const entry = await db.setlistEntry.create({ data: { serviceId: service.id, position: 0, moment: 'Oración' } })
  for (const subject of ['member', 'combined']) {
    expect((await call(subject, 'POST', `${base(service.id)}/entries`, { songId: song.id })).status).toBe(403)
    expect((await call(subject, 'PATCH', `${base(service.id)}/entries/${entry.id}`, { moment: 'Otro' })).status).toBe(403)
    expect((await call(subject, 'DELETE', `${base(service.id)}/entries/${entry.id}`)).status).toBe(403)
    expect((await call(subject, 'PUT', `${base(service.id)}/order`, { version: 0, entryIds: [entry.id] })).status).toBe(403)
  }
  expect((await call(undefined, 'GET', base(service.id))).status).toBe(401)
  expect(await db.setlistEntry.count()).toBe(1)
})

test('the church comes from the session: another church cannot read or touch the setlist, nor name a church', async () => {
  const service = await newService()
  const song = await newSong('Canción uno', 'Autora Uno')
  const entry = await db.setlistEntry.create({ data: { serviceId: service.id, position: 0, moment: 'Oración' } })
  expect((await call('b-editor', 'GET', base(service.id))).status).toBe(404)
  expect((await call('b-editor', 'POST', `${base(service.id)}/entries`, { songId: song.id })).status).toBe(404)
  expect((await call('b-editor', 'PATCH', `${base(service.id)}/entries/${entry.id}`, { moment: 'Hackeado' })).status).toBe(404)
  expect((await call('b-editor', 'DELETE', `${base(service.id)}/entries/${entry.id}`)).status).toBe(404)
  expect((await call('b-editor', 'PUT', `${base(service.id)}/order`, { version: 0, entryIds: [entry.id] })).status).toBe(404)
  expect((await call('editor', 'POST', `${base(service.id)}/entries`, { songId: song.id, churchId: 'church-b' })).status).toBe(400)
  expect((await call('editor', 'GET', base('does-not-exist'))).status).toBe(404)
  // An entry of another church's service is not reachable through one's own service id either.
  const other = await newService('church-b', 'person-b')
  expect((await call('editor', 'DELETE', `${base(service.id)}/entries/${(await db.setlistEntry.create({ data: { serviceId: other.id, position: 0, moment: 'Ajena' } })).id}`)).status).toBe(404)
  expect(await db.setlistEntry.count()).toBe(2)
  expect(await db.setlistEntry.findUniqueOrThrow({ where: { id: entry.id } })).toMatchObject({ moment: 'Oración' })
})

test('a song appears once, a moment may repeat, and unknown songs or oversized setlists are rejected', async () => {
  const service = await newService()
  const song = await newSong('Canción uno', 'Autora Uno')
  const add = (body: unknown) => call('editor', 'POST', `${base(service.id)}/entries`, body)
  expect((await add({ songId: song.id })).status).toBe(201)
  const again = await add({ songId: song.id })
  expect(again.status).toBe(409)
  expect(await again.json()).toEqual({ error: 'Song already in setlist' })
  expect((await add({ moment: 'Oración' })).status).toBe(201)
  expect((await add({ moment: 'Oración' })).status).toBe(201)
  expect((await add({ songId: 'no-existe' })).status).toBe(400)
  expect((await add({ songId: song.id, moment: 'Oración' })).status).toBe(400)
  expect(await db.setlistEntry.count()).toBe(3)
  await db.setlistEntry.createMany({ data: Array.from({ length: 97 }, (_, index) => ({ serviceId: service.id, position: 3 + index, moment: `Momento ${index}` })) })
  const full = await add({ moment: 'Uno más' })
  expect(full.status).toBe(409)
  expect(await full.json()).toEqual({ error: 'Setlist full' })
})

test('adding at a position, removing and editing keep the order gapless', async () => {
  const service = await newService()
  const songs = [await newSong('Canción uno', 'A'), await newSong('Canción dos', 'B'), await newSong('Canción tres', 'C')]
  for (const song of songs.slice(0, 2)) await call('editor', 'POST', `${base(service.id)}/entries`, { songId: song.id })
  const inserted = await (await call('editor', 'POST', `${base(service.id)}/entries`, { songId: songs[2].id, position: 0 })).json() as Setlist
  expect(labels(inserted)).toEqual(['Canción tres', 'Canción uno', 'Canción dos'])
  const [first, second] = inserted.entries
  const edited = await (await call('editor', 'PATCH', `${base(service.id)}/entries/${second.id}`, { key: 'F#m', link: 'https://open.spotify.com/track/ejemplo' })).json() as Setlist
  expect(edited.entries[1]).toMatchObject({ key: 'F#m', link: 'https://open.spotify.com/track/ejemplo' })
  expect((await (await call('editor', 'PATCH', `${base(service.id)}/entries/${second.id}`, { link: '' })).json() as Setlist).entries[1].link).toBeNull()
  const removed = await (await call('editor', 'DELETE', `${base(service.id)}/entries/${first.id}`)).json() as Setlist
  expect(labels(removed)).toEqual(['Canción uno', 'Canción dos'])
  expect(removed.version).toBe(inserted.version + 1)
  expect((await db.setlistEntry.findMany({ where: { serviceId: service.id }, orderBy: { position: 'asc' }, select: { position: true } })).map(row => row.position)).toEqual([0, 1])
  expect((await call('editor', 'DELETE', `${base(service.id)}/entries/${first.id}`)).status).toBe(404)
  // Editing the entry does not touch the shared library.
  expect(await db.song.findUniqueOrThrow({ where: { id: songs[0].id } })).toMatchObject({ title: 'Canción uno', author: 'A' })
})

test('keys and links are validated on the server; a moment has neither', async () => {
  const service = await newService()
  const song = await newSong('Canción uno', 'Autora Uno')
  const added = await (await call('editor', 'POST', `${base(service.id)}/entries`, { songId: song.id })).json() as Setlist
  await call('editor', 'POST', `${base(service.id)}/entries`, { moment: 'Oración' })
  const [songEntry, moment] = (await read('editor', service.id)).entries
  expect(added.entries).toHaveLength(1)
  const patch = (id: string, body: unknown) => call('editor', 'PATCH', `${base(service.id)}/entries/${id}`, body)
  for (const bad of [{ key: 'H' }, { key: 'g' }, { link: 'https://evil.example/youtube.com' }, { link: 'javascript:alert(1)' }, {}, { moment: 'Renombrar canción' }]) {
    expect((await patch(songEntry.id, bad)).status).toBe(400)
  }
  for (const bad of [{ key: 'G' }, { link: 'https://youtu.be/x' }]) expect((await patch(moment.id, bad)).status).toBe(400)
  expect((await patch(moment.id, { moment: ' Ofrenda ' })).status).toBe(200)
  expect((await read('editor', service.id)).entries[1].moment).toBe('Ofrenda')
  expect((await call('editor', 'POST', `${base(service.id)}/entries`, { songId: 'x', key: 'G' })).status).toBe(400)
})

test('a reorder is atomic and needs the current version and exactly the same entries', async () => {
  const service = await newService()
  for (const name of ['Uno', 'Dos', 'Tres']) await call('editor', 'POST', `${base(service.id)}/entries`, { moment: name })
  const before = await read('editor', service.id)
  const [a, b, c] = before.entries.map(entry => entry.id)
  const reorder = (body: unknown) => call('editor', 'PUT', `${base(service.id)}/order`, body)
  const moved = await reorder({ version: before.version, entryIds: [c, a, b] })
  expect(moved.status).toBe(200)
  const after = await moved.json() as Setlist
  expect(labels(after)).toEqual(['Tres', 'Uno', 'Dos'])
  expect(after.version).toBe(before.version + 1)
  // The stale version is rejected and the setlist is not touched.
  const old = await reorder({ version: before.version, entryIds: [b, c, a] })
  expect(old.status).toBe(409)
  expect(await old.json()).toEqual({ error: 'Setlist changed', version: after.version })
  // A missing, extra or foreign entry is rejected too, even with the right version.
  for (const ids of [[a, b], [a, b, c, 'extra'], [a, b, 'ajena'], [a, a, b]]) expect((await reorder({ version: after.version, entryIds: ids })).status).toBeOneOf([400, 409])
  expect(labels(await read('member', service.id))).toEqual(['Tres', 'Uno', 'Dos'])
  // The same order is a no-op: no new version.
  const same = await (await reorder({ version: after.version, entryIds: after.entries.map(entry => entry.id) })).json() as Setlist
  expect(same.version).toBe(after.version)
  expect((await reorder({ entryIds: [a, b, c] })).status).toBe(400)
})

test('concurrent changes: one of two reorders with the same version wins; concurrent adds both land in order', async () => {
  const service = await newService()
  for (const name of ['Uno', 'Dos', 'Tres']) await call('editor', 'POST', `${base(service.id)}/entries`, { moment: name })
  const { version, entries } = await read('editor', service.id)
  const [a, b, c] = entries.map(entry => entry.id)
  const results = await Promise.all([
    call('editor', 'PUT', `${base(service.id)}/order`, { version, entryIds: [c, b, a] }),
    call('admin', 'PUT', `${base(service.id)}/order`, { version, entryIds: [b, a, c] }),
  ])
  expect(results.map(result => result.status).sort()).toEqual([200, 409])
  const winner = labels(await read('member', service.id))
  expect([['Tres', 'Dos', 'Uno'], ['Dos', 'Uno', 'Tres']]).toContainEqual(winner)
  const adds = await Promise.all(Array.from({ length: 6 }, (_, index) => call(index % 2 ? 'editor' : 'admin', 'POST', `${base(service.id)}/entries`, { moment: `Nuevo ${index}` })))
  expect(adds.map(result => result.status)).toEqual([201, 201, 201, 201, 201, 201])
  const rows = await db.setlistEntry.findMany({ where: { serviceId: service.id }, orderBy: { position: 'asc' }, select: { position: true } })
  expect(rows.map(row => row.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
})

test('the database refuses an entry that is both a song and a moment, or a moment with a key', async () => {
  const service = await newService()
  const song = await newSong('Canción uno', 'Autora Uno')
  await expect(db.setlistEntry.create({ data: { serviceId: service.id, position: 0, songId: song.id, moment: 'Oración' } })).rejects.toThrow()
  await expect(db.setlistEntry.create({ data: { serviceId: service.id, position: 0, moment: 'Oración', key: 'G' } })).rejects.toThrow()
  await expect(db.setlistEntry.create({ data: { serviceId: service.id, position: 0 } })).rejects.toThrow()
  // A song that a setlist uses cannot be deleted from the library.
  await db.setlistEntry.create({ data: { serviceId: service.id, position: 0, songId: song.id } })
  await expect(db.song.delete({ where: { id: song.id } })).rejects.toThrow()
})

// Wednesday 25 Nov 2026, 20:00 in Mexico City: a service of this same day already counts as used, whatever its hour.
const datedApp = createApp(fixture.config, db, () => new Date('2026-11-26T02:00:00Z'))
const asMember = (path: string, subject = 'member', method = 'GET', body?: unknown) => datedApp.request(path, {
  method, headers: { Authorization: `Bearer ${fixture.token(`fixture-${subject}`)}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body),
})
const song = (title: string) => db.song.create({ data: { title, author: 'Autora Uno', titleKey: nameKey(title), authorKey: nameKey(title) } })
const service = (id: string, churchId: string, directorId: string, date: string, status: 'PUBLISHED' | 'CANCELLED' | 'DRAFT' = 'PUBLISHED') =>
  db.service.create({ data: { id, churchId, title: id, date: new Date(`${date}T00:00:00Z`), slot: 'SINGLE', status, directorId } })
const add = (serviceId: string, songId: string, position = 0) => db.setlistEntry.create({ data: { serviceId, songId, position } })

test('the library says when and how often this church sang each song, by service date, ignoring cancelled services and other churches', async () => {
  const [a, b, c] = await Promise.all([song('Cántico uno ficticio'), song('Cántico dos ficticio'), song('Cántico tres ficticio')])
  await service('uso-viejo', 'church-a', 'person-a', '2026-11-08')
  await service('uso-hoy', 'church-a', 'person-a', '2026-11-25', 'DRAFT')
  await service('uso-futuro', 'church-a', 'person-a', '2026-12-06')
  await service('uso-cancelado', 'church-a', 'person-a', '2026-11-22', 'CANCELLED')
  await service('uso-otra-iglesia', 'church-b', 'person-b', '2026-11-22')
  await add('uso-viejo', a.id)
  await add('uso-hoy', a.id)
  await add('uso-futuro', a.id)
  await add('uso-cancelado', b.id)
  await add('uso-otra-iglesia', b.id)
  await add('uso-futuro', c.id, 1)
  const rows = (await (await asMember('/api/songs?q=cantico')).json()) as Array<{ title: string; lastUsed: string | null; uses: number }>
  expect(Object.fromEntries(rows.map(row => [row.title, [row.lastUsed, row.uses]]))).toEqual({ 'Cántico uno ficticio': ['2026-11-25', 2], 'Cántico dos ficticio': [null, 0], 'Cántico tres ficticio': [null, 0] })
  // Ordered by use, either way; ties by title.
  const order = async (dir: string) => ((await (await asMember(`/api/songs?q=cantico&sort=uses&dir=${dir}`)).json()) as Array<{ title: string }>).map(row => row.title)
  expect(await order('desc')).toEqual(['Cántico uno ficticio', 'Cántico dos ficticio', 'Cántico tres ficticio'])
  expect(await order('asc')).toEqual(['Cántico dos ficticio', 'Cántico tres ficticio', 'Cántico uno ficticio'])
  expect(((await (await asMember('/api/songs?q=cantico&dir=desc')).json()) as Array<{ title: string }>).map(row => row.title)).toEqual(['Cántico uno ficticio', 'Cántico tres ficticio', 'Cántico dos ficticio'])
})

test('with the strict rule on, the picker marks what the service cannot take and the API refuses it', async () => {
  const [a, b] = await Promise.all([song('Cántico uno ficticio'), song('Cántico dos ficticio')])
  // Fridays 6, 13 and 20 Nov and Sundays 8 and 15 Nov, one service each; the song A was sung on Friday 6.
  const dates = [['f6', '2026-11-06'], ['s8', '2026-11-08'], ['f13', '2026-11-13'], ['s15', '2026-11-15'], ['f20', '2026-11-20']] as const
  for (const [id, date] of dates) await service(id, 'church-a', 'person-a', date)
  await add('f6', a.id)
  const blockedFor = async (serviceId: string) => ((await (await asMember(`/api/songs?q=cantico&serviceId=${serviceId}`)).json()) as Array<{ title: string; blockedBy?: string | null }>)
    .filter(row => row.blockedBy).map(row => `${row.title}:${row.blockedBy}`)
  // Rule off: nothing is blocked and the API accepts it.
  expect(await blockedFor('s8')).toEqual([])
  expect((await asMember('/api/services/s8/setlist/entries', 'editor', 'POST', { songId: a.id })).status).toBe(201)
  await db.setlistEntry.deleteMany({ where: { serviceId: 's8' } })

  await db.church.update({ where: { id: 'church-a' }, data: { songRepeatUnit: 'SERVICES', songRepeatAmount: 2 } })
  expect(await blockedFor('s8')).toEqual(['Cántico uno ficticio:2026-11-06'])
  expect(await blockedFor('f13')).toEqual(['Cántico uno ficticio:2026-11-06'])
  expect(await blockedFor('s15')).toEqual([])
  const refused = await asMember('/api/services/f13/setlist/entries', 'editor', 'POST', { songId: a.id })
  expect(refused.status).toBe(409)
  expect(await refused.json()).toEqual({ error: 'Song repeat rule' })
  expect((await asMember('/api/services/f13/setlist/entries', 'editor', 'POST', { songId: b.id })).status).toBe(201)
  expect((await asMember('/api/services/s15/setlist/entries', 'editor', 'POST', { songId: a.id })).status).toBe(201)

  // By weeks (a calendar rule, whatever the number of services): 2 weeks after Friday 6 Nov is Friday 20.
  await db.setlistEntry.deleteMany({ where: { serviceId: { in: ['s15', 'f13'] } } })
  await db.church.update({ where: { id: 'church-a' }, data: { songRepeatUnit: 'WEEKS', songRepeatAmount: 2 } })
  expect(await blockedFor('s15')).toEqual(['Cántico uno ficticio:2026-11-06'])
  expect(await blockedFor('f20')).toEqual([])
  await db.church.update({ where: { id: 'church-a' }, data: { songRepeatUnit: null, songRepeatAmount: null } })
})

test('an administrator turns the rule on and off from the church settings', async () => {
  const current = (await (await asMember('/api/active-church', 'admin')).json()) as { name: string; sundayDouble: boolean; usesPreaching: boolean; days: unknown[]; songRepeat: unknown }
  expect(current.songRepeat).toBeNull()
  const body = { name: current.name, sundayDouble: current.sundayDouble, usesPreaching: current.usesPreaching, days: current.days }
  const saved = await asMember('/api/active-church', 'admin', 'PUT', { ...body, songRepeat: { unit: 'WEEKS', amount: 3 } })
  expect(saved.status).toBe(200)
  expect((await saved.json() as { songRepeat: unknown }).songRepeat).toEqual({ unit: 'WEEKS', amount: 3 })
  expect((await asMember('/api/active-church', 'admin', 'PUT', { ...body, songRepeat: { unit: 'DAYS', amount: 3 } })).status).toBe(400)
  expect((await asMember('/api/active-church', 'admin', 'PUT', { ...body, songRepeat: { unit: 'WEEKS', amount: 0 } })).status).toBe(400)
  // Left out, it stays; null turns it off.
  expect((await (await asMember('/api/active-church', 'admin', 'PUT', body)).json() as { songRepeat: unknown }).songRepeat).toEqual({ unit: 'WEEKS', amount: 3 })
  expect((await (await asMember('/api/active-church', 'admin', 'PUT', { ...body, songRepeat: null })).json() as { songRepeat: unknown }).songRepeat).toBeNull()
})
