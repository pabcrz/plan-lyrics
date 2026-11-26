import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { LyricsPage } from './LyricsPage'
import { chorded, mountAt, stubLyrics } from './lyrics-test-utils'
import type { Section } from './lyrics-model'

vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken: async () => 'token-ficticio' }), UserButton: () => <button>Cuenta</button> }))

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

const page = (state?: unknown) => mountAt(
  <Routes>
    <Route path="/canciones/:songId/letra" element={<LyricsPage />} />
    <Route path="/canciones/:songId/letra/acordes" element={<p>Pantalla de acordes</p>} />
    <Route path="/canciones/:songId/letra/editar" element={<p>Pantalla de edición</p>} />
  </Routes>, state === undefined ? '/canciones/c1/letra' : { pathname: '/canciones/c1/letra', state })

/** La misma letra con los acordes ya movidos, como los devolvería el servidor. */
const moved = (key: string, semitones: number, chords: [string, string, string]): { key: string; semitones: number; sections: Section[] } => ({
  key, semitones,
  sections: [
    { ...chorded[0], chordPro: `[${chords[0]}]Línea inventada [${chords[1]}]de la introducción` },
    { ...chorded[1], chordPro: `[${chords[0]}]Primera línea [${chords[2]}]de una estrofa ficticia\nSegunda línea de la misma estrofa` },
    chorded[2],
  ],
})
const toA = moved('A', 2, ['A', 'E', 'F#m'])

const chordOf = (name: string) => screen.getAllByText(name)[0]

test('puts each chord over the syllable where it falls, in the saved key by default', async () => {
  stubLyrics({ sections: chorded, key: 'G' })
  page()
  const sections = await screen.findAllByRole('listitem')
  const first = within(sections[1]).getAllByText('G')[0].parentElement!
  expect(first).toHaveTextContent('GPrimera línea')
  expect(within(sections[1]).getByText('Em').parentElement).toHaveTextContent('Emde una estrofa ficticia')
  // Una línea sin acordes sigue siendo texto, y una sección sin acordes también.
  expect(sections[1]).toHaveTextContent('Segunda línea de la misma estrofa')
  expect(sections[2]).toHaveTextContent('Texto inventado del coro')
  expect(screen.getByRole('group', { name: 'Tonalidad' })).toHaveTextContent('Base G')
  expect(screen.getByRole('group', { name: 'Tonalidad' })).toHaveTextContent('Ahora G')
})

test('from a service, shows the chords in the service key when it has the same mode as the base', async () => {
  const server = stubLyrics({ sections: chorded, key: 'G', transposed: { 'toKey=A': toA } })
  page({ title: 'Canción de ejemplo', back: '/servicios/s1/setlist', key: 'A' })
  expect(await screen.findAllByText('F#m')).not.toHaveLength(0)
  expect(chordOf('A')).toBeInTheDocument()
  expect(screen.queryByText('Em')).not.toBeInTheDocument()
  expect(screen.getByRole('group', { name: 'Tonalidad' })).toHaveTextContent('Base G')
  expect(screen.getByRole('group', { name: 'Tonalidad' })).toHaveTextContent('Ahora A')
  expect(server.calls.map((call) => call.url)).toContain('/api/songs/c1/lyrics?toKey=A')
  expect(server.writes()).toEqual([])
})

test('the sharp of a service key travels encoded', async () => {
  const server = stubLyrics({ sections: chorded, key: 'F#m', transposed: { 'toKey=C%23m': moved('C#m', 4, ['C#m', 'G#m', 'A']) } })
  page({ key: 'C#m' })
  expect(await screen.findAllByText('C#m')).not.toHaveLength(0)
  expect(server.calls.map((call) => call.url)).toContain('/api/songs/c1/lyrics?toKey=C%23m')
})

test('a service key of another mode, or none, shows the base key and says so', async () => {
  const server = stubLyrics({ sections: chorded, key: 'G' })
  page({ key: 'Am' })
  expect(await screen.findAllByText('Em')).not.toHaveLength(0)
  expect(screen.getByRole('group', { name: 'Tonalidad' })).toHaveTextContent('Ahora G')
  expect(screen.getByText(/no es del mismo modo/)).toBeInTheDocument()
  expect(server.calls.map((call) => call.url)).toEqual(['/api/songs/c1/lyrics'])
  cleanup()
  stubLyrics({ sections: chorded, key: 'G' })
  page()
  await screen.findAllByText('Em')
  expect(screen.queryByText(/no es del mismo modo/)).not.toBeInTheDocument()
})

test('transposes by hand, on screen only, from the key being shown', async () => {
  const server = stubLyrics({ sections: chorded, key: 'G', transposed: { 'semitones=1': moved('Ab', 1, ['Ab', 'Eb', 'Cm']), 'semitones=3': moved('Bb', 3, ['Bb', 'F', 'Dm']), 'toKey=A': toA } })
  page({ key: 'A' })
  await screen.findAllByText('F#m')
  fireEvent.click(screen.getByRole('button', { name: 'Medio tono arriba' }))
  // A son 2 medios tonos sobre G; uno más son 3 desde la base.
  expect(await screen.findAllByText('Dm')).not.toHaveLength(0)
  expect(screen.getByRole('group', { name: 'Tonalidad' })).toHaveTextContent('Ahora Bb')
  expect(screen.getByLabelText('Transposición manual')).toHaveTextContent('+1')
  expect(server.calls.map((call) => call.url)).toContain('/api/songs/c1/lyrics?semitones=3')
  fireEvent.click(screen.getByRole('button', { name: 'Volver al tono del servicio' }))
  expect(await screen.findAllByText('F#m')).not.toHaveLength(0)
  expect(screen.getByLabelText('Transposición manual')).toHaveTextContent('0')
  expect(server.writes()).toEqual([])
})

test('transposes by hand a lyrics without a saved key, from the saved chords', async () => {
  const server = stubLyrics({ sections: chorded, key: null, transposed: { 'semitones=-1': moved('', -1, ['F#', 'C#', 'Em']) } })
  page({ key: 'A' })
  await screen.findAllByText('Em')
  expect(screen.getByRole('group', { name: 'Tonalidad' })).toHaveTextContent('Base sin definir')
  fireEvent.click(screen.getByRole('button', { name: 'Medio tono abajo' }))
  expect(await screen.findAllByText('F#')).not.toHaveLength(0)
  expect(server.calls.map((call) => call.url)).not.toContain('/api/songs/c1/lyrics?toKey=A')
})

test('a lyrics without chords shows no tonality controls', async () => {
  stubLyrics()
  page({ key: 'A' })
  await screen.findAllByRole('listitem')
  expect(screen.queryByRole('group', { name: 'Tonalidad' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Medio tono arriba' })).not.toBeInTheDocument()
})

test('a failed transposition says so and keeps the saved chords on screen', async () => {
  stubLyrics({ sections: chorded, key: 'G' })
  page({ key: 'A' })
  expect(await screen.findAllByText('Em')).not.toHaveLength(0)
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No se pudo transponer'))
})

test('offers editing the chords only to whoever can edit the library, and keeps the way back', async () => {
  stubLyrics({ sections: chorded, key: 'G', canEdit: true })
  page({ title: 'Canción de ejemplo', back: '/servicios/s1/setlist', key: 'G' })
  fireEvent.click(await screen.findByRole('button', { name: 'Editar acordes' }))
  expect(await screen.findByText('Pantalla de acordes')).toBeInTheDocument()
  cleanup()
  stubLyrics({ sections: chorded, key: 'G', canEdit: false })
  page()
  await screen.findAllByRole('listitem')
  expect(screen.queryByRole('button', { name: 'Editar acordes' })).not.toBeInTheDocument()
})

test('without network, moving the chords explains it and keeps the saved ones', async () => {
  stubLyrics({ sections: chorded, key: 'G' })
  page()
  await screen.findAllByRole('listitem')
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  fireEvent(window, new Event('offline'))
  fireEvent.click(screen.getByRole('button', { name: 'Medio tono arriba' }))
  expect(await screen.findByText(/Sin conexión no se pueden mover los acordes/)).toBeInTheDocument()
  expect(screen.queryByText('Calculando los acordes…')).not.toBeInTheDocument()
  expect(chordOf('Em')).toBeInTheDocument()
})
