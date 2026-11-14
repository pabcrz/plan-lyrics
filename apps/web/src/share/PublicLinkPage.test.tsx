import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { mount } from '../calendar/test-utils'
import { PublicLinkPage } from './PublicLinkPage'
import type { PublicView } from './share-api'

// La vista pública no usa Clerk: si lo hiciera, este doble sin nada fallaría la prueba.
vi.mock('@clerk/react', () => ({}))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const token = 'A'.repeat(43)
const open = () => mount(<Routes><Route path="/m/:token" element={<PublicLinkPage />} /></Routes>, `/m/${token}`)
const view = (over: Partial<PublicView> = {}): PublicView => ({
  version: 'FULL', church: 'Betel', activeUntil: '2027-01-26', blocks: { keys: false, notes: false, people: true }, closedDates: [],
  services: [{
    date: '2026-12-04', slot: 'SINGLE', time: '19:30', director: 'Ana Ramírez',
    setlist: [
      { kind: 'SONG', title: 'Canción de ejemplo', author: 'Autora Uno' }, { kind: 'MOMENT', name: 'Ofrenda' }, { kind: 'SONG', title: 'Himno ficticio', author: 'Autor Dos' },
    ],
    preaching: { topic: 'La fe', passages: ['Hebreos 11:1'], preacher: 'Luis Herrera' },
  }],
  ...over,
})
function serve(status: number, body: unknown) {
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => { void url; void init; return new Response(JSON.stringify(body), { status }) })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}

test('shows the service without a session: no Authorization, no cookies, no cache', async () => {
  const fetcher = serve(200, view())
  open()
  expect(await screen.findByRole('heading', { name: 'Servicio completo' })).toBeTruthy()
  const [url, init] = fetcher.mock.calls[0]!
  expect(url).toBe(`/api/public/links/${token}`)
  expect(init).toMatchObject({ credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' })
  expect(JSON.stringify(init)).not.toMatch(/Authorization/i)
  expect(screen.getByText('Betel')).toBeTruthy()
  expect(screen.getByText('Solo lectura · disponible hasta el 26 ene 2027')).toBeTruthy()
})

test('shows the date, time, director, numbered setlist with authors, and the preaching', async () => {
  serve(200, view())
  open()
  const card = (await screen.findByRole('heading', { name: /viernes,? 4 de diciembre/ })).closest('li')!
  expect(card.textContent).toContain('7:30 p.m.')
  expect(card.textContent).toContain('Dirige: Ana Ramírez')
  const items = within(within(card).getByRole('list', { name: 'Setlist' })).getAllByRole('listitem').map((item) => item.textContent)
  expect(items).toEqual(['1Canción de ejemplo (Autora Uno)', '2Ofrenda', '3Himno ficticio (Autor Dos)'])
  const preaching = within(card).getByRole('region', { name: 'Predicación' })
  expect(preaching.textContent).toContain('Predica: Luis Herrera')
  expect(preaching.textContent).toContain('La fe')
  expect(within(preaching).getByRole('list', { name: 'Citas' }).textContent).toBe('Hebreos 11:1')
})

test('tones appear only when the link carries them, and notes only when it includes them, as text', async () => {
  serve(200, view({ blocks: { keys: true, notes: true, people: true }, services: [{
    date: '2026-12-04', slot: 'SINGLE', setlist: [{ kind: 'SONG', title: 'Canción de ejemplo', author: 'Autora Uno', key: 'G' }],
    preaching: { topic: 'La fe', passages: [], notes: '- Punto **uno** <b>x</b>' },
  }] }))
  open()
  expect((await screen.findByRole('list', { name: 'Setlist' })).textContent).toContain('G')
  expect(screen.getByText('Puntos a considerar')).toBeTruthy()
  expect(screen.getByText('uno').tagName).toBe('STRONG')
  // Notes are drawn as text: the tag in them is not markup.
  expect(screen.getByText(/<b>x<\/b>/)).toBeTruthy()
  cleanup()
  serve(200, view())
  open()
  await screen.findByRole('heading', { name: /viernes,? 4 de diciembre/ })
  expect(screen.queryByText('Puntos a considerar')).toBeNull()
})

test('a praise link shows no preaching and a preaching link no setlist, because the API sends neither', async () => {
  serve(200, view({ version: 'PRAISE', services: [{ date: '2026-12-04', slot: 'SINGLE', director: 'Ana Ramírez', setlist: [] }] }))
  open()
  await screen.findByRole('heading', { name: 'Alabanza' })
  expect(screen.queryByRole('region', { name: 'Predicación' })).toBeNull()
  expect(screen.getByText('El setlist aún no está listo.')).toBeTruthy()
  cleanup()
  serve(200, view({ version: 'PREACHING', services: [{ date: '2026-12-04', slot: 'SINGLE', preaching: null }] }))
  open()
  await screen.findByRole('heading', { name: 'Predicación' })
  expect(screen.queryByRole('list', { name: 'Setlist' })).toBeNull()
  expect(screen.getByText('Sin predicación asignada.')).toBeTruthy()
})

test('«No hay culto» dates are listed in their place with the reason', async () => {
  serve(200, view({ closedDates: [{ date: '2026-12-01', reason: 'Feriado' }, { date: '2026-12-25', reason: null }] }))
  open()
  await screen.findByRole('heading', { name: 'Servicio completo' })
  const rows = screen.getAllByRole('listitem').filter((item) => item.parentElement?.tagName === 'UL' && !item.closest('ol') && !item.closest('section'))
  expect(rows.map((row) => row.textContent)).toEqual([
    expect.stringContaining('No hay culto · Feriado'), expect.stringMatching(/viernes,? 4 de diciembre/), expect.stringContaining('No hay culto'),
  ])
})

test('a link that does not exist, expired or was revoked all look the same', async () => {
  serve(404, { error: 'Not found' })
  open()
  expect(await screen.findByText('Este enlace no está disponible')).toBeTruthy()
  expect(screen.getByText(/Puede haber vencido o haber sido revocado/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull()
})

test('too many requests and a broken connection are said apart, with a retry', async () => {
  serve(429, { error: 'Too many requests' })
  open()
  expect((await screen.findByRole('alert')).textContent).toContain('Demasiadas consultas')
  cleanup()
  serve(503, { error: 'Access unavailable' })
  open()
  expect((await screen.findByRole('alert')).textContent).toContain('No se pudo cargar')
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
})

test('the page asks not to be indexed or to leak its address, and takes that back on leaving', async () => {
  serve(200, view())
  const { unmount } = open()
  await screen.findByRole('heading', { name: 'Servicio completo' })
  expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toContain('noindex')
  expect(document.querySelector('meta[name="referrer"]')?.getAttribute('content')).toBe('no-referrer')
  expect(document.title).toBe('Servicio completo · Betel')
  unmount()
  await waitFor(() => expect(document.querySelector('meta[name="robots"]')).toBeNull())
})

test('an empty link says there is nothing yet', async () => {
  serve(200, view({ services: [] }))
  open()
  expect(await screen.findByText('Sin servicios por ahora')).toBeTruthy()
})

test('the congregation view is headed «Setlist» and shows only the setlist and, when sent, the preacher and the topic', async () => {
  serve(200, view({
    version: 'CONGREGATION', blocks: { keys: false, notes: false, people: false },
    services: [
      { date: '2026-12-04', slot: 'SINGLE', setlist: [{ kind: 'SONG', title: 'Canción de ejemplo', author: 'Autora Uno' }], preaching: { preacher: 'Luis Herrera', topic: 'La fe' } },
      { date: '2026-12-11', slot: 'SINGLE', setlist: [], preaching: null },
    ],
  }))
  open()
  expect(await screen.findByRole('heading', { name: 'Setlist' })).toBeTruthy()
  expect(document.title).toBe('Setlist · Betel')
  const first = screen.getByRole('heading', { name: /viernes,? 4 de diciembre/ }).closest('li')!
  expect(first.textContent).toContain('Canción de ejemplo (Autora Uno)')
  expect(first.textContent).toContain('Predica: Luis Herrera')
  expect(first.textContent).toContain('La fe')
  expect(first.textContent).not.toMatch(/Dirige|Citas|Puntos a considerar/)
  expect(screen.getByText('Predicador por confirmar.')).toBeTruthy()
})
