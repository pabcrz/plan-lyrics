import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { CalendarPage } from './CalendarPage'
import type { Who } from './participations-api'
import type { Preaching, PreachingTurn } from './preaching-api'
import { church, detail, mount, service, stubApi } from './test-utils'

vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken: async () => 'token-ficticio' }), UserButton: () => <button>Cuenta</button> }))

// Viernes 13 de noviembre de 2026.
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-13T18:00:00Z') }) })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

const [ana, luis, pedro]: Who[] = [{ id: 'p1', name: 'Ana Ramírez' }, { id: 'p2', name: 'Luis Herrera' }, { id: 'p3', name: 'Pedro Castillo' }]
const directory = [ana, luis, pedro].map((person) => detail(person))
const withPreaching = { ...church, usesPreaching: true }
const section = (over: Partial<Preaching> = {}): Preaching => ({ serviceId: 's1', preacher: luis, topic: 'La fe', passages: ['Hebreos 11:1', 'Romanos 10:17'], canSeeNotes: true, notes: '- Punto **uno**\n- Punto __dos__\n\nCierre', ...over })
const turns: PreachingTurn[] = [
  { serviceId: 's1', date: '2026-11-13', slot: 'SINGLE', title: 'Servicio de viernes', person: luis },
  { serviceId: 's2', date: '2026-11-20', slot: 'SINGLE', title: 'Servicio de viernes', person: pedro },
  { serviceId: 's3', date: '2026-11-27', slot: 'SINGLE', title: 'Servicio de viernes', person: luis },
]
const friday = service({ id: 's1', date: '2026-11-13' })
const base = { church: withPreaching, services: [friday], directory, preaching: { s1: section() } }

async function openService(over: Parameters<typeof stubApi>[0] = {}, name = 'Servicio de viernes') {
  const calls = stubApi({ ...base, ...over })
  mount(<Routes><Route path="*" element={<CalendarPage />} /></Routes>)
  fireEvent.click(await screen.findByRole('button', { name: /13 de noviembre: Servicio de viernes/ }))
  const sheet = await screen.findByRole('dialog', { name })
  await waitFor(() => expect(within(sheet).queryByText('Cargando predicación…')).toBeNull())
  return { calls, sheet: within(sheet) }
}
const writes = (calls: ReturnType<typeof stubApi>) => calls.filter((call) => call.init?.method === 'PUT' && call.url.endsWith('/preaching') || call.url === '/api/preaching/swap')

test('the section is hidden, and never requested, when the church does not use preaching', async () => {
  const calls = stubApi({ ...base, church: church })
  mount(<Routes><Route path="*" element={<CalendarPage />} /></Routes>)
  fireEvent.click(await screen.findByRole('button', { name: /13 de noviembre: Servicio de viernes/ }))
  const sheet = within(await screen.findByRole('dialog', { name: 'Servicio de viernes' }))
  await waitFor(() => expect(sheet.queryByText('Cargando participaciones…')).toBeNull())
  expect(sheet.queryByText('Predicación')).toBeNull()
  expect(calls.some((call) => call.url.includes('/preaching'))).toBe(false)
})

test('the detail shows the preacher, topic, passages as plain labels and the notes with their format', async () => {
  const { sheet } = await openService()
  expect(sheet.getByRole('heading', { name: 'Predicación' })).toBeTruthy()
  expect(sheet.getByText('Luis Herrera', { selector: 'b' })).toBeTruthy()
  expect(sheet.getByText('La fe')).toBeTruthy()
  expect(sheet.getAllByRole('listitem', { name: '' }).map((item) => item.textContent)).toEqual(expect.arrayContaining(['Hebreos 11:1', 'Romanos 10:17']))
  expect(sheet.getByText('uno').tagName).toBe('STRONG')
  expect(sheet.getByText('dos').tagName).toBe('U')
  expect(sheet.getAllByRole('listitem').map((item) => item.textContent)).toEqual(expect.arrayContaining(['Punto uno', 'Punto dos']))
  expect(sheet.getByText('Cierre').closest('p')).toBeTruthy()
})

test('notes are text: markup typed in them is never turned into elements', async () => {
  const { sheet } = await openService({ preaching: { s1: section({ passages: ['<i>Juan</i> 3:16'], notes: '- <img src=x onerror=alert(1)> **ok**' }) } })
  expect(sheet.getByText('<i>Juan</i> 3:16')).toBeTruthy()
  expect(sheet.getByText(/<img src=x onerror=alert\(1\)>/)).toBeTruthy()
  expect(document.querySelector('img')).toBeNull()
  expect(document.querySelector('i')).toBeNull()
})

test('someone who may not read the notes sees no notes and no editing', async () => {
  const { sheet } = await openService({ church: { ...withPreaching, canEdit: false }, preaching: { s1: section({ canSeeNotes: false, notes: undefined }) } })
  expect(sheet.getByText('La fe')).toBeTruthy()
  expect(sheet.queryByText('Notas internas')).toBeNull()
  expect(sheet.queryByText('Cierre')).toBeNull()
  expect(sheet.queryByRole('button', { name: /Editar predicación|Agregar predicación|Intercambiar predicador/ })).toBeNull()
})

test('a service without preaching says so and offers to add it', async () => {
  const { sheet } = await openService({ preaching: {} })
  expect(sheet.getByText('Este servicio no tiene predicación cargada.')).toBeTruthy()
  expect(sheet.getByRole('button', { name: 'Agregar predicación' })).toBeTruthy()
  expect(sheet.queryByRole('button', { name: 'Intercambiar predicador con otra fecha' })).toBeNull()
})

test('an editor adds the preaching: preacher without account, topic, one passage per line and notes', async () => {
  const { calls, sheet } = await openService({ preaching: {} })
  fireEvent.click(sheet.getByRole('button', { name: 'Agregar predicación' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Predicación' }))
  expect(dialog.getByText('Sin predicador')).toBeTruthy()
  fireEvent.click(dialog.getByRole('button', { name: 'Elegir' }))
  fireEvent.click(await dialog.findByRole('button', { name: /Pedro Castillo/ }))
  fireEvent.change(dialog.getByLabelText('Tema'), { target: { value: '  La   gracia ' } })
  fireEvent.change(dialog.getByLabelText('Citas bíblicas'), { target: { value: 'Efesios 2:8\n\n  Tito   2:11 ' } })
  fireEvent.change(dialog.getByLabelText('Notas internas'), { target: { value: '- Uno\n- **Dos**' } })
  fireEvent.click(dialog.getByRole('button', { name: 'Guardar predicación' }))
  await waitFor(() => expect(writes(calls)).toHaveLength(1))
  const [put] = writes(calls)
  expect([put.init?.method, put.url, JSON.parse(String(put.init?.body))]).toEqual(['PUT', '/api/services/s1/preaching', {
    preacherId: 'p3', topic: 'La gracia', passages: ['Efesios 2:8', 'Tito 2:11'], notes: '- Uno\n- **Dos**',
  }])
  expect(await screen.findByText('Predicación guardada')).toBeTruthy()
  expect(await screen.findByText('Pedro Castillo', { selector: 'b' })).toBeTruthy()
})

test('editing changes only what was touched and the preacher can be left empty', async () => {
  const { calls, sheet } = await openService()
  fireEvent.click(sheet.getByRole('button', { name: 'Editar predicación' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Predicación' }))
  expect((dialog.getByLabelText('Tema') as HTMLInputElement).value).toBe('La fe')
  expect((dialog.getByLabelText('Citas bíblicas') as HTMLTextAreaElement).value).toBe('Hebreos 11:1\nRomanos 10:17')
  fireEvent.click(dialog.getByRole('button', { name: 'Cambiar' }))
  fireEvent.click(await dialog.findByRole('button', { name: 'Dejar sin predicador' }))
  fireEvent.click(dialog.getByRole('button', { name: 'Guardar predicación' }))
  await waitFor(() => expect(writes(calls)).toHaveLength(1))
  expect(JSON.parse(String(writes(calls)[0].init?.body))).toEqual({ preacherId: null, topic: 'La fe', passages: ['Hebreos 11:1', 'Romanos 10:17'], notes: '- Punto **uno**\n- Punto __dos__\n\nCierre' })
})

test('texts over their limits are flagged at the field and nothing is sent', async () => {
  const { calls, sheet } = await openService()
  fireEvent.click(sheet.getByRole('button', { name: 'Editar predicación' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Predicación' }))
  fireEvent.change(dialog.getByLabelText('Tema'), { target: { value: 'x'.repeat(170) } })
  expect(dialog.getByText('Máximo 160 caracteres.')).toBeTruthy()
  expect((dialog.getByRole('button', { name: 'Guardar predicación' }) as HTMLButtonElement).disabled).toBe(true)
  expect(writes(calls)).toHaveLength(0)
})

test('a refused save explains why and keeps the sheet open', async () => {
  const { sheet } = await openService({ preachingChange: () => ({ status: 409, body: { error: 'Preaching disabled' } }) })
  fireEvent.click(sheet.getByRole('button', { name: 'Editar predicación' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Predicación' }))
  fireEvent.click(dialog.getByRole('button', { name: 'Guardar predicación' }))
  expect((await dialog.findByRole('alert')).textContent).toBe('Tu iglesia ya no usa la predicación. Actívala en Ajustes para cambiarla.')
  expect(screen.getByRole('dialog', { name: 'Predicación' })).toBeTruthy()
})

test('swapping shows both dates and people first and sends nothing until confirmed', async () => {
  const { calls, sheet } = await openService({ preachingTurns: turns })
  fireEvent.click(sheet.getByRole('button', { name: 'Intercambiar predicador con otra fecha' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Intercambiar predicador' }))
  const options = within(await dialog.findByRole('list', { name: 'Fechas con predicador' })).getAllByRole('button').map((button) => button.textContent)
  // Ni la propia fecha ni otra donde predica la misma persona.
  expect(options).toEqual(['vie 20 novPedro Castillo'])
  const confirm = dialog.getByRole('button', { name: /Confirmar intercambio/ }) as HTMLButtonElement
  expect(confirm.disabled).toBe(true)
  fireEvent.click(dialog.getByRole('button', { name: /vie 20 nov/ }))
  expect(dialog.getByText('Luis Herrera ↔ Pedro Castillo')).toBeTruthy()
  expect(dialog.getByText(/vie 13 nov pasa a Pedro Castillo · vie 20 nov pasa a Luis Herrera/)).toBeTruthy()
  expect(writes(calls)).toHaveLength(0)
  fireEvent.click(confirm)
  await waitFor(() => expect(writes(calls)).toHaveLength(1))
  expect([writes(calls)[0].url, JSON.parse(String(writes(calls)[0].init?.body))]).toEqual(['/api/preaching/swap', { first: 's1', second: 's2' }])
  expect(await screen.findByText('Predicadores intercambiados')).toBeTruthy()
})

test('with no other date to trade with there is nothing to confirm', async () => {
  const { sheet } = await openService({ preachingTurns: [turns[0]] })
  fireEvent.click(sheet.getByRole('button', { name: 'Intercambiar predicador con otra fecha' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Intercambiar predicador' }))
  expect(await dialog.findByText('No hay otras fechas próximas con un predicador distinto.')).toBeTruthy()
  expect((dialog.getByRole('button', { name: /Confirmar intercambio/ }) as HTMLButtonElement).disabled).toBe(true)
})

test('a past service is a record: no editing and no swapping', async () => {
  vi.setSystemTime(new Date('2026-11-14T18:00:00Z'))
  const { sheet } = await openService()
  expect(sheet.getByText('La fe')).toBeTruthy()
  expect(sheet.queryByRole('button', { name: /Editar predicación|Intercambiar predicador/ })).toBeNull()
})
