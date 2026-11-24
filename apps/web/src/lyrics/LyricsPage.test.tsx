import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { LyricsPage } from './LyricsPage'
import { mountAt, stubLyrics } from './lyrics-test-utils'

vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken: async () => 'token-ficticio' }), UserButton: () => <button>Cuenta</button> }))

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

const page = (entry: Parameters<typeof mountAt>[1] = '/canciones/c1/letra') => mountAt(
  <Routes>
    <Route path="/canciones/:songId/letra" element={<LyricsPage />} />
    <Route path="/canciones/:songId/letra/editar" element={<p>Pantalla de edición</p>} />
    <Route path="*" element={<p>Otra pantalla</p>} />
  </Routes>, entry)

test('shows the sections in order with their kind, label, repetitions and line breaks', async () => {
  stubLyrics({ published: true })
  page()
  const sections = await screen.findAllByRole('listitem')
  expect(sections).toHaveLength(3)
  expect(within(sections[0]).getByText('Intro')).toBeInTheDocument()
  expect(within(sections[1]).getByText('Estrofa')).toBeInTheDocument()
  expect(within(sections[1]).getByText('Estrofa 1')).toBeInTheDocument()
  expect(sections[1].querySelector('p')?.textContent).toBe('Primera línea de una estrofa ficticia\nSegunda línea de la misma estrofa')
  expect(within(sections[2]).getByText('Coro')).toBeInTheDocument()
  expect(within(sections[2]).getByLabelText('Se canta 2 veces')).toBeInTheDocument()
  expect(within(sections[0]).queryByLabelText(/Se canta/)).not.toBeInTheDocument()
  expect(screen.getByText('Publicada')).toBeInTheDocument()
})

test('says in words when the lyrics are not published', async () => {
  stubLyrics({ published: false })
  page()
  expect(await screen.findByText('Sin publicar')).toBeInTheDocument()
  expect(screen.queryByText('Publicada')).not.toBeInTheDocument()
})

test('uses the song title that the setlist passes, and goes back to where the person came from', async () => {
  stubLyrics()
  page({ pathname: '/canciones/c1/letra', state: { title: 'Canción de ejemplo', back: '/servicios/s1/setlist' } })
  expect(await screen.findByRole('heading', { name: 'Canción de ejemplo' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
  expect(await screen.findByText('Otra pantalla')).toBeInTheDocument()
})

test('ignores a back destination that leaves the app', async () => {
  stubLyrics()
  page({ pathname: '/canciones/c1/letra', state: { title: 'x', back: '//ejemplo.test' } })
  await screen.findAllByRole('listitem')
  fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
  expect(await screen.findByText('Otra pantalla')).toBeInTheDocument()
})

test('offers editing only to whoever can edit the library', async () => {
  stubLyrics({ canEdit: true })
  page()
  fireEvent.click(await screen.findByRole('button', { name: 'Editar letra' }))
  expect(await screen.findByText('Pantalla de edición')).toBeInTheDocument()
})

test('a member who cannot edit sees no editing action and is told why', async () => {
  stubLyrics({ canEdit: false })
  page()
  await screen.findAllByRole('listitem')
  expect(screen.queryByRole('button', { name: /letra$/i })).not.toBeInTheDocument()
  expect(screen.getByText('Solo quien edita la biblioteca puede cambiar la letra y los acordes.')).toBeInTheDocument()
})

test('a song without lyrics shows an empty state, with the way to write them only for editors', async () => {
  stubLyrics({ sections: [], canEdit: true })
  page()
  expect(await screen.findByText('Esta canción aún no tiene letra')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Escribir letra' })).toBeInTheDocument()
  cleanup()
  stubLyrics({ sections: [], canEdit: false })
  page()
  expect(await screen.findByText('Esta canción aún no tiene letra')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Escribir letra' })).not.toBeInTheDocument()
})

test('explains a refused read, a missing song and a failure, and lets the person retry', async () => {
  stubLyrics({ readStatus: 403 })
  page()
  expect(await screen.findByText('Tu cuenta no tiene acceso a las letras')).toBeInTheDocument()
  cleanup()
  stubLyrics({ readStatus: 404 })
  page()
  expect(await screen.findByText('No encontramos esta canción')).toBeInTheDocument()
  cleanup()
  stubLyrics({ readStatus: 500 })
  page()
  expect(await screen.findByText('No se pudo cargar la letra')).toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument())
})

test('confirms a save that comes from the editor', async () => {
  stubLyrics()
  page({ pathname: '/canciones/c1/letra', state: { saved: true } })
  expect(await screen.findByText('Letra guardada')).toBeInTheDocument()
})
