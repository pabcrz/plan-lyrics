import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { CalendarPage } from './CalendarPage'
import { church, mount, service, stubApi } from './test-utils'

vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken: async () => 'token-ficticio' }), UserButton: () => <button>Cuenta</button> }))

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-13T18:00:00Z') }) })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

const services = [
  service({ id: 'a', date: '2026-11-06', title: 'Servicio pasado', status: 'COMPLETED' }),
  service({ id: 'b', date: '2026-11-13', title: 'Servicio de viernes', status: 'DRAFT' }),
  service({ id: 'c', date: '2026-11-20', title: 'Viernes cancelado', status: 'CANCELLED', time: null }),
  service({ id: 'd', date: '2026-12-04', title: 'Servicio de diciembre', status: 'PUBLISHED' }),
]

test('shows the month grid with a status mark in text, Sunday first, and the month agenda', async () => {
  stubApi({ services })
  mount(<CalendarPage />)
  expect(await screen.findByRole('heading', { name: 'Noviembre 2026' })).toBeTruthy()
  const grid = await screen.findByRole('group', { name: 'Días de Noviembre 2026' })
  expect(within(grid).getByRole('button', { name: /13 de noviembre: Servicio de viernes, Borrador/ })).toBeTruthy()
  expect(within(grid).getByRole('button', { name: /20 de noviembre: Viernes cancelado, Cancelado/ })).toBeTruthy()
  expect(grid.firstElementChild?.textContent).toContain('1') // 1 de noviembre de 2026 es domingo: abre la primera columna
  expect(screen.getByText('Próximos servicios')).toBeTruthy()
  expect(screen.queryByText('Servicio pasado')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Ver anteriores (1)' }))
  expect(screen.getByText('Servicio pasado')).toBeTruthy()
})

test('navigates between months and loads each month from the API', async () => {
  const calls = stubApi({ services })
  mount(<CalendarPage />)
  await screen.findByText('Servicio de viernes', { selector: 'span' })
  fireEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }))
  expect(await screen.findByRole('heading', { name: 'Diciembre 2026' })).toBeTruthy()
  expect(await screen.findByText('Servicio de diciembre')).toBeTruthy()
  expect(calls.map((call) => call.url)).toContain('/api/services?month=2026-12')
  fireEvent.click(screen.getByRole('button', { name: 'Hoy' }))
  expect(await screen.findByRole('heading', { name: 'Noviembre 2026' })).toBeTruthy()
})

test('opens the service detail with its director', async () => {
  stubApi({ services })
  mount(<CalendarPage />)
  fireEvent.click(await screen.findByRole('button', { name: /13 de noviembre: Servicio de viernes/ }))
  const sheet = await screen.findByRole('dialog')
  expect(within(sheet).getByText('Dirección')).toBeTruthy()
  expect(within(sheet).getByText('Ana Ramírez')).toBeTruthy()
  expect(within(sheet).getByText('Borrador')).toBeTruthy()
})

test('shows an empty month, and hides creation from members who can only read', async () => {
  stubApi({ services: [], church: { ...church, canEdit: false } })
  mount(<CalendarPage />)
  expect(await screen.findByText(/No hay servicios en noviembre 2026/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Nuevo' })).toBeNull()
})

test('offers creation to editors', async () => {
  stubApi({ services })
  mount(<CalendarPage />)
  expect(await screen.findByRole('button', { name: 'Nuevo' })).toBeTruthy()
})

test.each([
  [404, 'Sin iglesia asignada'],
  [409, 'Varias iglesias'],
  [503, 'No se pudo cargar tu iglesia'],
])('explains church context failure %i', async (status, title) => {
  stubApi({ church: status })
  mount(<CalendarPage />)
  expect(await screen.findByText(title)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Nuevo' })).toBeNull()
})

const closed = [{ date: '2026-11-27', reason: 'Feriado' }, { date: '2026-11-18', reason: null }, { date: '2026-11-04', reason: null }]
const writes = (calls: ReturnType<typeof stubApi>) => calls.filter((call) => call.init?.method === 'PUT' || call.init?.method === 'DELETE')

test('shows a closed date in the grid, the agenda and the day detail with the «No hay culto» legend', async () => {
  stubApi({ services, closed })
  mount(<CalendarPage />)
  const grid = await screen.findByRole('group', { name: 'Días de Noviembre 2026' })
  const cell = await within(grid).findByRole('button', { name: /27 de noviembre: No hay culto, Feriado/ })
  expect(cell.textContent).toContain('27')
  const agenda = screen.getByRole('list')
  expect(within(agenda).getAllByText('No hay culto')).toHaveLength(2) // los pasados quedan ocultos
  expect(within(agenda).getByText('Feriado')).toBeTruthy()
  fireEvent.click(cell)
  const sheet = await screen.findByRole('dialog', { name: 'No hay culto' })
  expect(within(sheet).getByText('Feriado')).toBeTruthy()
  expect(within(sheet).getByText(/viernes,? 27 de noviembre/)).toBeTruthy()
  // No es un servicio cancelado: no se muestra con el estado «Cancelado».
  expect(within(sheet).queryByText('Cancelado')).toBeNull()
})

test('an editor marks a free future date with a reason and the calendar reloads', async () => {
  const calls = stubApi({ services })
  mount(<CalendarPage />)
  fireEvent.click(await screen.findByRole('button', { name: /25 de noviembre: sin servicio/ }))
  const sheet = await screen.findByRole('dialog')
  fireEvent.change(within(sheet).getByLabelText(/Motivo/), { target: { value: ' Feriado ' } })
  fireEvent.click(within(sheet).getByRole('button', { name: 'Marcar «No hay culto»' }))
  expect(await screen.findByText('Fecha marcada como «No hay culto»')).toBeTruthy()
  const [write] = writes(calls)
  expect(write.url).toBe('/api/closed-dates/2026-11-25')
  expect(write.init?.method).toBe('PUT')
  expect(JSON.parse(write.init!.body as string)).toEqual({ reason: 'Feriado' })
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('an editor unmarks a closed date', async () => {
  const calls = stubApi({ services, closed })
  mount(<CalendarPage />)
  fireEvent.click(await screen.findByRole('button', { name: /27 de noviembre: No hay culto/ }))
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Desmarcar fecha' }))
  expect(await screen.findByText('Fecha desmarcada')).toBeTruthy()
  expect(writes(calls).map((call) => `${call.init?.method} ${call.url}`)).toEqual(['DELETE /api/closed-dates/2026-11-27'])
})

test('past and service dates cannot be marked; the grid offers marking only for free dates from today', async () => {
  stubApi({ services })
  mount(<CalendarPage />)
  const grid = await screen.findByRole('group', { name: 'Días de Noviembre 2026' })
  expect(await within(grid).findByRole('button', { name: /13 de noviembre: Servicio de viernes/ })).toBeTruthy()
  expect(within(grid).queryByRole('button', { name: /10 de noviembre/ })).toBeNull() // pasado
  expect(within(grid).queryByRole('button', { name: /12 de noviembre: sin servicio/ })).toBeNull() // pasado
  expect(within(grid).queryByRole('button', { name: /14 de noviembre: sin servicio/ })).not.toBeNull()
  fireEvent.click(await within(grid).findByRole('button', { name: /20 de noviembre: Viernes cancelado/ }))
  expect(within(await screen.findByRole('dialog')).queryByRole('button', { name: 'Marcar «No hay culto»' })).toBeNull()
})

test('a member only reads closed dates: no marking, no unmarking', async () => {
  stubApi({ services, closed, church: { ...church, canEdit: false } })
  mount(<CalendarPage />)
  const grid = await screen.findByRole('group', { name: 'Días de Noviembre 2026' })
  expect(within(grid).queryByRole('button', { name: /25 de noviembre: sin servicio/ })).toBeNull()
  fireEvent.click(await within(grid).findByRole('button', { name: /27 de noviembre: No hay culto/ }))
  const sheet = await screen.findByRole('dialog', { name: 'No hay culto' })
  expect(within(sheet).queryByRole('button', { name: 'Desmarcar fecha' })).toBeNull()
})

test('shows the server rejection when the date got a service meanwhile', async () => {
  stubApi({ services, mark: () => ({ status: 409, body: { error: 'Date has service' } }) })
  mount(<CalendarPage />)
  fireEvent.click(await screen.findByRole('button', { name: /25 de noviembre: sin servicio/ }))
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Marcar «No hay culto»' }))
  expect((await screen.findByRole('alert')).textContent).toContain('ya tiene un servicio')
})
