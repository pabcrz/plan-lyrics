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
const clock = new Date('2026-11-12T18:00:00Z')
const api = createApp(fixture.config, db, () => clock, { shareSecret: 'fixture-share-secret-fixture-share-secret', publicLimiter: createLimiter({ limit: 10_000, windowMs: 60_000 }) })

// Only invented songs and texts: no real lyrics ever enter this repository.
const reset = async () => {
  await db.shareLink.deleteMany()
  await db.service.deleteMany()
  await db.songLyrics.deleteMany()
  await db.song.deleteMany()
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
const json = async <T = any>(response: Response) => (await response.json()) as T // eslint-disable-line @typescript-eslint/no-explicit-any
const newSong = (title = 'Canción ficticia uno', author = 'Autora Uno') => db.song.create({ data: { title, author, titleKey: nameKey(title), authorKey: nameKey(author) } })
const path = (songId: string) => `/api/songs/${songId}/lyrics`
const verse = (text = 'Primera línea inventada\nSegunda línea inventada') => ({ kind: 'VERSE', text })
const chorus = (text = 'Coro inventado', repeat = 1) => ({ kind: 'CHORUS', text, repeat })
const put = (subject: string | undefined, songId: string, body: unknown) => call(subject, 'PUT', path(songId), body)
type Lyrics = { version: number; published: boolean; key: string | null; canEdit: boolean; sections: Array<{ kind: string; label: string | null; text: string; chordPro: string | null; repeat: number }> }
const read = async (subject: string, songId: string) => json<Lyrics>(await call(subject, 'GET', path(songId)))

test('everyone who sees the library reads the lyrics, the internal data included, and an empty song answers an empty lyrics', async () => {
  const song = await newSong()
  for (const subject of ['member', 'editor', 'admin', 'library', 'owner', 'multi']) {
    const response = await call(subject, 'GET', path(song.id))
    expect(response.status, subject).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await json(response)).toEqual({ version: 0, published: false, key: null, canEdit: ['library', 'owner'].includes(subject), sections: [] })
  }
  await put('library', song.id, { version: 0, sections: [verse(), chorus()] })
  expect((await read('member', song.id)).sections.map(section => section.kind)).toEqual(['VERSE', 'CHORUS'])
})

test('without a session, without any access, or for a song that does not exist, nothing is read', async () => {
  const song = await newSong()
  expect((await call(undefined, 'GET', path(song.id))).status).toBe(401)
  expect((await call(undefined, 'PUT', path(song.id), { version: 0, sections: [] })).status).toBe(401)
  // An account manager with no church and no library access sees no library.
  expect((await call('accounts', 'GET', path(song.id))).status).toBe(403)
  expect((await call('member', 'GET', path('does-not-exist'))).status).toBe(404)
})

test('only the owner and library editors write; church roles never do, and nothing is stored when refused', async () => {
  const song = await newSong()
  for (const subject of ['member', 'editor', 'admin', 'accounts', 'b-editor']) {
    const response = await put(subject, song.id, { version: 0, sections: [verse()] })
    expect(response.status, subject).toBe(403)
  }
  // The refusal comes before validation and before looking for the song.
  expect((await put('member', song.id, { nonsense: true })).status).toBe(403)
  expect((await put('member', 'does-not-exist', { version: 0, sections: [] })).status).toBe(403)
  expect(await db.songLyrics.count()).toBe(0)
  for (const subject of ['library', 'owner', 'combined']) {
    await db.songLyrics.deleteMany()
    expect((await put(subject, song.id, { version: 0, sections: [verse()] })).status, subject).toBe(200)
  }
})

test('a new lyrics keeps its sections in order, with kind, label and repeat, and starts unpublished at version 1', async () => {
  const song = await newSong()
  const response = await put('library', song.id, { version: 0, sections: [
    { kind: 'INTRO', text: 'Intro inventada' }, { kind: 'VERSE', label: 'Estrofa 1', text: 'Verso uno\nVerso dos' }, chorus('Coro uno', 2), { kind: 'BRIDGE', text: 'Puente inventado' }, { kind: 'CLOSING', text: 'Cierre inventado' },
  ] })
  expect(response.status).toBe(200)
  const saved = await json<Lyrics>(response)
  expect(saved).toEqual({ version: 1, published: false, key: null, canEdit: true, sections: [
    { kind: 'INTRO', label: null, text: 'Intro inventada', chordPro: null, repeat: 1 },
    { kind: 'VERSE', label: 'Estrofa 1', text: 'Verso uno\nVerso dos', chordPro: null, repeat: 1 },
    { kind: 'CHORUS', label: null, text: 'Coro uno', chordPro: null, repeat: 2 },
    { kind: 'BRIDGE', label: null, text: 'Puente inventado', chordPro: null, repeat: 1 },
    { kind: 'CLOSING', label: null, text: 'Cierre inventado', chordPro: null, repeat: 1 },
  ] })
  expect(await read('member', song.id)).toEqual({ ...saved, canEdit: false })
})

test('every replacement bumps the version, replaces the sections and respects the optimistic check', async () => {
  const song = await newSong()
  await put('library', song.id, { version: 0, sections: [verse(), chorus()] })
  // The second editor still holds version 0 or 1 from before: both are refused and nothing changes.
  const stale = await put('owner', song.id, { version: 0, sections: [chorus('Texto pisado')] })
  expect(stale.status).toBe(409)
  expect(await json(stale)).toEqual({ error: 'Lyrics changed', version: 1 })
  const second = await put('owner', song.id, { version: 1, sections: [chorus('Solo el coro')] })
  expect(await json<Lyrics>(second)).toMatchObject({ version: 2, sections: [{ kind: 'CHORUS', text: 'Solo el coro' }] })
  expect((await put('library', song.id, { version: 1, sections: [verse()] })).status).toBe(409)
  expect((await read('member', song.id)).sections).toHaveLength(1)
  expect(await db.lyricsSection.count()).toBe(1)
})

test('two creations at once leave exactly one winner and the other gets the conflict', async () => {
  const song = await newSong()
  const results = await Promise.all([put('library', song.id, { version: 0, sections: [verse('Texto A')] }), put('owner', song.id, { version: 0, sections: [verse('Texto B')] })])
  expect(results.map(result => result.status).sort()).toEqual([200, 409])
  expect(await db.songLyrics.count()).toBe(1)
  expect((await read('member', song.id)).version).toBe(1)
})

test('invalid bodies are refused with 400 and change nothing; a missing song is 404 for an editor', async () => {
  const song = await newSong()
  await put('library', song.id, { version: 0, sections: [verse('Texto estable')] })
  for (const body of [
    { version: 1 }, { sections: [verse()] }, { version: 1, sections: [{ kind: 'SOLO', text: 'x' }] }, { version: 1, sections: [{ kind: 'VERSE', text: '  ' }] },
    { version: 1, sections: [verse()], extra: 1 }, { version: 1, sections: [{ ...verse(), chords: 'G C' }] }, { version: 1, sections: [{ ...chorus(), repeat: 99 }] },
    { version: 1, sections: Array.from({ length: 61 }, () => verse()) }, { version: 1, published: true, sections: [] }, { version: 1, published: 'yes', sections: [verse()] },
  ]) expect((await put('library', song.id, body)).status, JSON.stringify(body).slice(0, 60)).toBe(400)
  expect((await call('library', 'PUT', path(song.id))).status).toBe(400)
  expect((await read('member', song.id))).toMatchObject({ version: 1, sections: [{ text: 'Texto estable' }] })
  expect((await put('library', 'does-not-exist', { version: 0, sections: [verse()] })).status).toBe(404)
})

test('the database itself refuses sections out of bounds and a second lyrics for the same song', async () => {
  const song = await newSong()
  const lyrics = await db.songLyrics.create({ data: { songId: song.id } })
  await expect(db.songLyrics.create({ data: { songId: song.id } })).rejects.toThrow()
  for (const data of [{ position: -1 }, { text: '' }, { repeat: 0 }, { repeat: 9 }, { label: '' }]) {
    await expect(db.lyricsSection.create({ data: { lyricsId: lyrics.id, position: 0, kind: 'VERSE', text: 'ok', ...data } }), JSON.stringify(data)).rejects.toThrow()
  }
  await db.lyricsSection.create({ data: { lyricsId: lyrics.id, position: 0, kind: 'VERSE', text: 'ok' } })
  await expect(db.lyricsSection.create({ data: { lyricsId: lyrics.id, position: 0, kind: 'CHORUS', text: 'again' } })).rejects.toThrow()
  // A song with lyrics cannot be deleted by accident.
  await expect(db.song.delete({ where: { id: song.id } })).rejects.toThrow()
})

test('published is explicit: a new lyrics is private, an absent flag keeps it, and false takes it back', async () => {
  const song = await newSong()
  await put('library', song.id, { version: 0, sections: [verse()] })
  expect((await read('member', song.id)).published).toBe(false)
  expect((await json<Lyrics>(await put('library', song.id, { version: 1, sections: [verse()], published: true }))).published).toBe(true)
  expect((await json<Lyrics>(await put('library', song.id, { version: 2, sections: [verse('Texto corregido')] }))).published).toBe(true)
  expect((await json<Lyrics>(await put('library', song.id, { version: 3, sections: [verse('Texto corregido')], published: false }))).published).toBe(false)
  // Only an editor can publish: a church administrator cannot.
  expect((await put('admin', song.id, { version: 4, sections: [verse()], published: true })).status).toBe(403)
  expect((await read('member', song.id)).published).toBe(false)
})

// The public view: a service with three songs (published, private, no lyrics) in a church, shared as a congregation link.
async function sharedService() {
  const service = await db.service.create({ data: { churchId: 'church-a', directorId: 'person-a', title: 'Servicio ficticio', date: new Date('2026-11-13T00:00:00Z'), time: '19:30' } })
  const [open, closed, bare] = [await newSong('Canción pública', 'Autora Uno'), await newSong('Canción privada', 'Autor Dos'), await newSong('Canción sin letra', 'Autor Tres')]
  await db.setlistEntry.createMany({ data: [open, closed, bare].map((song, position) => ({ serviceId: service.id, position, songId: song.id, key: 'G', link: 'https://youtu.be/abc' })) })
  await put('library', open.id, { version: 0, sections: [{ kind: 'VERSE', label: 'Estrofa', text: 'Verso público inventado' }, chorus('Coro público inventado', 2)], published: true })
  await put('library', closed.id, { version: 0, sections: [verse('Texto privado inventado')] })
  return { open, closed, bare }
}
const link = async (version = 'CONGREGATION') => json(await call('editor', 'POST', '/api/share-links', { version, scope: { kind: 'range', from: '2026-11-01', to: '2026-11-30' } }))
const view = (made: { path: string }) => call(undefined, 'GET', `/api/public${made.path.replace('/m/', '/links/')}`)
type Entry = { kind: string; title: string; lyrics?: unknown }
const setlistOf = async (response: Response) => (await json(response)).services[0].setlist as Entry[]

test('the congregation view shows the lyrics of published songs only, in order, and nothing of the others', async () => {
  await sharedService()
  const made = await link()
  const response = await view(made)
  expect(response.status).toBe(200)
  const setlist = await setlistOf(response)
  expect(setlist).toEqual([
    { kind: 'SONG', title: 'Canción pública', author: 'Autora Uno', lyrics: [{ kind: 'VERSE', label: 'Estrofa', text: 'Verso público inventado', repeat: 1 }, { kind: 'CHORUS', label: null, text: 'Coro público inventado', repeat: 2 }] },
    { kind: 'SONG', title: 'Canción privada', author: 'Autor Dos' },
    { kind: 'SONG', title: 'Canción sin letra', author: 'Autor Tres' },
  ])
  // An unpublished lyrics and a song without lyrics look alike, and no internal field travels.
  const body = JSON.stringify(await json(await view(made)))
  for (const leaked of ['Texto privado inventado', '"version":1', 'published', 'youtu.be', '"key"', '"id"', 'songId', 'chords']) expect(body).not.toContain(leaked)
})

test('the public view keeps its headers, and publishing or unpublishing is reflected at once', async () => {
  const { open, closed } = await sharedService()
  const made = await link()
  const response = await view(made)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow, noarchive')
  expect(response.headers.get('referrer-policy')).toBe('no-referrer')
  await put('library', closed.id, { version: 1, sections: [verse('Texto privado inventado')], published: true })
  await put('library', open.id, { version: 1, sections: [verse('Texto editado inventado')], published: true })
  expect((await setlistOf(await view(made))).map(entry => entry.lyrics !== undefined)).toEqual([true, true, false])
  expect(JSON.stringify(await json(await view(made)))).toContain('Texto editado inventado')
  await put('library', open.id, { version: 2, sections: [verse('Texto editado inventado')], published: false })
  await put('library', closed.id, { version: 2, sections: [verse('Texto privado inventado')], published: false })
  expect((await setlistOf(await view(made))).some(entry => 'lyrics' in entry)).toBe(false)
})

test('only the congregation view carries lyrics: the ministry versions keep their previous answer', async () => {
  await sharedService()
  for (const version of ['PRAISE', 'FULL']) {
    const made = await link(version)
    const body = JSON.stringify(await json(await view(made)))
    expect(body, version).not.toContain('Verso público inventado')
    expect(body, version).not.toContain('lyrics')
  }
})

test('a link that is revoked, unknown or malformed still answers the same 404, lyrics or not', async () => {
  await sharedService()
  const made = await link()
  const missing = await call(undefined, 'GET', `/api/public/links/${'a'.repeat(43)}`)
  const malformed = await call(undefined, 'GET', '/api/public/links/nope')
  await call('editor', 'POST', `/api/share-links/${made.id}/revoke`)
  const revoked = await view(made)
  for (const response of [missing, malformed, revoked]) {
    expect(response.status).toBe(404)
    expect(await json(response)).toEqual({ error: 'Not found' })
    expect(response.headers.get('cache-control')).toBe('no-store')
  }
})
