import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { HomePage } from './HomePage'
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
const openCalendar = async () => fireEvent.click(await screen.findByRole('button', { name: /Noviembre 2026/ }))

test('lists the upcoming services as cards with date, time and director, soonest first, and hides what passed', async () => {
  stubApi({ services })
  mount(<HomePage />)
  const card = await screen.findByRole('link', { name: /Servicio de viernes/ })
  expect(within(card).getByText('Ana Ramírez')).toBeTruthy()
  expect(within(card).getByText('Borrador')).toBeTruthy()
  expect(screen.getByText('Próximos servicios')).toBeTruthy()
  expect(screen.getAllByRole('link', { name: /,/ }).map((item) => item.getAttribute('aria-label'))).toEqual([
    expect.stringContaining('Servicio de viernes'), expect.stringContaining('Viernes cancelado'), expect.stringContaining('Servicio de diciembre'),
  ])
  expect(screen.queryByText('Servicio pasado')).toBeNull()
})

test('the month grid is collapsed by default, marks every state in text, and opens with the title', async () => {
  stubApi({ services })
  mount(<HomePage />)
  const toggle = await screen.findByRole('button', { name: /Noviembre 2026/ })
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  expect(await screen.findByText('3 servicios')).toBeTruthy()
  fireEvent.click(toggle)
  expect(toggle.getAttribute('aria-expanded')).toBe('true')
  const grid = await screen.findByRole('group', { name: 'Días de Noviembre 2026' })
  expect(within(grid).getByRole('button', { name: /13 de noviembre: Servicio de viernes, Borrador/ })).toBeTruthy()
  expect(within(grid).getByRole('button', { name: /20 de noviembre: Viernes cancelado, Cancelado/ })).toBeTruthy()
  expect(grid.firstElementChild?.textContent).toContain('1') // 1 de noviembre de 2026 es domingo: abre la primera columna
})

test('navigates between months, loads each from the API, and shows that month in full', async () => {
  const calls = stubApi({ services })
  mount(<HomePage />)
  await openCalendar()
  fireEvent.click(await screen.findByRole('button', { name: 'Mes siguiente' }))
  expect(await screen.findByRole('button', { name: /Diciembre 2026/ })).toBeTruthy()
  expect(await screen.findByText('Servicios de diciembre')).toBeTruthy()
  expect(await screen.findByRole('link', { name: /Servicio de diciembre/ })).toBeTruthy()
  expect(calls.map((call) => call.url)).toContain('/api/services?month=2026-12')
  fireEvent.click(screen.getByRole('button', { name: 'Hoy' }))
  expect(await screen.findByText('Próximos servicios')).toBeTruthy()
})

test('a card and a day with a service lead to the service screen', async () => {
  stubApi({ services })
  mount(<Routes><Route path="/servicios/:serviceId" element={<p>Pantalla del servicio</p>} /><Route path="/" element={<HomePage />} /></Routes>)
  fireEvent.click(await screen.findByRole('link', { name: /Servicio de viernes/ }))
  expect(await screen.findByText('Pantalla del servicio')).toBeTruthy()
  cleanup()
  stubApi({ services })
  mount(<Routes><Route path="/servicios/:serviceId" element={<p>Pantalla del servicio</p>} /><Route path="/" element={<HomePage />} /></Routes>)
  fireEvent.click(await screen.findByRole('button', { name: /13 de noviembre: Servicio de viernes/ }))
  expect(await screen.findByText('Pantalla del servicio')).toBeTruthy()
})

test('a reader sees the same cards without creation, and an empty state without the shortcut', async () => {
  stubApi({ services: [], church: { ...church, canEdit: false, canConfigure: false } })
  mount(<HomePage />)
  expect(await screen.findByText('No hay servicios próximos')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Nuevo' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Crear servicio' })).toBeNull()
  cleanup()
  stubApi({ services: [] })
  mount(<HomePage />)
  expect(await screen.findByText('No hay servicios próximos')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Crear servicio' })).toBeTruthy()
})

test('offers creation to editors in the header', async () => {
  stubApi({ services })
  mount(<HomePage />)
  expect(await screen.findByRole('button', { name: 'Nuevo' })).toBeTruthy()
})

test('the mobile bar has the same sections for every role, and «Más» only when it has something', async () => {
  stubApi({ church: { ...church, canEdit: false, canConfigure: false } })
  mount(<HomePage />)
  const bar = await screen.findByRole('navigation', { name: 'Principal' })
  expect(within(bar).getAllByRole('button').map((button) => button.textContent)).toEqual(['Inicio', 'Canciones', 'Personas'])
  cleanup()
  stubApi({})
  mount(<HomePage />)
  expect(within(await screen.findByRole('navigation', { name: 'Principal' })).getAllByRole('button').map((button) => button.textContent)).toEqual(['Inicio', 'Canciones', 'Personas', 'Más'])
})

test.each([
  [404, 'Sin iglesia asignada'],
  [409, 'Varias iglesias'],
  [503, 'No se pudo cargar tu iglesia'],
])('explains church context failure %i', async (status, title) => {
  stubApi({ church: status })
  mount(<HomePage />)
  expect(await screen.findByText(title)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Nuevo' })).toBeNull()
})

const closed = [{ date: '2026-11-27', reason: 'Feriado' }, { date: '2026-11-18', reason: null }, { date: '2026-11-04', reason: null }]
const writes = (calls: ReturnType<typeof stubApi>) => calls.filter((call) => call.init?.method === 'PUT' || call.init?.method === 'DELETE')

test('shows a closed date in the grid, the agenda and the day detail with the «No hay culto» legend', async () => {
  stubApi({ services, closed })
  mount(<HomePage />)
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

test('a free future date offers «Crear servicio» as the main action, before marking «No hay culto»', async () => {
  stubApi({ services })
  mount(<HomePage />)
  fireEvent.click(await screen.findByRole('button', { name: /25 de noviembre: sin servicio/ }))
  const sheet = await screen.findByRole('dialog')
  const names = within(sheet).getAllByRole('button').map((button) => button.textContent)
  expect(names.indexOf('Crear servicio')).toBeGreaterThanOrEqual(0)
  expect(names.indexOf('Crear servicio')).toBeLessThan(names.indexOf('Marcar «No hay culto»'))
})

test('an editor marks a free future date with a reason and the calendar reloads', async () => {
  const calls = stubApi({ services })
  mount(<HomePage />)
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
  mount(<HomePage />)
  fireEvent.click(await screen.findByRole('button', { name: /27 de noviembre: No hay culto/ }))
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Desmarcar fecha' }))
  expect(await screen.findByText('Fecha desmarcada')).toBeTruthy()
  expect(writes(calls).map((call) => `${call.init?.method} ${call.url}`)).toEqual(['DELETE /api/closed-dates/2026-11-27'])
})

test('past and service dates cannot be marked; the grid offers marking only for free dates from today', async () => {
  stubApi({ services })
  mount(<HomePage />)
  const grid = await screen.findByRole('group', { name: 'Días de Noviembre 2026' })
  expect(await within(grid).findByRole('button', { name: /13 de noviembre: Servicio de viernes/ })).toBeTruthy()
  expect(within(grid).queryByRole('button', { name: /10 de noviembre/ })).toBeNull() // pasado
  expect(within(grid).queryByRole('button', { name: /12 de noviembre: sin servicio/ })).toBeNull() // pasado
  expect(within(grid).queryByRole('button', { name: /14 de noviembre: sin servicio/ })).not.toBeNull()
  // Un día con servicio abre el servicio, no la hoja de marcar: no hay forma de marcar una fecha que ya lo tiene.
  fireEvent.click(await within(grid).findByRole('button', { name: /20 de noviembre: Viernes cancelado/ }))
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('a member only reads closed dates: no marking, no unmarking', async () => {
  stubApi({ services, closed, church: { ...church, canEdit: false } })
  mount(<HomePage />)
  const grid = await screen.findByRole('group', { name: 'Días de Noviembre 2026' })
  expect(within(grid).queryByRole('button', { name: /25 de noviembre: sin servicio/ })).toBeNull()
  fireEvent.click(await within(grid).findByRole('button', { name: /27 de noviembre: No hay culto/ }))
  const sheet = await screen.findByRole('dialog', { name: 'No hay culto' })
  expect(within(sheet).queryByRole('button', { name: 'Desmarcar fecha' })).toBeNull()
})

test('shows the server rejection when the date got a service meanwhile', async () => {
  stubApi({ services, mark: () => ({ status: 409, body: { error: 'Date has service' } }) })
  mount(<HomePage />)
  fireEvent.click(await screen.findByRole('button', { name: /25 de noviembre: sin servicio/ }))
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Marcar «No hay culto»' }))
  expect((await screen.findByRole('alert')).textContent).toContain('ya tiene un servicio')
})

test('the «Más» sheet offers settings only to the church administrator', async () => {
  stubApi({})
  mount(<HomePage />)
  fireEvent.click(within(await screen.findByRole('navigation', { name: 'Principal' })).getByRole('button', { name: 'Más' }))
  expect(within(screen.getByRole('dialog', { name: 'Más' })).getByRole('button', { name: 'Ajustes' })).toBeTruthy()
  cleanup()
  stubApi({ church: { ...church, canConfigure: false } })
  mount(<HomePage />)
  fireEvent.click(within(await screen.findByRole('navigation', { name: 'Principal' })).getByRole('button', { name: 'Más' }))
  expect(within(screen.getByRole('dialog', { name: 'Más' })).queryByRole('button', { name: 'Ajustes' })).toBeNull()
})
