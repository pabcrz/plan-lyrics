import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { church, mount } from '../calendar/test-utils'
import { NewSongPage } from './NewSongPage'
import { SongsPage } from './SongsPage'

vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken: async () => 'token-ficticio' }), UserButton: () => <button>Cuenta</button> }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

// Solo datos ficticios.
const library = [{ id: 's1', title: 'Canción de ejemplo', author: 'Autora Uno' }, { id: 's2', title: 'Himno ficticio', author: 'Autor Dos' }]

function stub(canCreate: boolean, post?: () => Response) {
  const calls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })
    calls.push(`${init?.method ?? 'GET'} ${url}`)
    if (url === '/api/active-church') return reply(200, church)
    if (url === '/api/songs/access') return reply(200, { canCreate })
    if (url === '/api/songs' && init?.method === 'POST') return post?.() ?? reply(201, { id: 's9', ...JSON.parse(String(init.body)) })
    if (url.startsWith('/api/songs?q=')) {
      const q = decodeURIComponent(url.split('q=')[1]!).toLowerCase()
      return reply(200, library.filter((song) => `${song.title} ${song.author}`.toLowerCase().includes(q)))
    }
    return reply(404, {})
  }))
  return calls
}
const app = (path: string) => mount(
  <Routes>
    <Route path="/canciones" element={<SongsPage />} />
    <Route path="/canciones/nueva" element={<NewSongPage />} />
    <Route path="/canciones/:songId/letra" element={<p>Letra</p>} />
  </Routes>, path)

test('lists and searches the library, and opening a song goes to its lyrics', async () => {
  stub(false)
  app('/canciones')
  expect(await screen.findByText('Canción de ejemplo')).toBeTruthy()
  expect(screen.getByText('2 canciones')).toBeTruthy()
  expect(screen.queryByRole('button', { name: /Nueva/ })).toBeNull()
  fireEvent.change(screen.getByLabelText('Buscar canciones'), { target: { value: 'himno' } })
  await waitFor(() => expect(screen.queryByText('Canción de ejemplo')).toBeNull())
  fireEvent.click(screen.getByText('Himno ficticio'))
  expect(await screen.findByText('Letra')).toBeTruthy()
})

test('a library editor creates a song and lands on its lyrics', async () => {
  const calls = stub(true)
  app('/canciones')
  fireEvent.click(await screen.findByRole('button', { name: /Nueva/ }))
  fireEvent.click(await screen.findByRole('button', { name: 'Guardar y escribir la letra' }))
  expect(screen.getByText('Escribe el título.')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Título'), { target: { value: ' Tema inventado ' } })
  fireEvent.change(screen.getByLabelText('Autor'), { target: { value: 'Autora Tres' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar y escribir la letra' }))
  expect(await screen.findByText('Letra')).toBeTruthy()
  expect(calls).toContain('POST /api/songs')
})

test('a duplicate song is explained, and without access the form is read-only', async () => {
  stub(true, () => new Response(JSON.stringify({ error: 'Song exists', existing: library[0] }), { status: 409 }))
  app('/canciones/nueva')
  fireEvent.change(await screen.findByLabelText('Título'), { target: { value: 'Canción de ejemplo' } })
  fireEvent.change(screen.getByLabelText('Autor'), { target: { value: 'Autora Uno' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar y escribir la letra' }))
  expect(await screen.findByText(/Ya existe una canción con ese título y autor/)).toBeTruthy()
  cleanup()
  stub(false)
  app('/canciones/nueva')
  expect(await screen.findByText('Solo lectura')).toBeTruthy()
})
