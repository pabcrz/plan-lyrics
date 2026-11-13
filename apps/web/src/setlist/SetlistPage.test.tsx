import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { CalendarPage } from '../calendar/CalendarPage'
import { church, mount, service as calendarService, stubApi } from '../calendar/test-utils'
import { fold } from '../ui'
import { SetlistPage } from './SetlistPage'
import type { Entry, Setlist, Song } from './setlist-api'

vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken: async () => 'token-ficticio' }), UserButton: () => <button>Cuenta</button> }))

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-13T18:00:00Z') }) })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

// Solo datos ficticios: ningún título ni autor de la biblioteca real.
const lib: Song[] = [
  { id: 'l1', title: 'Canción de ejemplo', author: 'Autora Uno' },
  { id: 'l2', title: 'Canción de ejemplo', author: 'Autor Dos' },
  { id: 'l3', title: 'Himno ficticio', author: 'Autor Dos' },
  { id: 'l4', title: 'Tema inventado', author: 'Autora Tres' },
]
const song = (id: string, from: Song, over: Partial<Entry> = {}): Entry => ({ id, kind: 'SONG', song: from, moment: null, key: null, link: null, ...over })
const moment = (id: string, name: string): Entry => ({ id, kind: 'MOMENT', song: null, moment: name, key: null, link: null })
const initial = () => [
  song('e1', lib[0], { key: 'G', link: 'https://www.youtube.com/watch?v=ejemplo' }),
  moment('e2', 'Ofrenda'),
  song('e3', lib[2], { key: 'Bbm' }),
]

type Options = { canEdit?: boolean; canCreateSongs?: boolean; entries?: Entry[]; status?: number; staleOnce?: boolean; createSong?: { status: number; body?: unknown } }

/** Servidor ficticio en memoria con las mismas reglas que la API: versión, orden y respuestas completas. */
function stubSetlist(options: Options = {}) {
  const state = { version: 4, entries: options.entries ?? initial(), library: [...lib], stale: options.staleOnce ?? false, next: 100 }
  const calls: Array<{ method: string; url: string; body?: Record<string, unknown> }> = []
  const snapshot = (): Setlist => ({
    service: { id: 's1', title: 'Servicio dominical', date: '2026-11-15', slot: 'SINGLE', time: '10:00', status: 'DRAFT' },
    version: state.version, canEdit: options.canEdit ?? true, canCreateSongs: options.canCreateSongs ?? false, entries: structuredClone(state.entries),
  })
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined
    calls.push({ method, url, body })
    const reply = (status: number, payload: unknown) => new Response(JSON.stringify(payload), { status })
    if (url.startsWith('/api/songs')) {
      if (method === 'POST') {
        if (options.createSong) return reply(options.createSong.status, options.createSong.body ?? { error: 'x' })
        const created = { id: `new-${state.next++}`, title: String(body?.title), author: String(body?.author) }
        state.library.push(created)
        return reply(201, created)
      }
      const words = fold(decodeURIComponent(url.split('q=')[1] ?? '')).split(' ').filter(Boolean)
      return reply(200, state.library.filter((item) => words.every((word) => fold(`${item.title} ${item.author}`).includes(word))))
    }
    if (options.status) return reply(options.status, { error: 'x' })
    const entryId = /\/entries\/([^/]+)$/.exec(url)?.[1]
    if (url.endsWith('/setlist') && method === 'GET') return reply(200, snapshot())
    if (url.endsWith('/entries') && method === 'POST') {
      const created: Entry = body && 'songId' in body
        ? song(`e${state.next++}`, state.library.find((item) => item.id === body.songId)!, { key: (body.key as string | null) ?? null, link: (body.link as string | null) ?? null })
        : moment(`e${state.next++}`, String(body?.moment))
      const at = typeof body?.position === 'number' ? body.position : state.entries.length
      state.entries.splice(at, 0, created)
      state.version += 1
      return reply(201, snapshot())
    }
    if (entryId && method === 'PATCH') {
      const entry = state.entries.find((item) => item.id === entryId)!
      Object.assign(entry, body)
      return reply(200, snapshot())
    }
    if (entryId && method === 'DELETE') {
      state.entries = state.entries.filter((item) => item.id !== entryId)
      state.version += 1
      return reply(200, snapshot())
    }
    if (url.endsWith('/order') && method === 'PUT') {
      if (state.stale) {
        // Otra persona reordenó mientras tanto.
        state.stale = false
        state.entries.reverse()
        state.version += 1
      }
      const ids = body?.entryIds as string[]
      if (body?.version !== state.version) return reply(409, { error: 'Setlist changed', version: state.version })
      state.entries = ids.map((id) => state.entries.find((item) => item.id === id)!)
      state.version += 1
      return reply(200, snapshot())
    }
    return reply(404, { error: 'Not found' })
  }))
  return { calls, state, writes: () => calls.filter((call) => call.method !== 'GET' && !call.url.startsWith('/api/songs')) }
}

const page = () => mount(<Routes><Route path="/servicios/:serviceId/setlist" element={<SetlistPage />} /><Route path="*" element={<p>Calendario</p>} /></Routes>, '/servicios/s1/setlist')
const titles = () => within(screen.getByRole('list', { name: 'Setlist' })).getAllByRole('listitem').map((row) => row.querySelector('b')?.textContent)
const grip = (label: RegExp) => screen.getByRole('button', { name: label })

// Tres filas de 68 px, una debajo de otra, para medir el arrastre en jsdom.
function layoutRows() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const list = this.parentElement
    const top = this.tagName === 'LI' && list?.getAttribute('aria-label') === 'Setlist' ? Array.from(list.children).indexOf(this) * 68 : 0
    return { top, height: this.tagName === 'LI' ? 68 : 0, bottom: top + 68, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) } as DOMRect
  })
}

test('shows the service, the numbered entries in order, and what each one carries', async () => {
  stubSetlist()
  page()
  expect(await screen.findByRole('heading', { name: 'Servicio dominical' })).toBeTruthy()
  expect(screen.getByText('Domingo 15 de noviembre')).toBeTruthy()
  expect(screen.getByText('Borrador')).toBeTruthy()
  expect(screen.getByText('2 canciones · 1 momento')).toBeTruthy()
  expect(titles()).toEqual(['Canción de ejemplo', 'Ofrenda', 'Himno ficticio'])
  const first = within(screen.getByRole('list', { name: 'Setlist' })).getAllByRole('listitem')[0]
  expect(within(first).getByText('1')).toBeTruthy()
  expect(within(first).getByText('Autora Uno')).toBeTruthy()
  expect(within(first).getByText('G')).toBeTruthy()
  expect(within(first).getByText('YouTube')).toBeTruthy()
  expect(screen.getByText('Momento')).toBeTruthy()
  expect(screen.getByText(/Los tonos, el BPM y las notas son solo para el equipo/)).toBeTruthy()
  expect(screen.getByText(/Arrastra el asa para reordenar/)).toBeTruthy()
})

test('shows an empty setlist, a missing service and a load failure with retry', async () => {
  stubSetlist({ entries: [] })
  page()
  expect(await screen.findByText('El setlist está vacío')).toBeTruthy()
  cleanup()
  stubSetlist({ status: 404 })
  page()
  expect(await screen.findByText('No encontramos este servicio')).toBeTruthy()
  cleanup()
  stubSetlist({ status: 500 })
  page()
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
})

test('a member only reads: no handle, no add button, and the entry opens read-only with its reference', async () => {
  const server = stubSetlist({ canEdit: false })
  page()
  await screen.findByRole('heading', { name: 'Servicio dominical' })
  expect(screen.queryByRole('button', { name: /Mover/ })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Agregar al setlist' })).toBeNull()
  expect(screen.getByText('Solo quien edita los servicios puede cambiar el setlist.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Ver Canción de ejemplo' }))
  const sheet = await screen.findByRole('dialog')
  const link = within(sheet).getByRole('link', { name: /Abrir en YouTube/ })
  expect(link.getAttribute('href')).toBe('https://www.youtube.com/watch?v=ejemplo')
  expect(link.getAttribute('rel')).toContain('noopener')
  expect(within(sheet).queryByRole('button', { name: 'Quitar del setlist' })).toBeNull()
  expect(server.writes()).toEqual([])
})

test('adds a song from the library by title or author, marking the ones already included', async () => {
  const server = stubSetlist()
  page()
  fireEvent.click(await screen.findByRole('button', { name: 'Agregar al setlist' }))
  const sheet = await screen.findByRole('dialog', { name: 'Agregar al setlist' })
  expect(await within(sheet).findByRole('button', { name: 'Agregar Tema inventado, Autora Tres' })).toBeTruthy()
  // Dos canciones con el mismo título se distinguen por su autor.
  expect(within(sheet).getByRole('button', { name: 'Canción de ejemplo, Autora Uno. Ya está en el setlist' }).hasAttribute('disabled')).toBe(true)
  expect(within(sheet).getByRole('button', { name: 'Agregar Canción de ejemplo, Autor Dos' }).hasAttribute('disabled')).toBe(false)
  fireEvent.change(within(sheet).getByRole('searchbox', { name: 'Buscar canciones' }), { target: { value: 'CANCION dos' } })
  await waitFor(() => expect(within(sheet).queryByRole('button', { name: /Tema inventado/ })).toBeNull())
  fireEvent.click(within(sheet).getByRole('button', { name: 'Agregar Canción de ejemplo, Autor Dos' }))
  await waitFor(() => expect(titles()).toEqual(['Canción de ejemplo', 'Ofrenda', 'Himno ficticio', 'Canción de ejemplo']))
  expect(server.writes()).toEqual([{ method: 'POST', url: '/api/services/s1/setlist/entries', body: { songId: 'l2' } }])
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByText('«Canción de ejemplo» agregada')).toBeTruthy()
})

test('a person who cannot edit the library is told so when nothing matches, and gets no quick add', async () => {
  stubSetlist({ canCreateSongs: false })
  page()
  fireEvent.click(await screen.findByRole('button', { name: 'Agregar al setlist' }))
  const sheet = await screen.findByRole('dialog')
  expect(within(sheet).queryByRole('button', { name: 'Agregar canción nueva' })).toBeNull()
  fireEvent.change(await within(sheet).findByRole('searchbox'), { target: { value: 'inexistente' } })
  expect(await within(sheet).findByText(/Ninguna canción coincide\. La biblioteca la edita quien tenga ese acceso\./)).toBeTruthy()
})

test('a library editor creates a song with title and author and adds it to the setlist', async () => {
  const server = stubSetlist({ canCreateSongs: true })
  page()
  fireEvent.click(await screen.findByRole('button', { name: 'Agregar al setlist' }))
  const sheet = await screen.findByRole('dialog')
  fireEvent.change(await within(sheet).findByRole('searchbox'), { target: { value: 'Canto nuevo' } })
  fireEvent.click(within(sheet).getByRole('button', { name: 'Agregar canción nueva' }))
  expect((within(sheet).getByLabelText('Título') as HTMLInputElement).value).toBe('Canto nuevo')
  fireEvent.click(within(sheet).getByRole('button', { name: 'Guardar y agregar' }))
  expect(await within(sheet).findByText('Escribe el autor.')).toBeTruthy()
  expect(server.writes()).toEqual([])
  fireEvent.change(within(sheet).getByLabelText('Autor'), { target: { value: '  Autor Nuevo ' } })
  fireEvent.click(within(sheet).getByRole('button', { name: 'Guardar y agregar' }))
  await waitFor(() => expect(titles()).toContain('Canto nuevo'))
  expect(server.calls.filter((call) => call.method === 'POST').map((call) => [call.url, call.body])).toEqual([
    ['/api/songs', { title: 'Canto nuevo', author: 'Autor Nuevo' }],
    ['/api/services/s1/setlist/entries', { songId: 'new-100' }],
  ])
})

test('quick add reports a song that already exists with the same title and author', async () => {
  const server = stubSetlist({ canCreateSongs: true, createSong: { status: 409, body: { error: 'Song exists' } } })
  page()
  fireEvent.click(await screen.findByRole('button', { name: 'Agregar al setlist' }))
  const sheet = await screen.findByRole('dialog')
  fireEvent.click(await within(sheet).findByRole('button', { name: 'Agregar canción nueva' }))
  fireEvent.change(within(sheet).getByLabelText('Título'), { target: { value: 'Tema inventado' } })
  fireEvent.change(within(sheet).getByLabelText('Autor'), { target: { value: 'Autora Tres' } })
  fireEvent.click(within(sheet).getByRole('button', { name: 'Guardar y agregar' }))
  expect((await within(sheet).findByRole('alert')).textContent).toContain('Ya existe una canción con ese título y autor')
  expect(server.writes()).toEqual([])
})

test('adds a common moment, or a free one that needs a name', async () => {
  const server = stubSetlist({ entries: [] })
  page()
  fireEvent.click(await screen.findByRole('button', { name: 'Agregar al setlist' }))
  const sheet = await screen.findByRole('dialog')
  fireEvent.click(within(sheet).getByRole('button', { name: 'Momento' }))
  fireEvent.click(within(sheet).getByRole('button', { name: 'Agregar' }))
  expect(await within(sheet).findByText('Escribe un nombre.')).toBeTruthy()
  fireEvent.change(within(sheet).getByLabelText('Otro momento'), { target: { value: 'bautismos' } })
  fireEvent.click(within(sheet).getByRole('button', { name: 'Agregar' }))
  await waitFor(() => expect(titles()).toEqual(['Bautismos']))
  fireEvent.click(screen.getByRole('button', { name: 'Agregar al setlist' }))
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Momento' }))
  fireEvent.click(screen.getByRole('button', { name: 'Ofrenda' }))
  await waitFor(() => expect(titles()).toEqual(['Bautismos', 'Ofrenda']))
  expect(server.writes().map((call) => call.body)).toEqual([{ moment: 'Bautismos' }, { moment: 'Ofrenda' }])
  expect(screen.getByText('«Ofrenda» agregado')).toBeTruthy()
})

test('edits the key and the reference link of a song, validating the link before sending', async () => {
  const server = stubSetlist()
  page()
  fireEvent.click(await screen.findByRole('button', { name: 'Editar Himno ficticio' }))
  const sheet = await screen.findByRole('dialog', { name: 'Himno ficticio' })
  expect(within(sheet).getByRole('button', { name: 'Bbm' }).getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(within(sheet).getByRole('button', { name: 'Mayor' }))
  fireEvent.click(within(sheet).getByRole('button', { name: 'F#' }))
  fireEvent.change(within(sheet).getByLabelText(/Enlace de referencia/), { target: { value: 'https://evil.example/youtube.com' } })
  fireEvent.click(within(sheet).getByRole('button', { name: 'Listo' }))
  expect(await within(sheet).findByText('Pega un enlace de YouTube o Spotify.')).toBeTruthy()
  expect(server.writes()).toEqual([])
  fireEvent.change(within(sheet).getByLabelText(/Enlace de referencia/), { target: { value: 'https://open.spotify.com/track/ejemplo' } })
  fireEvent.click(within(sheet).getByRole('button', { name: 'Listo' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(server.writes()).toEqual([{ method: 'PATCH', url: '/api/services/s1/setlist/entries/e3', body: { key: 'F#', link: 'https://open.spotify.com/track/ejemplo' } }])
  expect(await screen.findByText('Spotify')).toBeTruthy()
})

test('renames a moment, and removing an entry can be undone in its place', async () => {
  const server = stubSetlist()
  page()
  fireEvent.click(await screen.findByRole('button', { name: 'Editar Ofrenda' }))
  const sheet = await screen.findByRole('dialog', { name: 'Ofrenda' })
  fireEvent.change(within(sheet).getByLabelText('Nombre del momento'), { target: { value: 'Ofrendas' } })
  fireEvent.click(within(sheet).getByRole('button', { name: 'Listo' }))
  await waitFor(() => expect(titles()[1]).toBe('Ofrendas'))
  fireEvent.click(screen.getByRole('button', { name: 'Editar Canción de ejemplo' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Quitar del setlist' }))
  await waitFor(() => expect(titles()).toEqual(['Ofrendas', 'Himno ficticio']))
  fireEvent.click(await screen.findByRole('button', { name: 'Deshacer' }))
  await waitFor(() => expect(titles()).toEqual(['Canción de ejemplo', 'Ofrendas', 'Himno ficticio']))
  expect(server.writes().map((call) => [call.method, call.body])).toEqual([
    ['PATCH', { moment: 'Ofrendas' }], ['DELETE', undefined],
    ['POST', { songId: 'l1', key: 'G', link: 'https://www.youtube.com/watch?v=ejemplo', position: 0 }],
  ])
})

test('the keyboard alternative moves an entry with the arrow keys, announces it and keeps the focus on the handle', async () => {
  const server = stubSetlist()
  page()
  await screen.findByRole('heading', { name: 'Servicio dominical' })
  const handle = grip(/Mover Canción de ejemplo\. Posición 1 de 3\. Usa las flechas arriba y abajo/)
  handle.focus()
  fireEvent.keyDown(handle, { key: 'ArrowUp' }) // ya es la primera: no hace nada
  expect(server.writes()).toEqual([])
  fireEvent.keyDown(handle, { key: 'ArrowDown' })
  await waitFor(() => expect(titles()).toEqual(['Ofrenda', 'Canción de ejemplo', 'Himno ficticio']))
  expect(server.writes()).toEqual([{ method: 'PUT', url: '/api/services/s1/setlist/order', body: { version: 4, entryIds: ['e2', 'e1', 'e3'] } }])
  expect(screen.getByText('Canción de ejemplo, posición 2 de 3')).toBeTruthy()
  expect(document.activeElement).toBe(grip(/Mover Canción de ejemplo\. Posición 2 de 3/))
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
  await waitFor(() => expect(titles()).toEqual(['Ofrenda', 'Himno ficticio', 'Canción de ejemplo']))
  // El segundo envío usa la versión que dejó el primero.
  expect(server.writes()[1].body).toEqual({ version: 5, entryIds: ['e2', 'e3', 'e1'] })
})

test('dragging the right-hand handle follows the pointer and drops the entry in its new place', async () => {
  const server = stubSetlist()
  layoutRows()
  page()
  await screen.findByRole('heading', { name: 'Servicio dominical' })
  const handle = grip(/Mover Canción de ejemplo/)
  fireEvent.pointerDown(handle, { pointerId: 1, pointerType: 'touch', button: 0, clientY: 34 })
  fireEvent.pointerMove(handle, { pointerId: 1, pointerType: 'touch', clientY: 34 + 100 })
  const rows = within(screen.getByRole('list', { name: 'Setlist' })).getAllByRole('listitem')
  expect(rows[0].style.transform).toBe('translateY(100px)')
  expect(rows[1].style.transform).toBe('translateY(-68px)') // la fila 1 se aparta
  expect(rows[2].style.transform).toBe('')
  fireEvent.pointerMove(handle, { pointerId: 1, pointerType: 'touch', clientY: 34 + 150 })
  expect(rows[2].style.transform).toBe('translateY(-68px)')
  fireEvent.pointerUp(handle, { pointerId: 1, pointerType: 'touch' })
  await waitFor(() => expect(titles()).toEqual(['Ofrenda', 'Himno ficticio', 'Canción de ejemplo']))
  expect(server.writes()).toEqual([{ method: 'PUT', url: '/api/services/s1/setlist/order', body: { version: 4, entryIds: ['e2', 'e3', 'e1'] } }])
  expect(within(screen.getByRole('list', { name: 'Setlist' })).getAllByRole('listitem')[0].style.transform).toBe('')
})

test('a drag cancelled with Escape or dropped where it started changes nothing', async () => {
  const server = stubSetlist()
  layoutRows()
  page()
  await screen.findByRole('heading', { name: 'Servicio dominical' })
  const handle = grip(/Mover Himno ficticio/)
  fireEvent.pointerDown(handle, { pointerId: 1, pointerType: 'touch', button: 0, clientY: 170 })
  fireEvent.pointerMove(handle, { pointerId: 1, pointerType: 'touch', clientY: 20 })
  fireEvent.keyDown(document, { key: 'Escape' })
  fireEvent.pointerUp(handle, { pointerId: 1, pointerType: 'touch' })
  fireEvent.pointerDown(handle, { pointerId: 2, pointerType: 'touch', button: 0, clientY: 170 })
  fireEvent.pointerMove(handle, { pointerId: 2, pointerType: 'touch', clientY: 180 })
  fireEvent.pointerUp(handle, { pointerId: 2, pointerType: 'touch' })
  fireEvent.pointerDown(handle, { pointerId: 3, pointerType: 'touch', button: 0, clientY: 170 })
  fireEvent.pointerMove(handle, { pointerId: 3, pointerType: 'touch', clientY: 20 })
  fireEvent.pointerCancel(handle, { pointerId: 3, pointerType: 'touch' })
  expect(titles()).toEqual(['Canción de ejemplo', 'Ofrenda', 'Himno ficticio'])
  expect(server.writes()).toEqual([])
})

test('when someone else reordered meanwhile the server rejects the change and the screen shows the current order', async () => {
  stubSetlist({ staleOnce: true })
  page()
  await screen.findByRole('heading', { name: 'Servicio dominical' })
  const handle = grip(/Mover Canción de ejemplo/)
  fireEvent.keyDown(handle, { key: 'ArrowDown' })
  expect((await screen.findByRole('alert')).textContent).toContain('El setlist cambió mientras lo ordenabas')
  await waitFor(() => expect(titles()).toEqual(['Himno ficticio', 'Ofrenda', 'Canción de ejemplo']))
})

test('the calendar detail leads to the setlist: «Preparar setlist» for editors, «Ver setlist» for members', async () => {
  stubApi({ services: [calendarService({ id: 's1', date: '2026-11-13' })] })
  mount(<Routes><Route path="/servicios/:serviceId/setlist" element={<p>Pantalla del setlist</p>} /><Route path="*" element={<CalendarPage />} /></Routes>)
  fireEvent.click(await screen.findByRole('button', { name: /13 de noviembre: Servicio de viernes/ }))
  fireEvent.click(await within(await screen.findByRole('dialog')).findByRole('button', { name: 'Preparar setlist' }))
  expect(await screen.findByText('Pantalla del setlist')).toBeTruthy()
  cleanup()
  stubApi({ services: [calendarService({ id: 's1', date: '2026-11-13' })], church: { ...church, canEdit: false } })
  mount(<Routes><Route path="*" element={<CalendarPage />} /></Routes>)
  fireEvent.click(await screen.findByRole('button', { name: /13 de noviembre: Servicio de viernes/ }))
  expect(await within(await screen.findByRole('dialog')).findByRole('button', { name: 'Ver setlist' })).toBeTruthy()
})
