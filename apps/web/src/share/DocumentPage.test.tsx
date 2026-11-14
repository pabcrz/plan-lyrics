import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { service as calendarService, mount } from '../calendar/test-utils'
import { DocumentPage } from './DocumentPage'
import { stubShare } from './share-test-utils'

vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken: async () => 'token-ficticio' }), UserButton: () => <button>Cuenta</button> }))

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-13T18:00:00Z') }) })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

const open = (kind: string) => mount(<Routes><Route path="/compartir/documento/:kind" element={<DocumentPage />} /><Route path="/compartir" element={<p>Compartir</p>} /></Routes>, `/compartir/documento/${kind}`)
const services = [
  calendarService({ id: 's1', date: '2026-11-20', director: { id: 'p1', name: 'Ana Torres' } }),
  calendarService({ id: 's2', date: '2026-11-27', director: { id: 'p2', name: 'Luis Ramírez' } }),
  calendarService({ id: 's3', date: '2026-11-29', status: 'CANCELLED' }),
]
const setlist = (entries: unknown[]) => ({ service: { id: 's1', title: 'Servicio', date: '2026-11-20', slot: 'SINGLE', time: '19:30', status: 'PUBLISHED' }, version: 1, canEdit: true, canCreateSongs: false, entries })
const song = (id: string, title: string, author: string) => ({ id, kind: 'SONG', song: { id, title, author }, moment: null, key: 'G', link: null })

/** Un canvas ficticio que registra lo dibujado: jsdom no trae canvas. */
function fakeCanvas() {
  const drawn: string[] = []
  const context = { font: '', fillStyle: '', textBaseline: '', measureText: (text: string) => ({ width: text.length * 10 }), fillRect: vi.fn(), fillText: (text: string) => { drawn.push(text) } }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (callback) { callback(new Blob(['png'], { type: 'image/png' })) })
  const create = vi.fn(() => 'blob:ficticio')
  Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() })
  const downloads: string[] = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { downloads.push(this.download) })
  return { drawn, downloads, create }
}

test('the setlist image previews the date and the numbered songs with their author, and downloads a PNG', async () => {
  const canvas = fakeCanvas()
  stubShare({ services, extra: (url) => (url === '/api/services/s1/setlist' ? { body: setlist([song('a', 'Canción de ejemplo', 'Autora Uno'), { id: 'm', kind: 'MOMENT', song: null, moment: 'Ofrenda', key: null, link: null }, song('b', 'Himno ficticio', 'Autor Dos')]) } : undefined) })
  open('imagen')
  const paper = await screen.findByRole('region', { name: 'Vista previa del documento' })
  await waitFor(() => expect(paper.textContent).toContain('Canción de ejemplo (Autora Uno)'))
  expect(paper.textContent).toContain('Setlist · vie 20 nov')
  expect(paper.textContent).toContain('Himno ficticio (Autor Dos)')
  expect(paper.textContent).not.toContain('Ofrenda')
  // The nearest upcoming service is chosen; a cancelled one is never offered.
  const select = screen.getByLabelText('Servicio') as HTMLSelectElement
  expect([...select.options].map((option) => option.value)).toEqual(['s1', 's2'])
  fireEvent.click(screen.getByRole('button', { name: 'Descargar imagen' }))
  await waitFor(() => expect(canvas.downloads).toEqual(['setlist-2026-11-20.png']))
  expect(canvas.drawn).toEqual(['Setlist · vie 20 nov', 'Betel', '1', 'Canción de ejemplo (Autora Uno)', '2', 'Himno ficticio (Autor Dos)'])
})

test('a service without songs says so and cannot be turned into an image', async () => {
  stubShare({ services, extra: (url) => (url === '/api/services/s1/setlist' ? { body: setlist([{ id: 'm', kind: 'MOMENT', song: null, moment: 'Ofrenda', key: null, link: null }]) } : undefined) })
  open('imagen')
  expect(await screen.findByText('Este servicio aún no tiene canciones')).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Descargar imagen' }) as HTMLButtonElement).disabled).toBe(true)
})

test('sharing the image needs a browser that can share files, and says so when it cannot', async () => {
  fakeCanvas()
  stubShare({ services, extra: (url) => (url === '/api/services/s1/setlist' ? { body: setlist([song('a', 'Canción de ejemplo', 'Autora Uno')]) } : undefined) })
  open('imagen')
  await screen.findByText(/Canción de ejemplo \(Autora Uno\)/)
  fireEvent.click(screen.getByRole('button', { name: 'Compartir' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Este navegador no puede compartir la imagen')
  cleanup()
  const share = vi.fn(async () => undefined)
  Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true })
  Object.defineProperty(navigator, 'share', { value: share, configurable: true })
  stubShare({ services, extra: (url) => (url === '/api/services/s1/setlist' ? { body: setlist([song('a', 'Canción de ejemplo', 'Autora Uno')]) } : undefined) })
  open('imagen')
  await screen.findByText(/Canción de ejemplo \(Autora Uno\)/)
  fireEvent.click(screen.getByRole('button', { name: 'Compartir' }))
  await waitFor(() => expect(share).toHaveBeenCalledWith(expect.objectContaining({ files: [expect.any(File)] })))
  Reflect.deleteProperty(navigator, 'canShare')
  Reflect.deleteProperty(navigator, 'share')
})

test('the monthly rota shows «Rol alabanza», the month, a line per date, «No hay culto» and the message', async () => {
  const canvas = fakeCanvas()
  stubShare({ services, closed: [{ date: '2026-11-25', reason: 'Feriado' }] })
  open('rol')
  const paper = await screen.findByRole('region', { name: 'Vista previa del documento' })
  await waitFor(() => expect(paper.textContent).toContain('No hay culto · Feriado'))
  expect(paper.textContent).toContain('Ana Torres')
  expect(paper.textContent).toContain('Rol alabanza')
  expect(paper.textContent).toContain('Noviembre 2026')
  expect([...paper.querySelectorAll('dt')].map((node) => node.textContent)).toEqual(['vie 20 nov', 'mié 25 nov', 'vie 27 nov'])
  expect(paper.textContent).toContain('No hay culto · Feriado')
  fireEvent.change(screen.getByLabelText('Mensaje o versículo al pie (opcional)'), { target: { value: 'El Señor es mi luz' } })
  expect(paper.textContent).toContain('El Señor es mi luz')
  fireEvent.click(screen.getByRole('button', { name: 'Descargar imagen' }))
  await waitFor(() => expect(canvas.downloads).toEqual(['rol-alabanza-2026-11.png']))
  expect(canvas.drawn.at(-1)).toBe('El Señor es mi luz')
})

test('the PDF of the rota opens the browser print with the document as its title, and the image does not', async () => {
  const print = vi.fn()
  vi.stubGlobal('print', print)
  stubShare({ services })
  open('rol')
  await screen.findByText('Ana Torres')
  expect(screen.queryByRole('button', { name: 'Descargar PDF' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'PDF' }))
  expect(screen.getByText(/elige «Guardar como PDF»/)).toBeTruthy()
  const previous = document.title
  print.mockImplementation(() => { expect(document.title).toBe('Rol alabanza Noviembre 2026') })
  fireEvent.click(screen.getByRole('button', { name: 'Descargar PDF' }))
  expect(print).toHaveBeenCalledTimes(1)
  window.dispatchEvent(new Event('afterprint'))
  expect(document.title).toBe(previous)
})

test('only the paper prints: everything else carries the no-print class', async () => {
  stubShare({ services })
  open('rol')
  const paper = await screen.findByRole('region', { name: 'Vista previa del documento' })
  expect(paper.className).toContain('print-area')
  expect(paper.className).toContain('bg-[#ffffff]')
  const root = paper.closest('main')!.parentElement!
  const unprinted = [...root.children].filter((child) => child !== paper.closest('main'))
  expect(unprinted.length).toBeGreaterThan(0)
  for (const child of unprinted) expect(child.className).toContain('no-print')
  expect(paper.closest('main')!.querySelector(':scope > .no-print')).toBeTruthy()
})

test('a range without dates warns and offers nothing to download', async () => {
  stubShare({ services })
  open('rol')
  await screen.findByText('Ana Torres')
  fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2027-03-01' } })
  fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2027-03-31' } })
  expect(await screen.findByText('No hay fechas en este rango')).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Descargar imagen' }) as HTMLButtonElement).disabled).toBe(true)
})

const preachingData = {
  church: 'Betel', from: '2026-11-01', to: '2026-11-30',
  services: [
    { date: '2026-11-20', slot: 'SINGLE', preacher: 'Ricardo Soto', topic: 'La fidelidad en la espera', passages: ['Salmos 27:1-6', 'Hebreos 10:23'], notes: '- Esperar no es **pasividad**' },
    { date: '2026-11-27', slot: 'SINGLE', preacher: null, topic: 'Por definir', passages: [], notes: '' },
  ],
  closedDates: [{ date: '2026-11-25', reason: 'Feriado' }],
}

test('the preaching PDF lists date, preacher, topic, passages and the points, with «No hay culto», and prints', async () => {
  const print = vi.fn()
  vi.stubGlobal('print', print)
  const { calls } = stubShare({ church: { usesPreaching: true }, extra: (url) => (url.startsWith('/api/preaching-document') ? { body: preachingData } : undefined) })
  open('predicaciones')
  const paper = await screen.findByRole('region', { name: 'Vista previa del documento' })
  await waitFor(() => expect(paper.textContent).toContain('Ricardo Soto'))
  const rows = within(paper).getAllByRole('row').slice(1).map((row) => row.textContent)
  expect(rows).toEqual([
    expect.stringContaining('vie 20 novRicardo SotoLa fidelidad en la esperaSalmos 27:1-6 · Hebreos 10:23'),
    expect.stringContaining('mié 25 novNo hay culto · Feriado'),
    expect.stringContaining('vie 27 nov—Por definir'),
  ])
  expect(within(paper).getByText('pasividad').tagName).toBe('STRONG')
  expect(paper.textContent).toContain('Predicaciones')
  expect(calls).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: 'Descargar PDF' }))
  expect(print).toHaveBeenCalledTimes(1)
})

test('the preaching PDF is not offered when the church does not use preaching, and no data is requested', async () => {
  const requested = vi.fn()
  stubShare({ extra: (url) => { if (url.startsWith('/api/preaching-document')) requested(url); return undefined } })
  open('predicaciones')
  expect(await screen.findByText('Tu iglesia no usa la predicación')).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Descargar PDF' }) as HTMLButtonElement).disabled).toBe(true)
  expect(requested).not.toHaveBeenCalled()
})

test('the preaching PDF asks the API for the chosen range', async () => {
  const requested = vi.fn()
  stubShare({ church: { usesPreaching: true }, extra: (url) => { if (url.startsWith('/api/preaching-document')) { requested(url); return { body: { ...preachingData, services: [], closedDates: [] } } } return undefined } })
  open('predicaciones')
  await waitFor(() => expect(requested).toHaveBeenCalledWith('/api/preaching-document?from=2026-11-01&to=2026-11-30'))
  expect(await screen.findByText('No hay predicaciones en estas fechas')).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Descargar PDF' }) as HTMLButtonElement).disabled).toBe(true)
})

test('whoever cannot edit, and an unknown document, get a notice instead', async () => {
  stubShare({ church: { canEdit: false, canConfigure: false } })
  open('rol')
  expect(await screen.findByText('Solo para quien edita')).toBeTruthy()
  cleanup()
  stubShare({})
  open('otro')
  expect(await screen.findByText('No existe ese documento')).toBeTruthy()
})
