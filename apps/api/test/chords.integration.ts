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
const clock = new Date('2026-11-12T18:00:00Z')
const api = createApp(fixture.config, db, () => clock, { shareSecret: 'fixture-share-secret-fixture-share-secret', publicLimiter: createLimiter({ limit: 10_000, windowMs: 60_000 }) })

// Only invented songs, texts and chords: no real lyrics ever enter this repository.
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
const put = (subject: string | undefined, songId: string, body: unknown) => call(subject, 'PUT', path(songId), body)
type Lyrics = { version: number; published: boolean; key: string | null; canEdit: boolean; semitones?: number; sections: Array<{ kind: string; label: string | null; text: string; chordPro: string | null; repeat: number }> }
const read = async (subject: string, songId: string, query = '') => json<Lyrics>(await call(subject, 'GET', `${path(songId)}${query}`))

const chordedVerse = { kind: 'VERSE', chordPro: '[Em]Luz de la [C]mañana\n[G]Canto [D/F#]hoy' }
const chordedChorus = { kind: 'CHORUS', repeat: 2, chordPro: '[G]Coro [Em7]inventado' }

test('chords are saved with the lyrics under the same version check, and every reader sees them with the clean text', async () => {
  const song = await newSong()
  const saved = await json<Lyrics>(await put('library', song.id, { version: 0, key: 'G', sections: [chordedVerse, chordedChorus] }))
  expect(saved).toMatchObject({ version: 1, key: 'G', sections: [
    { kind: 'VERSE', text: 'Luz de la mañana\nCanto hoy', chordPro: '[Em]Luz de la [C]mañana\n[G]Canto [D/F#]hoy' },
    { kind: 'CHORUS', text: 'Coro inventado', chordPro: '[G]Coro [Em7]inventado', repeat: 2 },
  ] })
  expect(await read('member', song.id)).toEqual({ ...saved, canEdit: false })
  // Whoever administers a church or edits services may also edit the library (decision of the platform owner).
  for (const subject of ['editor', 'admin']) expect(await read(subject, song.id), subject).toEqual({ ...saved, canEdit: true })
  const stale = await put('owner', song.id, { version: 0, sections: [chordedVerse] })
  expect(stale.status).toBe(409)
  expect(await json(stale)).toEqual({ error: 'Lyrics changed', version: 1 })
  expect((await read('member', song.id)).sections).toHaveLength(2)
})

test('only whoever may edit the library writes chords; a refused write changes nothing', async () => {
  const song = await newSong()
  for (const subject of ['member', 'accounts']) expect((await put(subject, song.id, { version: 0, key: 'G', sections: [chordedVerse] })).status, subject).toBe(403)
  expect(await db.songLyrics.count()).toBe(0)
  expect((await put('owner', song.id, { version: 0, key: 'G', sections: [chordedVerse] })).status).toBe(200)
  expect((await put('member', song.id, { version: 1, key: 'A', sections: [chordedVerse] })).status).toBe(403)
  expect(await read('member', song.id)).toMatchObject({ version: 1, key: 'G' })
})

test('invalid chords, keys and mismatched text are refused with 400 and nothing is stored', async () => {
  const song = await newSong()
  await put('library', song.id, { version: 0, key: 'G', sections: [chordedVerse] })
  const before = await read('member', song.id)
  for (const body of [
    { version: 1, sections: [{ kind: 'VERSE', chordPro: '[Hm]texto' }] }, { version: 1, sections: [{ kind: 'VERSE', chordPro: '[Am texto' }] },
    { version: 1, sections: [{ kind: 'VERSE', chordPro: 'texto [libre]' }] }, { version: 1, sections: [{ kind: 'VERSE', chordPro: '[G]' }] },
    { version: 1, sections: [{ kind: 'VERSE', text: 'Otro texto', chordPro: '[G]Luz' }] }, { version: 1, sections: [{ kind: 'VERSE', chordPro: 5 }] },
    { version: 1, sections: [{ kind: 'VERSE', chordPro: `[G]${'a'.repeat(4001)}` }] }, { version: 1, sections: [{ kind: 'VERSE', chordPro: '[C]a'.repeat(201) }] },
    { version: 1, key: 'H', sections: [chordedVerse] }, { version: 1, key: 'Gmaj', sections: [chordedVerse] }, { version: 1, key: 5, sections: [chordedVerse] },
  ]) expect((await put('library', song.id, body)).status, JSON.stringify(body).slice(0, 70)).toBe(400)
  expect(await read('member', song.id)).toEqual(before)
})

test('the key is kept when absent and cleared with null; a client that omits chordPro keeps the chords of unchanged sections', async () => {
  const song = await newSong()
  await put('library', song.id, { version: 0, key: 'Em', sections: [chordedVerse, chordedChorus] })
  const plain = await json<Lyrics>(await put('library', song.id, { version: 1, sections: [{ kind: 'VERSE', text: 'Luz de la mañana\nCanto hoy' }, { kind: 'CHORUS', text: 'Coro inventado', repeat: 2 }] }))
  expect(plain).toMatchObject({ version: 2, key: 'Em', sections: [{ chordPro: chordedVerse.chordPro }, { chordPro: chordedChorus.chordPro }] })
  // An explicit null removes the chords on purpose, and an explicit null key clears the tonality.
  const cleared = await json<Lyrics>(await put('library', song.id, { version: 2, key: null, sections: [{ kind: 'VERSE', text: 'Luz de la mañana\nCanto hoy', chordPro: null }, { kind: 'CHORUS', text: 'Coro inventado', chordPro: chordedChorus.chordPro }] }))
  expect(cleared).toMatchObject({ version: 3, key: null, sections: [{ chordPro: null }, { chordPro: chordedChorus.chordPro }] })
})

test('chords are never moved, reassigned or lost in silence: the write is refused with 409 and nothing is stored', async () => {
  const song = await newSong()
  const twin = (chordPro: string) => ({ kind: 'CHORUS', chordPro })
  await put('library', song.id, { version: 0, key: 'G', sections: [twin('[G]Igual [C]texto'), { kind: 'VERSE', text: 'Entre medias' }, twin('[D]Igual [A]texto')] })
  const before = await read('member', song.id)
  const plainTwin = { kind: 'CHORUS', text: 'Igual texto' }
  const refuse = async (sections: unknown[], expected: Array<{ position: number; kind: string }>, label: string) => {
    const response = await put('library', song.id, { version: 1, sections })
    expect(response.status, label).toBe(409)
    expect(await json(response), label).toEqual({ error: 'chords_would_be_lost', sections: expected.map(item => ({ ...item, label: null })) })
    expect(await read('member', song.id), label).toEqual(before)
  }
  // Moving the first twin away leaves its place with other text; the second one is still where it was, so it is not affected.
  await refuse([{ kind: 'VERSE', text: 'Entre medias' }, plainTwin, plainTwin], [{ position: 0, kind: 'CHORUS' }], 'reorder')
  // A corrected text, a removed section and an inserted one each leave a chorded section that would change or move.
  await refuse([{ kind: 'CHORUS', text: 'Igual texto corregido' }, { kind: 'VERSE', text: 'Entre medias' }, plainTwin], [{ position: 0, kind: 'CHORUS' }], 'correction')
  await refuse([plainTwin, { kind: 'VERSE', text: 'Entre medias' }], [{ position: 2, kind: 'CHORUS' }], 'removal')
  await refuse([{ kind: 'INTRO', text: 'Nueva intro' }, plainTwin, { kind: 'VERSE', text: 'Entre medias' }, plainTwin], [{ position: 0, kind: 'CHORUS' }, { position: 2, kind: 'CHORUS' }], 'insertion')
  // The same positions and texts keep their own chords, duplicates included.
  const same = await json<Lyrics>(await put('library', song.id, { version: 1, sections: [plainTwin, { kind: 'VERSE', text: 'Entre medias' }, plainTwin] }))
  expect(same.sections.map(section => section.chordPro)).toEqual(['[G]Igual [C]texto', null, '[D]Igual [A]texto'])
  // A chord-aware client may change anything it states explicitly, and null removes the chords on purpose.
  const aware = await put('library', song.id, { version: 2, sections: [{ kind: 'CHORUS', text: 'Texto corregido', chordPro: null }] })
  expect(aware.status).toBe(200)
  expect((await json<Lyrics>(aware)).sections.map(section => section.chordPro)).toEqual([null])
})

test('a stale version is still reported before any chord conflict', async () => {
  const song = await newSong()
  await put('library', song.id, { version: 0, sections: [chordedVerse] })
  const response = await put('library', song.id, { version: 0, sections: [{ kind: 'VERSE', text: 'Otro texto' }] })
  expect(response.status).toBe(409)
  expect(await json(response)).toEqual({ error: 'Lyrics changed', version: 1 })
})

test('a chordPro with spaces at a mark is stored so that its text and its offsets agree', async () => {
  const song = await newSong()
  const saved = await json<Lyrics>(await put('library', song.id, { version: 0, sections: [{ kind: 'VERSE', chordPro: 'Uno [G]\nDos' }] }))
  expect(saved.sections[0]).toMatchObject({ text: 'Uno\nDos', chordPro: 'Uno[G]\nDos' })
})

test('reading with a transposition only calculates: nothing is stored, the version does not move and the key follows', async () => {
  const song = await newSong()
  await put('library', song.id, { version: 0, key: 'G', sections: [chordedVerse, { kind: 'BRIDGE', text: 'Puente sin acordes' }] })
  const original = await read('member', song.id)
  expect(await read('member', song.id, '?semitones=2')).toMatchObject({ version: 1, key: 'A', semitones: 2, sections: [{ chordPro: '[F#m]Luz de la [D]mañana\n[A]Canto [E/G#]hoy', text: 'Luz de la mañana\nCanto hoy' }, { chordPro: null, text: 'Puente sin acordes' }] })
  const flats = await read('member', song.id, '?semitones=3')
  expect(flats).toMatchObject({ key: 'Bb', sections: [{ chordPro: '[Gm]Luz de la [Eb]mañana\n[Bb]Canto [F/A]hoy' }, { chordPro: null }] })
  expect((await read('editor', song.id, '?toKey=Bb')).sections[0]!.chordPro).toBe(flats.sections[0]!.chordPro)
  expect((await read('member', song.id, '?toKey=F%23')).sections[0]!.chordPro).toBe('[D#m]Luz de la [B]mañana\n[F#]Canto [C#/F]hoy')
  expect(await read('member', song.id)).toEqual(original)
  // Moving by zero, or to the stored key, returns the stored chords untouched (a stored Bb is not respelled).
  await put('library', song.id, { version: 1, key: 'G', sections: [{ kind: 'VERSE', chordPro: '[Bb]Sin [F]cambio' }] })
  expect((await read('member', song.id, '?semitones=0')).sections[0]!.chordPro).toBe('[Bb]Sin [F]cambio')
  expect(await read('member', song.id, '?toKey=G')).toMatchObject({ key: 'G', sections: [{ chordPro: '[Bb]Sin [F]cambio' }] })
  expect((await read('member', song.id, '?toKey=A%23')).key).toBe('Bb')
  await put('library', song.id, { version: 2, key: 'G', sections: [chordedVerse, { kind: 'BRIDGE', text: 'Puente sin acordes' }] })
  expect(await read('member', song.id)).toMatchObject({ version: 3, key: 'G' })
  expect((await db.songLyrics.findFirstOrThrow()).key).toBe('G')
  expect((await db.lyricsSection.findFirstOrThrow({ orderBy: { position: 'asc' } })).chordPro).toBe(chordedVerse.chordPro)
})

test('transposition respects the mode, and an impossible request is a 400', async () => {
  const song = await newSong()
  await put('library', song.id, { version: 0, key: 'Em', sections: [chordedVerse] })
  expect((await read('member', song.id, '?toKey=Gm')).key).toBe('Gm')
  for (const query of ['toKey=G', 'toKey=H', 'semitones=12', 'semitones=x', 'semitones=1.5', 'semitones=1&toKey=Am', 'semitones=', 'toKey=']) expect((await call('member', 'GET', `${path(song.id)}?${query}`)).status, query).toBe(400)
  // A target key needs a stored key; plain semitones do not.
  const bare = await newSong('Canción sin tonalidad', 'Autor Cuatro')
  await put('library', bare.id, { version: 0, sections: [{ kind: 'VERSE', chordPro: '[Bb]Sin [F]tono' }] })
  expect((await call('member', 'GET', `${path(bare.id)}?toKey=A`)).status).toBe(400)
  expect(await read('member', bare.id, '?semitones=2')).toMatchObject({ key: null, sections: [{ chordPro: '[C]Sin [G]tono' }] })
  // Unknown parameters are still ignored, as before.
  expect((await call('member', 'GET', `${path(bare.id)}?foo=1`)).status).toBe(200)
})

test('transposed reads keep their permissions, and a song without lyrics answers its empty version', async () => {
  const song = await newSong()
  expect((await call(undefined, 'GET', `${path(song.id)}?semitones=2`)).status).toBe(401)
  expect((await call('accounts', 'GET', `${path(song.id)}?semitones=2`)).status).toBe(403)
  expect((await call('member', 'GET', `${path('does-not-exist')}?semitones=2`)).status).toBe(404)
  expect(await read('member', song.id, '?semitones=2')).toMatchObject({ version: 0, key: null, sections: [] })
})

test('the database itself refuses an invalid key and an empty or oversized chordPro', async () => {
  const song = await newSong()
  await expect(db.songLyrics.create({ data: { songId: song.id, key: 'H' } })).rejects.toThrow()
  await expect(db.songLyrics.create({ data: { songId: song.id, key: 'Gmaj' } })).rejects.toThrow()
  const lyrics = await db.songLyrics.create({ data: { songId: song.id, key: 'F#m' } })
  for (const chordPro of ['', 'a'.repeat(8001)]) await expect(db.lyricsSection.create({ data: { lyricsId: lyrics.id, position: 0, kind: 'VERSE', text: 'ok', chordPro } })).rejects.toThrow()
  await db.lyricsSection.create({ data: { lyricsId: lyrics.id, position: 0, kind: 'VERSE', text: 'ok', chordPro: '[G]ok' } })
})

test('no chord, key or BPM reaches any public answer, even for a published lyrics, and the text stays clean', async () => {
  const service = await db.service.create({ data: { churchId: 'church-a', directorId: 'person-a', title: 'Servicio ficticio', date: new Date('2026-11-13T00:00:00Z'), time: '19:30' } })
  const song = await newSong('Canción pública', 'Autora Uno')
  await db.setlistEntry.create({ data: { serviceId: service.id, position: 0, songId: song.id, key: 'G', link: 'https://youtu.be/abc' } })
  // Chords and a tonality distinctive on purpose, on a published lyrics.
  await put('library', song.id, { version: 0, key: 'Ebm', published: true, sections: [
    { kind: 'VERSE', label: 'Estrofa', chordPro: '[Ebm]Verso [Bbmaj7/D]público inventado' }, { kind: 'CHORUS', repeat: 2, chordPro: '[Abadd9]Coro público [Gb7sus4]inventado' },
  ] })
  const leaks = [/chordPro/i, /bpm/i, /tempo/i, /Ebm/, /Bbmaj7/, /Abadd9/, /Gb7sus4/, /\[[A-G][^\]]*\]/]
  const publicPath = (made: { path: string }) => `/api/public${made.path.replace('/m/', '/links/')}`
  for (const version of ['CONGREGATION', 'PRAISE', 'FULL']) {
    const made = await json(await call('editor', 'POST', '/api/share-links', { version, scope: { kind: 'range', from: '2026-11-01', to: '2026-11-30' }, ...(version === 'CONGREGATION' ? {} : { blocks: { keys: true } }) }))
    const response = await call(undefined, 'GET', publicPath(made))
    expect(response.status, version).toBe(200)
    const body = JSON.stringify(await json(response))
    for (const leak of leaks) expect(body, `${version} ${leak}`).not.toMatch(leak)
    // Only the congregation view carries lyrics, and then only the clean text.
    expect(body.includes('Verso público inventado'), version).toBe(version === 'CONGREGATION')
    if (version === 'CONGREGATION') {
      expect((await json(await call(undefined, 'GET', publicPath(made)))).services[0].setlist[0].lyrics).toEqual([
        { kind: 'VERSE', label: 'Estrofa', text: 'Verso público inventado', repeat: 1 }, { kind: 'CHORUS', label: null, text: 'Coro público inventado', repeat: 2 },
      ])
      // The public route does not read the transposition: its parameters change nothing.
      const transposed = JSON.stringify(await json(await call(undefined, 'GET', `${publicPath(made)}?semitones=2&toKey=A`)))
      expect(transposed).toBe(body)
    }
  }
})
