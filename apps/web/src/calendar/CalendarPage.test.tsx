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
  fireEvent.click(await screen.findByRole('button', { name: /13 de noviembre/ }))
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
