import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SongbookPage } from './SongbookPage'

// El cancionero es público: no usa Clerk.
vi.mock('@clerk/react', () => ({}))
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear() })

const songs = [
  { title: 'Bendito ficticio', author: 'Autora Uno', sections: [{ kind: 'VERSE', label: null, text: 'Línea pública', repeat: 1 }, { kind: 'CHORUS', label: null, text: 'Coro público', repeat: 2 }] },
  { title: 'Himno inventado', author: 'Autor Dos', sections: [{ kind: 'VERSE', label: null, text: 'Otra letra', repeat: 1 }] },
]
const open = () => render(<QueryClientProvider client={new QueryClient()}><SongbookPage /></QueryClientProvider>)

test('lists the published songs without a session and filters them ignoring accents', async () => {
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => { void url; void init; return new Response(JSON.stringify(songs)) })
  vi.stubGlobal('fetch', fetcher)
  open()
  expect(await screen.findByRole('heading', { name: 'Bendito ficticio' })).toBeTruthy()
  expect(fetcher.mock.calls[0]![0]).toBe('/api/public/songbook')
  expect(fetcher.mock.calls[0]![1]).toMatchObject({ credentials: 'omit', cache: 'no-store' })
  expect(screen.getByText('Coro público')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Buscar por título o autor'), { target: { value: 'himno' } })
  expect(screen.queryByRole('heading', { name: 'Bendito ficticio' })).toBeNull()
  expect(screen.getByRole('heading', { name: 'Himno inventado' })).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Buscar por título o autor'), { target: { value: 'zzz' } })
  expect(screen.getByText('Nada coincide con esa búsqueda.')).toBeTruthy()
})

test('after one visit it still opens from the saved copy when there is no connection', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(songs))))
  open()
  await screen.findByRole('heading', { name: 'Bendito ficticio' })
  cleanup()

  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
  open()
  expect(await screen.findByText('Copia guardada en este dispositivo')).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Himno inventado' })).toBeTruthy()
})

test('without a copy and without connection it says so', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
  open()
  expect(await screen.findByText('No se pudo cargar el cancionero')).toBeTruthy()
})
