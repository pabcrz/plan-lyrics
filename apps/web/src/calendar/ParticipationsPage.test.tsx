import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ParticipationsPage, RoleParticipationPage } from './ParticipationsPage'
import type { RoleParticipation, Who } from './participations-api'
import { church, detail, mount, stubApi } from './test-utils'

vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken: async () => 'token-ficticio' }), UserButton: () => <button>Cuenta</button> }))

// Viernes 13 de noviembre de 2026, mediodía en Ciudad de México.
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-13T18:00:00Z') }) })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

const [ana, luis, pedro, juan]: Who[] = [{ id: 'p1', name: 'Ana Ramírez' }, { id: 'p2', name: 'Luis Herrera' }, { id: 'p3', name: 'Pedro Castillo' }, { id: 'p4', name: 'Juan Pérez' }]
const directory = [ana, luis, pedro, juan].map((person) => detail(person))
const off = { enabled: false, mode: 'BY_DAY' as const, startsOn: null, sequences: [] }
const role = (id: string, name: string, over: Partial<RoleParticipation> = {}): RoleParticipation => ({ roleId: id, name, habitual: [], rotation: off, preview: [], ...over })
const voices = role('r-voices', 'Voces', {
  habitual: [ana],
  rotation: { enabled: true, mode: 'BY_DAY', startsOn: '2026-11-06', sequences: [{ weekday: 5, people: [luis, pedro] }, { weekday: null, people: [juan] }] },
  preview: [
    { date: '2026-11-13', slot: 'SINGLE', rotation: luis, habitual: [ana] },
    { date: '2026-11-15', slot: 'SINGLE', rotation: null, habitual: [ana] },
    { date: '2026-11-20', slot: 'SINGLE', rotation: null, habitual: [] },
  ],
})
const all = [role('r-drums', 'Batería'), role('r-guitar', 'Guitarra', { habitual: [pedro] }), role('r-piano', 'Piano'), voices]

const pages = (path: string) => mount(
  <Routes>
    <Route path="/participaciones" element={<ParticipationsPage />} />
    <Route path="/participaciones/:roleId" element={<RoleParticipationPage />} />
  </Routes>, path)
const puts = (calls: ReturnType<typeof stubApi>) => calls.filter((call) => call.init?.method === 'PUT' && call.url.startsWith('/api/role-participations/')).map((call) => JSON.parse(String(call.init?.body)))
const card = (name: string) => within(screen.getByRole('region', { name }))

test('the list shows every role alphabetically with what is configured and what is not', async () => {
  stubApi({ participations: all, directory })
  pages('/participaciones')
  const list = await screen.findByRole('list', { name: 'Roles' })
  const rows = within(list).getAllByRole('listitem').map((item) => item.textContent)
  expect(rows).toEqual(['BateríaSin configurar', 'GuitarraHabitual: Pedro', 'PianoSin configurar', 'VocesHabitual: AnaRotación por día · vie'])
  expect(screen.getByText(/Cantar mientras toca piano o guitarra no requiere asignarla también a voces/)).toBeTruthy()
  expect(screen.getByText(/salvo las combinaciones que la iglesia no permite/)).toBeTruthy()
})

test('choosing a role opens its configuration', async () => {
  stubApi({ participations: all, directory })
  pages('/participaciones')
  fireEvent.click(await screen.findByRole('button', { name: /^Guitarra/ }))
  expect(await screen.findByRole('heading', { name: 'Guitarra' })).toBeTruthy()
  expect(screen.getByText('Pedro Castillo')).toBeTruthy()
})

test('adding a role from the list creates it and lists it', async () => {
  const calls = stubApi({ participations: all, directory })
  pages('/participaciones')
  fireEvent.click(await screen.findByRole('button', { name: 'Agregar rol' }))
  const sheet = within(screen.getByRole('dialog', { name: 'Nuevo rol' }))
  fireEvent.change(sheet.getByLabelText('Nombre del rol'), { target: { value: 'Bajo' } })
  fireEvent.click(sheet.getByRole('button', { name: 'Agregar rol' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(JSON.parse(String(calls.find((call) => call.url === '/api/roles' && call.init?.method === 'POST')?.init?.body))).toEqual({ name: 'Bajo' })
})

test('the church administrator is the only one offered the new role button', async () => {
  stubApi({ participations: all, directory, church: { ...church, canConfigure: false } })
  pages('/participaciones')
  await screen.findByRole('list', { name: 'Roles' })
  expect(screen.queryByRole('button', { name: 'Agregar rol' })).toBeNull()
})

test('a habitual person is added from the picker, which hides who is already habitual or rotating in this role', async () => {
  stubApi({ participations: all, directory })
  pages('/participaciones/r-voices')
  fireEvent.click(await screen.findByRole('button', { name: 'Agregar otra persona' }))
  const sheet = within(screen.getByRole('dialog', { name: 'Habitual de voces' }))
  // Ana ya es habitual; Luis, Pedro y Juan rotan: no queda nadie nuevo.
  expect(sheet.queryByRole('button', { name: /Ana|Luis|Pedro|Juan/ })).toBeNull()
  expect(sheet.getByText('No hay más personas para agregar. Las personas nuevas se dan de alta en Personas.')).toBeTruthy()
})

test('adding a habitual person sends the whole role and keeps several voices', async () => {
  const calls = stubApi({ participations: [role('r-voices', 'Voces', { habitual: [ana] })], directory })
  pages('/participaciones/r-voices')
  fireEvent.click(await screen.findByRole('button', { name: 'Agregar otra persona' }))
  const sheet = within(screen.getByRole('dialog', { name: 'Habitual de voces' }))
  expect(sheet.queryByRole('button', { name: /Ana Ramírez/ })).toBeNull()
  fireEvent.click(sheet.getByRole('button', { name: /Pedro Castillo/ }))
  await waitFor(() => expect(puts(calls)).toHaveLength(1))
  expect(puts(calls)[0]).toEqual({ habitualIds: ['p1', 'p3'], rotation: { enabled: false, mode: 'BY_DAY', startsOn: null, sequences: [] } })
  expect(await screen.findByText('Pedro Castillo')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Quitar a Ana Ramírez' }))
  await waitFor(() => expect(puts(calls)).toHaveLength(2))
  expect(puts(calls)[1].habitualIds).toEqual(['p3'])
})

test('someone who rotates in the role is not offered as habitual, and the other way round', async () => {
  stubApi({ participations: [voices], directory })
  pages('/participaciones/r-voices')
  fireEvent.click(await screen.findByRole('button', { name: 'Agregar otra persona' }))
  expect(within(screen.getByRole('dialog', { name: 'Habitual de voces' })).queryByRole('button', { name: /Luis Herrera/ })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  fireEvent.click(within(screen.getByRole('region', { name: 'Rotación · Viernes' })).getByRole('button', { name: /Agregar a la rotación/ }))
  const sheet = within(screen.getByRole('dialog', { name: 'Rotación de voces' }))
  expect(sheet.queryByRole('button', { name: /Ana Ramírez/ })).toBeNull() // habitual
  expect(sheet.queryByRole('button', { name: /Luis Herrera/ })).toBeNull() // ya está en esta secuencia
  expect(sheet.getByRole('button', { name: /Juan Pérez/ })).toBeTruthy() // rota en otra secuencia: se permite
  expect(sheet.getByText('Se añade al final de la secuencia del viernes.')).toBeTruthy()
})

test('turning the rotation on starts it today and shows one card per service day, each with its own sequence', async () => {
  const calls = stubApi({ participations: [role('r-voices', 'Voces')], directory })
  pages('/participaciones/r-voices')
  const toggle = await screen.findByRole('switch', { name: 'Rotar turnos' })
  expect(screen.queryByRole('button', { name: 'Por día' })).toBeNull()
  fireEvent.click(toggle)
  await waitFor(() => expect(puts(calls)).toHaveLength(1))
  expect(puts(calls)[0].rotation).toEqual({ enabled: true, mode: 'BY_DAY', startsOn: '2026-11-13', sequences: [] })
  expect(await screen.findByRole('region', { name: 'Rotación · Domingo' })).toBeTruthy()
  expect(screen.getByRole('region', { name: 'Rotación · Viernes' })).toBeTruthy()
  expect(screen.getByText('Cada día de la semana tiene su propia secuencia: un domingo no adelanta los turnos del viernes.')).toBeTruthy()
  expect((screen.getByLabelText('Primer turno desde') as HTMLInputElement).value).toBe('2026-11-13')
})

test('the reference service passed in the link is where the rotation starts', async () => {
  const calls = stubApi({ participations: [role('r-voices', 'Voces')], directory })
  pages('/participaciones/r-voices?desde=2026-11-27')
  fireEvent.click(await screen.findByRole('switch', { name: 'Rotar turnos' }))
  await waitFor(() => expect(puts(calls)).toHaveLength(1))
  expect(puts(calls)[0].rotation.startsOn).toBe('2026-11-27')
})

test('changing the first turn date or the mode sends them; the shared mode has one sequence for every service', async () => {
  const calls = stubApi({ participations: [voices], directory })
  pages('/participaciones/r-voices')
  fireEvent.change(await screen.findByLabelText('Primer turno desde'), { target: { value: '2026-11-20' } })
  await waitFor(() => expect(puts(calls)).toHaveLength(1))
  expect(puts(calls)[0].rotation.startsOn).toBe('2026-11-20')
  fireEvent.click(screen.getByRole('button', { name: 'Entre todos' }))
  await waitFor(() => expect(puts(calls)).toHaveLength(2))
  expect(puts(calls)[1].rotation.mode).toBe('SHARED')
  expect(await screen.findByRole('region', { name: 'Rotación · Todos los servicios' })).toBeTruthy()
  expect(screen.queryByRole('region', { name: 'Rotación · Viernes' })).toBeNull()
  expect(card('Rotación · Todos los servicios').getByText('Juan Pérez')).toBeTruthy()
  expect(screen.getByText('Una sola secuencia para todos los servicios, sin importar el día.')).toBeTruthy()
})

test('people in a sequence are ordered with up and down, removed and added at the end', async () => {
  const calls = stubApi({ participations: [voices], directory })
  pages('/participaciones/r-voices')
  const friday = await screen.findByRole('region', { name: 'Rotación · Viernes' })
  expect((within(friday).getByRole('button', { name: 'Subir a Luis Herrera' }) as HTMLButtonElement).disabled).toBe(true)
  expect((within(friday).getByRole('button', { name: 'Bajar a Pedro Castillo' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(within(friday).getByRole('button', { name: 'Bajar a Luis Herrera' }))
  await waitFor(() => expect(puts(calls)).toHaveLength(1))
  expect(puts(calls)[0].rotation.sequences.find((sequence: { weekday: number | null }) => sequence.weekday === 5).personIds).toEqual(['p3', 'p2'])
  fireEvent.click(within(await screen.findByRole('region', { name: 'Rotación · Viernes' })).getByRole('button', { name: 'Quitar a Pedro Castillo' }))
  await waitFor(() => expect(puts(calls)).toHaveLength(2))
  expect(puts(calls)[1].rotation.sequences.find((sequence: { weekday: number | null }) => sequence.weekday === 5).personIds).toEqual(['p2'])
  // El domingo todavía no tiene a nadie y lo dice.
  expect(screen.getByText('Nadie en esta secuencia: este día solo lleva habituales.')).toBeTruthy()
})

test('the preview marks the rotation turn and keeps the habitual people, without touching existing services', async () => {
  stubApi({ participations: [voices], directory })
  pages('/participaciones/r-voices')
  const preview = within(await screen.findByRole('list', { name: 'Próximos servicios' }))
  const rows = preview.getAllByRole('listitem').map((item) => item.textContent)
  expect(rows[0]).toContain('Luis Herrera Turno')
  expect(rows[0]).toContain('Ana Ramírez')
  expect(rows[1]).toContain('Ana Ramírez')
  expect(rows[2]).toContain('Sin asignar')
  expect(screen.getByText('Así quedaría este rol. No cambia los servicios que ya existen.')).toBeTruthy()
})

test('someone who can only read sees the role without any control to change it', async () => {
  stubApi({ participations: [voices], directory, church: { ...church, canEdit: false, canConfigure: false } })
  pages('/participaciones/r-voices')
  expect(await screen.findByText('Solo lectura')).toBeTruthy()
  expect(within(screen.getByRole('region', { name: 'Rotación · Viernes' })).getByText('Luis Herrera')).toBeTruthy()
  expect(screen.queryByRole('button', { name: /Agregar|Quitar|Subir|Bajar|Eliminar/ })).toBeNull()
  expect((screen.getByRole('switch', { name: 'Rotar turnos' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getByText('Modalidad: por día')).toBeTruthy()
})

test('a change the server refuses explains it and leaves the role as it was', async () => {
  stubApi({ participations: [role('r-voices', 'Voces', { habitual: [ana] })], directory, saveParticipation: () => ({ status: 400, body: { error: 'Invalid request' } }) })
  pages('/participaciones/r-voices')
  fireEvent.click(await screen.findByRole('button', { name: 'Quitar a Ana Ramírez' }))
  expect((await screen.findByRole('alert')).textContent).toContain('No se pudo guardar el cambio')
  expect(screen.getByText('Ana Ramírez')).toBeTruthy()
})

test('deleting a role with services ahead warns first and only then leaves their assignments pending', async () => {
  const calls = stubApi({ participations: [voices], directory, futureServices: { 'r-voices': 2 } })
  pages('/participaciones/r-voices')
  fireEvent.click(await screen.findByRole('button', { name: 'Eliminar rol' }))
  fireEvent.click(within(screen.getByRole('dialog', { name: '¿Quitar el rol Voces?' })).getByRole('button', { name: 'Quitar rol' }))
  const warned = within(await screen.findByRole('dialog', { name: '¿Quitar el rol Voces?' }))
  expect(await warned.findByText('2 servicios próximos tienen asignaciones de Voces')).toBeTruthy()
  expect(warned.getByText(/quedan pendientes, sin persona/)).toBeTruthy()
  expect(warned.getByText(/Los servicios pasados conservan su registro/)).toBeTruthy()
  const deletes = () => calls.filter((call) => call.init?.method === 'DELETE').map((call) => call.url)
  expect(deletes()).toEqual(['/api/roles/r-voices'])
  fireEvent.click(warned.getByRole('button', { name: 'Quitar y dejar pendientes' }))
  await waitFor(() => expect(deletes()).toEqual(['/api/roles/r-voices', '/api/roles/r-voices?confirm=future-assignments']))
})

test('deleting a role with nothing ahead needs a single confirmation', async () => {
  const calls = stubApi({ participations: all, directory })
  pages('/participaciones/r-piano')
  fireEvent.click(await screen.findByRole('button', { name: 'Eliminar rol' }))
  fireEvent.click(within(screen.getByRole('dialog', { name: '¿Quitar el rol Piano?' })).getByRole('button', { name: 'Quitar rol' }))
  await waitFor(() => expect(calls.filter((call) => call.init?.method === 'DELETE').map((call) => call.url)).toEqual(['/api/roles/r-piano']))
})

test('a role that does not exist says so', async () => {
  stubApi({ participations: all, directory })
  pages('/participaciones/r-nada')
  expect((await screen.findByRole('alert')).textContent).toBe('Este rol no existe en tu iglesia.')
})
