import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { church, mount } from '../calendar/test-utils'
import { NewSongPage } from './NewSongPage'
import { EditSongPage } from './EditSongPage'
import { SongsPage } from './SongsPage'

vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken: async () => 'token-ficticio' }), UserButton: () => <button>Cuenta</button> }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

// Solo datos ficticios.
const library = [{ id: 's1', title: 'Canción de ejemplo', author: 'Autora Uno' }, { id: 's2', title: 'Himno ficticio', author: 'Autor Dos' }]

function stub(canCreate: boolean, post?: () => Response, write?: (method: string) => Response) {
  const calls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })
    calls.push(`${init?.method ?? 'GET'} ${url}`)
    if (url === '/api/active-church') return reply(200, church)
    if (url === '/api/songs/access') return reply(200, { canCreate })
    if (url.startsWith('/api/songs/s') && (init?.method === 'PATCH' || init?.method === 'DELETE')) return write?.(init.method) ?? (init.method === 'DELETE' ? new Response(null, { status: 204 }) : reply(200, { id: 's1', ...JSON.parse(String(init.body)) }))
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
    <Route path="/canciones" element={<SongsPage />}>
      <Route path="nueva" element={<NewSongPage />} />
      <Route path=":songId/editar" element={<EditSongPage />} />
    </Route>
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

test('an editor renames a song from the list; a reader sees no edit button', async () => {
  const calls = stub(true)
  app('/canciones')
  fireEvent.click(await screen.findByRole('button', { name: 'Editar Canción de ejemplo, Autora Uno' }))
  fireEvent.change(await screen.findByLabelText('Autor'), { target: { value: 'Autora Uno Bis' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  expect(await screen.findByText('Himno ficticio')).toBeTruthy()
  expect(calls).toContain('PATCH /api/songs/s1')
  cleanup()
  stub(false)
  app('/canciones')
  await screen.findByText('Himno ficticio')
  expect(screen.queryByRole('button', { name: /^Editar/ })).toBeNull()
})

test('deleting a song asks first and explains when it is in use', async () => {
  const used = new Response(JSON.stringify({ error: 'Song in use' }), { status: 409 })
  const calls = stub(true, undefined, (method) => (method === 'DELETE' && calls.filter((call) => call === 'DELETE /api/songs/s1').length === 1 ? used : new Response(null, { status: 204 })))
  app('/canciones')
  fireEvent.click(await screen.findByRole('button', { name: 'Editar Canción de ejemplo, Autora Uno' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Eliminar canción' }))
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Eliminar canción' }))
  expect(await screen.findByText('No se puede eliminar: tiene letra o está en un setlist.')).toBeTruthy()
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar canción' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(await screen.findByText('Himno ficticio')).toBeTruthy()
})

test('on desktop an editor picks a song and edits it beside the list, keeping the search', async () => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }))
  const calls = stub(true)
  app('/canciones')
  expect(await screen.findByText('Elige una canción')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Buscar canciones'), { target: { value: 'ejemplo' } })
  fireEvent.click(await screen.findByText('Canción de ejemplo'))
  expect((await screen.findByLabelText('Título') as HTMLInputElement).value).toBe('Canción de ejemplo')
  expect((screen.getByLabelText('Buscar canciones') as HTMLInputElement).value).toBe('ejemplo')
  expect(screen.getByRole('button', { name: /^Canción de ejemplo\s*Autora Uno$/ }).getAttribute('aria-current')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  await waitFor(() => expect(calls).toContain('PATCH /api/songs/s1'))
  expect(await screen.findByText('Elige una canción')).toBeTruthy()
  cleanup()
  stub(false)
  app('/canciones')
  fireEvent.click(await screen.findByText('Himno ficticio'))
  expect(await screen.findByText('Letra')).toBeTruthy()
})
