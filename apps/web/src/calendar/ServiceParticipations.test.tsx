import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { CalendarPage } from './CalendarPage'
import type { Assignment, Turn, Who } from './participations-api'
import { church, detail, mount, service, stubApi } from './test-utils'

vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken: async () => 'token-ficticio' }), UserButton: () => <button>Cuenta</button> }))

// Viernes 13 de noviembre de 2026.
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-13T18:00:00Z') }) })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

const [ana, luis, pedro, juan]: Who[] = [{ id: 'p1', name: 'Ana Ramírez' }, { id: 'p2', name: 'Luis Herrera' }, { id: 'p3', name: 'Pedro Castillo' }, { id: 'p4', name: 'Juan Pérez' }]
const directory = [ana, luis, pedro, juan].map((person) => detail(person))
const row = (id: string, roleName: string, person: Who | null, over: Partial<Assignment> = {}): Assignment => ({
  id, roleId: `r-${roleName}`, roleName, source: 'HABITUAL', pending: null, person, proposed: null, ...over,
})
const turns: Turn[] = [
  { id: 't-this', serviceId: 's1', date: '2026-11-13', slot: 'SINGLE', person: luis },
  { id: 't-next', serviceId: 's2', date: '2026-11-20', slot: 'SINGLE', person: pedro },
  { id: 't-last', serviceId: 's3', date: '2026-11-27', slot: 'SINGLE', person: juan },
]
const friday = service({ id: 's1', date: '2026-11-13', title: 'Servicio de viernes' })
const base = {
  services: [friday], directory,
  assignments: { s1: [row('a-voices', 'Voces', luis, { source: 'ROTATION' }), row('a-guitar', 'Guitarra', ana)] },
  turns,
}

async function openService(over: Parameters<typeof stubApi>[0] = {}) {
  const calls = stubApi({ ...base, ...over })
  mount(<Routes><Route path="*" element={<CalendarPage />} /></Routes>)
  fireEvent.click(await screen.findByRole('button', { name: /13 de noviembre: Servicio de viernes/ }))
  const sheet = await screen.findByRole('dialog', { name: 'Servicio de viernes' })
  await waitFor(() => expect(within(sheet).queryByText('Cargando participaciones…')).toBeNull())
  return { calls, sheet: within(sheet) }
}
const changes = (calls: ReturnType<typeof stubApi>) => calls.filter((call) => call.init?.method && call.init.method !== 'GET' && call.url.startsWith('/api/assignments') || call.url.endsWith('/assignments') && call.init?.method === 'POST')

test('the service detail lists each role with its person', async () => {
  const { sheet } = await openService()
  expect(sheet.getByText('Participaciones')).toBeTruthy()
  const items = sheet.getAllByRole('listitem').map((item) => item.textContent)
  expect(items).toEqual(['VocesLuis HerreraCambiar', 'GuitarraAna RamírezCambiar'])
})

test('a role left without a person is a pending marker that says why, with no priority invented', async () => {
  const { sheet } = await openService({ assignments: { s1: [
    row('a-1', 'Piano', null, { pending: 'COMBINATION', proposed: ana }), row('a-2', 'Voces', luis),
  ] } })
  const pending = sheet.getByRole('button', { name: 'Piano: pendiente. Cambiar' }).closest('li')!
  expect(within(pending).getByText('Pendiente')).toBeTruthy()
  expect(pending.textContent).toContain('Ana Ramírez coincide aquí con otro rol que esta iglesia no permite combinar en el mismo servicio.')
  expect(pending.textContent).toContain('Todavía no hay una regla para decidir cuál conserva')
})

test('replacing is the default change, changes one service only and swaps nothing', async () => {
  const { calls, sheet } = await openService()
  fireEvent.click(sheet.getByRole('button', { name: 'Voces: Luis Herrera. Cambiar' }))
  const change = within(screen.getByRole('dialog', { name: 'Voces' }))
  expect(change.getByText(/Ahora: Luis Herrera/)).toBeTruthy()
  expect(change.getByRole('button', { name: 'Solo este servicio' }).getAttribute('aria-pressed')).toBe('true')
  expect(await change.findByRole('button', { name: /Juan Pérez/ })).toBeTruthy()
  expect(change.queryByRole('button', { name: /Luis Herrera/ })).toBeNull()
  const confirm = change.getByRole('button', { name: 'Reemplazar solo aquí' }) as HTMLButtonElement
  expect(confirm.disabled).toBe(true)
  fireEvent.click(await change.findByRole('button', { name: /Juan Pérez/ }))
  fireEvent.click(confirm)
  await waitFor(() => expect(changes(calls)).toHaveLength(1))
  const [put] = changes(calls)
  expect([put.init?.method, put.url, JSON.parse(String(put.init?.body))]).toEqual(['PUT', '/api/assignments/a-voices', { personId: 'p4' }])
  expect(calls.some((call) => call.url === '/api/assignments/swap')).toBe(false)
  expect(await screen.findByText('Participación reemplazada solo en este servicio')).toBeTruthy()
})

test('swapping shows both dates and people before confirming, and nothing is sent until then', async () => {
  const { calls, sheet } = await openService()
  fireEvent.click(sheet.getByRole('button', { name: 'Voces: Luis Herrera. Cambiar' }))
  const change = within(screen.getByRole('dialog', { name: 'Voces' }))
  fireEvent.click(change.getByRole('button', { name: 'Intercambiar turnos' }))
  const options = within(await change.findByRole('list', { name: 'Turnos del mismo rol' })).getAllByRole('button').map((button) => button.textContent)
  // El propio turno no se ofrece.
  expect(options).toEqual(['vie 20 novPedro Castillo', 'vie 27 novJuan Pérez'])
  const confirm = change.getByRole('button', { name: 'Confirmar intercambio' }) as HTMLButtonElement
  expect(confirm.disabled).toBe(true)
  fireEvent.click(change.getByRole('button', { name: /vie 20 nov/ }))
  expect(change.getByText('Luis Herrera ↔ Pedro Castillo')).toBeTruthy()
  expect(change.getByText(/vie 13 nov pasa a Pedro Castillo · vie 20 nov pasa a Luis Herrera/)).toBeTruthy()
  expect(changes(calls)).toHaveLength(0)
  fireEvent.click(confirm)
  await waitFor(() => expect(changes(calls)).toHaveLength(1))
  const [swap] = changes(calls)
  expect([swap.init?.method, swap.url, JSON.parse(String(swap.init?.body))]).toEqual(['POST', '/api/assignments/swap', { first: 'a-voices', second: 't-next' }])
  expect(await screen.findByText('Turnos intercambiados')).toBeTruthy()
})

test('with no other turn of the role there is nothing to swap with', async () => {
  const { sheet } = await openService({ turns: [turns[0]] })
  fireEvent.click(sheet.getByRole('button', { name: 'Voces: Luis Herrera. Cambiar' }))
  const change = within(screen.getByRole('dialog', { name: 'Voces' }))
  fireEvent.click(change.getByRole('button', { name: 'Intercambiar turnos' }))
  expect(await change.findByText('No hay otros turnos próximos de este rol con los que intercambiar.')).toBeTruthy()
  expect((change.getByRole('button', { name: 'Confirmar intercambio' }) as HTMLButtonElement).disabled).toBe(true)
})

test('a pending role can only be filled by replacing: swapping needs a person', async () => {
  const { sheet } = await openService({ assignments: { s1: [row('a-1', 'Piano', null, { pending: 'COMBINATION', proposed: ana }), row('a-2', 'Voces', luis)] } })
  fireEvent.click(sheet.getByRole('button', { name: 'Piano: pendiente. Cambiar' }))
  const change = within(screen.getByRole('dialog', { name: 'Piano' }))
  expect(change.getByText(/Sin persona asignada · viernes,? 13 de noviembre/)).toBeTruthy()
  expect(change.queryByRole('button', { name: 'Intercambiar turnos' })).toBeNull()
})

test('a refused change explains why and keeps the sheet open', async () => {
  const { sheet } = await openService({ assignmentChange: () => ({ status: 409, body: { error: 'Combination not allowed' } }) })
  fireEvent.click(sheet.getByRole('button', { name: 'Guitarra: Ana Ramírez. Cambiar' }))
  const change = within(screen.getByRole('dialog', { name: 'Guitarra' }))
  fireEvent.click(await change.findByRole('button', { name: /Juan Pérez/ }))
  fireEvent.click(change.getByRole('button', { name: 'Reemplazar solo aquí' }))
  expect((await change.findByRole('alert')).textContent).toBe('Esa persona no puede tener esos dos roles a la vez en el mismo servicio.')
  expect(screen.getByRole('dialog', { name: 'Guitarra' })).toBeTruthy()
})

test('a role removed from the church leaves a marker that can only be taken off', async () => {
  const { calls, sheet } = await openService({ assignments: { s1: [row('a-gone', 'Bajo', null, { roleId: null, pending: 'ROLE_REMOVED' })] } })
  expect(sheet.getByText(/El rol «Bajo» se eliminó/)).toBeTruthy()
  fireEvent.click(sheet.getByRole('button', { name: 'Bajo: pendiente. Cambiar' }))
  const change = within(screen.getByRole('dialog', { name: 'Bajo' }))
  expect(change.queryByRole('button', { name: 'Reemplazar solo aquí' })).toBeNull()
  fireEvent.click(change.getByRole('button', { name: 'Quitar marcador' }))
  await waitFor(() => expect(changes(calls)[0]?.url).toBe('/api/assignments/a-gone'))
  expect(changes(calls)[0].init?.method).toBe('DELETE')
})

test('a person is added to a role of this service only', async () => {
  const { calls, sheet } = await openService()
  fireEvent.click(sheet.getByRole('button', { name: 'Agregar participación' }))
  const add = within(screen.getByRole('dialog', { name: 'Agregar participación' }))
  const submit = add.getByRole('button', { name: 'Agregar' }) as HTMLButtonElement
  expect(submit.disabled).toBe(true)
  fireEvent.click(await add.findByRole('button', { name: 'Piano' }))
  fireEvent.click(await add.findByRole('button', { name: /Pedro Castillo/ }))
  fireEvent.click(submit)
  await waitFor(() => expect(changes(calls)).toHaveLength(1))
  expect([changes(calls)[0].url, JSON.parse(String(changes(calls)[0].init?.body))]).toEqual(['/api/services/s1/assignments', { roleId: 'r-piano', personId: 'p3' }])
})

test('changing a service offers to set up the rotation of that role from this date', async () => {
  const { sheet } = await openService()
  fireEvent.click(sheet.getByRole('button', { name: 'Voces: Luis Herrera. Cambiar' }))
  const link = within(screen.getByRole('dialog', { name: 'Voces' })).getByRole('button', { name: 'Configurar la rotación de Voces' })
  expect(link).toBeTruthy()
})

test('past services and readers see the participations as a record, without controls', async () => {
  vi.setSystemTime(new Date('2026-11-16T18:00:00Z'))
  const past = await openService()
  expect(past.sheet.queryByRole('button', { name: /Cambiar|Agregar participación/ })).toBeNull()
  expect(past.sheet.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['VocesLuis Herrera', 'GuitarraAna Ramírez'])
  cleanup()
  vi.setSystemTime(new Date('2026-11-13T18:00:00Z'))
  const reader = await openService({ church: { ...church, canEdit: false } })
  expect(reader.sheet.queryByRole('button', { name: /Cambiar|Agregar participación/ })).toBeNull()
  expect(reader.sheet.getByText('Luis Herrera')).toBeTruthy()
})
