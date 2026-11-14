import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { CalendarPage } from '../calendar/CalendarPage'
import { service as calendarService, mount } from '../calendar/test-utils'
import { NewLinkPage } from './NewLinkPage'
import { SharePage } from './SharePage'
import { link, stubShare } from './share-test-utils'

vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken: async () => 'token-ficticio' }), UserButton: () => <button>Cuenta</button> }))

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-13T18:00:00Z') }) })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

const home = () => mount(<Routes><Route path="/compartir" element={<SharePage />} /><Route path="/compartir/enlace" element={<NewLinkPage />} /><Route path="/" element={<p>Calendario</p>} /></Routes>, '/compartir')
const create = () => mount(<Routes><Route path="/compartir" element={<SharePage />} /><Route path="/compartir/enlace" element={<NewLinkPage />} /></Routes>, '/compartir/enlace')
const services = [
  calendarService({ id: 's1', date: '2026-11-20', title: 'Servicio de viernes' }),
  calendarService({ id: 's2', date: '2026-11-27', title: 'Servicio de viernes' }),
  calendarService({ id: 's3', date: '2026-12-04', title: 'Servicio de viernes' }),
  calendarService({ id: 's4', date: '2026-11-29', title: 'Servicio cancelado', status: 'CANCELLED' }),
]
const requests = (calls: ReturnType<typeof stubShare>['calls'], method: string) => calls.filter((call) => call.method === method)

test('lists the links with their state, and says when there are none', async () => {
  stubShare({ links: [
    link(),
    link({ id: 'l2', version: 'PRAISE', scope: { kind: 'service', serviceId: 's1', date: '2026-11-20' }, status: 'REVOKED', path: null, canReactivate: true }),
    link({ id: 'l3', version: 'PREACHING', scope: { kind: 'range', from: '2026-10-01', to: '2026-10-31' }, status: 'EXPIRED', activeUntil: '2026-11-30', path: null, canReactivate: true }),
  ] })
  home()
  const rows = await screen.findAllByRole('listitem')
  expect(rows.map((row) => row.textContent)).toEqual([
    'Servicio completo · Diciembre 2026Activo hasta 26 ene 2027Activo',
    'Alabanza · vie 20 novRevocado a manoDesactivado',
    'Predicación · Octubre 2026Venció el 1 dic 2026Desactivado',
  ])
  cleanup()
  stubShare({ links: [] })
  home()
  expect(await screen.findByText('Aún no hay enlaces. Los que crees aparecerán aquí.')).toBeTruthy()
})

test('a failed list is announced and can be retried', async () => {
  stubShare({ links: 500 })
  home()
  expect((await screen.findByRole('alert')).textContent).toContain('No se pudieron cargar los enlaces')
  expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
})

test('whoever cannot edit sees a notice and the API is never asked for links', async () => {
  const { calls } = stubShare({ church: { canEdit: false, canConfigure: false } })
  home()
  expect(await screen.findByText('Solo para quien edita')).toBeTruthy()
  expect(screen.queryByRole('button', { name: /Enlace para el ministerio/ })).toBeNull()
  expect(calls).toEqual([])
})

test('an active link is copied from its sheet with the address of this page', async () => {
  stubShare({ links: [link()] })
  const writeText = vi.fn(async () => undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  home()
  fireEvent.click(await screen.findByRole('button', { name: /Servicio completo · Diciembre 2026/ }))
  const sheet = await screen.findByRole('dialog')
  expect(within(sheet).getByText(`${window.location.origin}${link().path}`)).toBeTruthy()
  fireEvent.click(within(sheet).getByRole('button', { name: 'Copiar enlace' }))
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}${link().path}`))
  expect(await screen.findByText('Enlace copiado')).toBeTruthy()
})

test('a copy that fails is said, not hidden', async () => {
  stubShare({ links: [link()] })
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(async () => { throw new Error('denied') }) }, configurable: true })
  home()
  fireEvent.click(await screen.findByRole('button', { name: /Servicio completo/ }))
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Copiar enlace' }))
  expect((await screen.findByRole('alert')).textContent).toContain('No se pudo copiar')
})

test('revoking asks first, then the link shows as deactivated and offers reactivation', async () => {
  const { calls } = stubShare({ links: [link()] })
  home()
  fireEvent.click(await screen.findByRole('button', { name: /Servicio completo/ }))
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Revocar enlace' }))
  expect(screen.getByText('Quien tenga este enlace dejará de verlo de inmediato.')).toBeTruthy()
  expect(requests(calls, 'POST')).toHaveLength(0)
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'No revocar' }))
  expect(screen.getByRole('button', { name: 'Copiar enlace' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Revocar enlace' }))
  fireEvent.click(screen.getByRole('button', { name: 'Revocar enlace' }))
  expect(await screen.findByText('Enlace revocado')).toBeTruthy()
  expect(requests(calls, 'POST').map((call) => call.url)).toEqual(['/api/share-links/l1/revoke'])
  const row = (await screen.findByRole('button', { name: /Servicio completo/ }))
  expect(row.textContent).toContain('Revocado a mano')
  expect(row.textContent).toContain('Desactivado')
})

test('a deactivated link is reactivated for 30 days; one already reactivated is not offered again', async () => {
  const { calls } = stubShare({ links: [link({ status: 'EXPIRED', path: null, canReactivate: true, activeUntil: '2026-11-12' }), link({ id: 'l2', version: 'PRAISE', status: 'REVOKED', path: null, reactivated: true, canReactivate: false })] })
  home()
  fireEvent.click(await screen.findByRole('button', { name: /^Alabanza ·/ }))
  expect(within(await screen.findByRole('dialog')).queryByRole('button', { name: /Reactivar/ })).toBeNull()
  expect(screen.getByText(/Ya se reactivó una vez/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  fireEvent.click(screen.getByRole('button', { name: /Servicio completo/ }))
  expect(screen.getByText(/Puedes reactivarlo por otros 30 días, solo para consulta/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Reactivar por 30 días' }))
  expect(await screen.findByText('Reactivado por 30 días')).toBeTruthy()
  expect(requests(calls, 'POST').map((call) => call.url)).toEqual(['/api/share-links/l1/reactivate'])
  expect((await screen.findByRole('button', { name: /Servicio completo/ })).textContent).toContain('Activo hasta 13 dic 2026')
})

test('a refused change is explained in the sheet', async () => {
  stubShare({ links: [link({ status: 'EXPIRED', path: null, canReactivate: true })], reactivate: () => ({ status: 409, body: { error: 'Reactivation used' } }) })
  home()
  fireEvent.click(await screen.findByRole('button', { name: /Servicio completo/ }))
  fireEvent.click(await screen.findByRole('button', { name: 'Reactivar por 30 días' }))
  expect((await screen.findByRole('alert')).textContent).toContain('ya se reactivó una vez')
})

test('a new link for a range shows how many services it covers and until when, and sends exactly that', async () => {
  const { calls } = stubShare({ services, church: { usesPreaching: true } })
  create()
  fireEvent.change(await screen.findByLabelText('Desde'), { target: { value: '2026-11-01' } })
  fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-11-30' } })
  // The cancelled service of the 29th does not count: the last one is the 27th.
  expect(await screen.findByText('2 servicios · activo hasta 27 dic 2026')).toBeTruthy()
  expect(screen.getByRole('radio', { name: /Servicio completo/ }).getAttribute('aria-checked')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: 'Crear enlace' }))
  expect(await screen.findByText('Enlace creado')).toBeTruthy()
  expect(requests(calls, 'POST')[0]?.body).toEqual({ version: 'FULL', scope: { kind: 'range', from: '2026-11-01', to: '2026-11-30' }, blocks: { keys: false, notes: true, people: true } })
  expect(within(screen.getByRole('dialog')).getByText(new RegExp(`^${window.location.origin}/m/`))).toBeTruthy()
})

test('versions decide the blocks: tones never for preaching, notes never for praise, and nothing off-version is sent', async () => {
  const { calls } = stubShare({ services, church: { usesPreaching: true } })
  create()
  await screen.findByText(/servicios? · activo hasta/)
  fireEvent.click(screen.getByRole('switch', { name: 'Tonos y BPM' }))
  fireEvent.click(screen.getByRole('radio', { name: /Predicación/ }))
  expect(screen.queryByRole('switch', { name: 'Tonos y BPM' })).toBeNull()
  expect(screen.getByRole('switch', { name: 'Notas de predicación' })).toBeTruthy()
  fireEvent.click(screen.getByRole('radio', { name: /Alabanza/ }))
  expect(screen.queryByRole('switch', { name: 'Notas de predicación' })).toBeNull()
  expect(screen.getByRole('switch', { name: 'Tonos y BPM' }).getAttribute('aria-checked')).toBe('true')
  fireEvent.click(screen.getByRole('radio', { name: /Predicación/ }))
  fireEvent.click(screen.getByRole('switch', { name: 'Quién dirige y predica' }))
  fireEvent.click(screen.getByRole('button', { name: 'Crear enlace' }))
  await screen.findByText('Enlace creado')
  expect(requests(calls, 'POST')[0]?.body).toMatchObject({ version: 'PREACHING', blocks: { keys: false, notes: true, people: false } })
})

test('tones start off, and the preaching version and notes disappear when the church does not use preaching', async () => {
  stubShare({ services })
  create()
  await screen.findByText(/servicios? · activo hasta/)
  expect(screen.queryByRole('radio', { name: /^Predicación/ })).toBeNull()
  expect(screen.queryByRole('switch', { name: 'Notas de predicación' })).toBeNull()
  expect(screen.getByRole('switch', { name: 'Tonos y BPM' }).getAttribute('aria-checked')).toBe('false')
})

test('one service is chosen from the upcoming ones, never a cancelled one', async () => {
  const { calls } = stubShare({ services })
  create()
  fireEvent.click(await screen.findByRole('button', { name: 'Un servicio' }))
  const select = await screen.findByLabelText('Servicio') as HTMLSelectElement
  await waitFor(() => expect(select.options.length).toBe(3))
  expect([...select.options].map((option) => option.textContent)).toEqual(['vie 20 nov · Servicio de viernes', 'vie 27 nov · Servicio de viernes', 'vie 4 dic · Servicio de viernes'])
  fireEvent.change(select, { target: { value: 's2' } })
  expect(await screen.findByText('1 servicio · activo hasta 27 dic 2026')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Crear enlace' }))
  await screen.findByText('Enlace creado')
  expect(requests(calls, 'POST')[0]?.body).toMatchObject({ scope: { kind: 'service', serviceId: 's2' } })
})

test('a range without services warns and cannot be created; a reversed one says why', async () => {
  const { calls } = stubShare({ services })
  create()
  fireEvent.change(await screen.findByLabelText('Desde'), { target: { value: '2027-03-01' } })
  fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2027-03-31' } })
  expect(await screen.findByText('No hay servicios en estas fechas')).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Crear enlace' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2027-02-01' } })
  expect(await screen.findByText('Debe ser posterior a «Desde».')).toBeTruthy()
  expect(requests(calls, 'POST')).toHaveLength(0)
})

test('a server refusal is explained and nothing is shown as created', async () => {
  stubShare({ services, create: () => ({ status: 400, body: { error: 'Scope in the past' } }) })
  create()
  fireEvent.change(await screen.findByLabelText('Hasta'), { target: { value: '2026-12-31' } })
  fireEvent.click(await screen.findByRole('button', { name: 'Crear enlace' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Esas fechas ya pasaron')
  expect(screen.queryByText('Enlace creado')).toBeNull()
})

test('the created sheet closes back to the list of links', async () => {
  stubShare({ services, links: [] })
  create()
  await screen.findByText(/servicios? · activo hasta/)
  fireEvent.click(await screen.findByRole('button', { name: 'Crear enlace' }))
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Listo' }))
  expect(await screen.findByRole('heading', { name: 'Compartir' })).toBeTruthy()
})

test('the calendar offers «Compartir» to whoever edits and not to members', async () => {
  stubShare({})
  mount(<Routes><Route path="/compartir" element={<p>Pantalla compartir</p>} /><Route path="*" element={<CalendarPage />} /></Routes>)
  fireEvent.click(await screen.findByRole('button', { name: 'Compartir' }))
  expect(await screen.findByText('Pantalla compartir')).toBeTruthy()
  cleanup()
  stubShare({ church: { canEdit: false, canConfigure: false } })
  mount(<CalendarPage />)
  await screen.findByRole('heading', { level: 1 })
  expect(screen.queryByRole('button', { name: 'Compartir' })).toBeNull()
})
