import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { church, mount } from '../calendar/test-utils'
import { AllPeoplePage } from './AllPeoplePage'
import type { PlatformChurch, PlatformPerson } from './platform-api'

vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken: async () => 'token-ficticio' }), UserButton: () => <button>Cuenta</button> }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const churches: PlatformChurch[] = [
  { id: 'c1', name: 'Betel', usesPreaching: true, roles: [{ id: 'r-drums', name: 'Batería' }, { id: 'r-voices', name: 'Voces' }] },
  { id: 'c2', name: 'Sión', usesPreaching: false, roles: [] },
]
const people: PlatformPerson[] = [
  { id: 'p1', name: 'Carlos Ruiz', phone: '+525550101234', email: null, hasAccount: false, churches: [{ id: 'c1', canPlay: true, canDirect: false, canPreach: false, roleIds: ['r-voices'] }] },
  { id: 'p2', name: 'Ana Soto', phone: null, email: 'ana@example.com', hasAccount: true, churches: [] },
]
type Reply = { status: number; body?: unknown }
function stub(over: { owner?: boolean; fail?: Record<string, Reply> } = {}) {
  const calls: Array<{ method: string; url: string; body?: unknown }> = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    const reply = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status })
    const failed = over.fail?.[`${method} ${url}`]
    if (failed) return reply(failed.status, failed.body ?? { error: 'x' })
    if (url === '/api/access') return reply(200, { owner: over.owner ?? true, accountManager: false })
    if (url === '/api/active-church') return reply(200, church)
    if (url === '/api/platform/people' && method === 'GET') return reply(200, people)
    if (url === '/api/platform/churches') return reply(200, churches)
    if (url === '/api/platform/people' && method === 'POST') return reply(201, { id: 'new', name: 'Prueba', phone: null, email: null, hasAccount: false, churches: [] })
    if (method === 'PATCH') return reply(200, { ...people[0], ...JSON.parse(String(init?.body)) })
    if (method === 'PUT') return reply(200, { id: 'c2', ...JSON.parse(String(init?.body)) })
    if (method === 'DELETE') return reply(204)
    return reply(404, { error: 'x' })
  }))
  return calls
}
const app = () => mount(<Routes><Route path="/todas-las-personas" element={<AllPeoplePage />} /><Route path="/" element={<p>Inicio</p>} /></Routes>, '/todas-las-personas')
const writes = (calls: ReturnType<typeof stub>) => calls.filter((call) => call.method !== 'GET' && call.url !== '/api/access').map(({ method, url, body }) => ({ method, url, body }))

test('someone who is not the platform owner gets a notice and the people are never requested', async () => {
  const calls = stub({ owner: false })
  app()
  expect(await screen.findByText('Sin permiso')).toBeTruthy()
  expect(calls.some((call) => call.url.startsWith('/api/platform'))).toBe(false)
})

test('lists everyone with their churches, finds by name without accents, and says who has no church', async () => {
  stub()
  app()
  expect(await screen.findByText('Carlos Ruiz')).toBeTruthy()
  expect(screen.getByText('Betel')).toBeTruthy()
  expect(screen.getByText('Sin iglesia')).toBeTruthy()
  expect(screen.getByText('Con cuenta')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Buscar personas por nombre'), { target: { value: 'ana' } })
  expect(screen.queryByText('Carlos Ruiz')).toBeNull()
  expect(screen.getByText('1 de 2')).toBeTruthy()
})

test('adds a person with no church and opens their record; a repeated name offers the existing one', async () => {
  const calls = stub()
  app()
  fireEvent.click(await screen.findByRole('button', { name: 'Agregar persona' }))
  fireEvent.change(await screen.findByLabelText('Nombre completo'), { target: { value: ' Prueba ' } })
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Agregar persona' }))
  await waitFor(() => expect(writes(calls)).toEqual([{ method: 'POST', url: '/api/platform/people', body: { name: 'Prueba' } }]))
  cleanup()
  stub({ fail: { 'POST /api/platform/people': { status: 409, body: { error: 'Name exists', existing: { id: 'p1', name: 'Carlos Ruiz' } } } } })
  app()
  fireEvent.click(await screen.findByRole('button', { name: 'Agregar persona' }))
  fireEvent.change(await screen.findByLabelText('Nombre completo'), { target: { value: 'Carlos Ruiz' } })
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Agregar persona' }))
  expect(await screen.findByText('Ya existe «Carlos Ruiz»')).toBeTruthy()
})

test('edits the general data from the record and sends only what changed', async () => {
  const calls = stub()
  app()
  fireEvent.click(await screen.findByRole('button', { name: /^Carlos Ruiz/ }))
  fireEvent.change(await screen.findByLabelText('Correo (opcional)'), { target: { value: 'carlos@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar datos' }))
  await waitFor(() => expect(writes(calls)).toEqual([{ method: 'PATCH', url: '/api/platform/people/p1', body: { email: 'carlos@example.com' } }]))
})

test('assigns to another church without groups, or with groups and roles of that church', async () => {
  const calls = stub()
  app()
  fireEvent.click(await screen.findByRole('button', { name: /^Carlos Ruiz/ }))
  const sion = await screen.findByRole('region', { name: 'Iglesia Sión' })
  fireEvent.click(within(sion).getByRole('switch', { name: 'En Sión' }))
  fireEvent.click(within(sion).getByRole('button', { name: 'Asignar a Sión' }))
  await waitFor(() => expect(writes(calls)).toEqual([{ method: 'PUT', url: '/api/platform/people/p1/churches/c2', body: { canPlay: false, canDirect: false, canPreach: false, roleIds: [] } }]))
  cleanup()
  const more = stub()
  app()
  fireEvent.click(await screen.findByRole('button', { name: /^Ana Soto/ }))
  const betel = await screen.findByRole('region', { name: 'Iglesia Betel' })
  fireEvent.click(within(betel).getByRole('switch', { name: 'En Betel' }))
  fireEvent.click(within(betel).getByRole('switch', { name: 'Grupo de alabanza' }))
  fireEvent.click(within(betel).getByRole('button', { name: 'Batería' }))
  fireEvent.click(within(betel).getByRole('switch', { name: 'Predica' }))
  fireEvent.click(within(betel).getByRole('button', { name: 'Asignar a Betel' }))
  await waitFor(() => expect(writes(more)).toEqual([{ method: 'PUT', url: '/api/platform/people/p2/churches/c1', body: { canPlay: true, canDirect: false, canPreach: true, roleIds: ['r-drums'] } }]))
})

test('only churches that use preaching offer it, and turning the worship group off drops the roles', async () => {
  const calls = stub()
  app()
  fireEvent.click(await screen.findByRole('button', { name: /^Ana Soto/ }))
  const sion = await screen.findByRole('region', { name: 'Iglesia Sión' })
  fireEvent.click(within(sion).getByRole('switch', { name: 'En Sión' }))
  expect(within(sion).queryByRole('switch', { name: 'Predica' })).toBeNull()
  const betel = await screen.findByRole('region', { name: 'Iglesia Betel' })
  fireEvent.click(within(betel).getByRole('switch', { name: 'En Betel' }))
  fireEvent.click(within(betel).getByRole('switch', { name: 'Grupo de alabanza' }))
  fireEvent.click(within(betel).getByRole('button', { name: 'Voces' }))
  fireEvent.click(within(betel).getByRole('switch', { name: 'Grupo de alabanza' }))
  fireEvent.click(within(betel).getByRole('button', { name: 'Asignar a Betel' }))
  await waitFor(() => expect(writes(calls)).toEqual([{ method: 'PUT', url: '/api/platform/people/p2/churches/c1', body: { canPlay: false, canDirect: false, canPreach: false, roleIds: [] } }]))
})

test('removes from a church, and explains when leaving the worship group is refused', async () => {
  const calls = stub({ fail: { 'PUT /api/platform/people/p1/churches/c1': { status: 409, body: { error: 'In use' } } } })
  app()
  fireEvent.click(await screen.findByRole('button', { name: /^Carlos Ruiz/ }))
  const betel = await screen.findByRole('region', { name: 'Iglesia Betel' })
  fireEvent.click(within(betel).getByRole('switch', { name: 'Grupo de alabanza' }))
  fireEvent.click(within(betel).getByRole('button', { name: 'Guardar cambios' }))
  expect((await within(betel).findByRole('alert')).textContent).toContain('habitual o en una rotación')
  fireEvent.click(within(betel).getByRole('switch', { name: 'En Betel' }))
  await waitFor(() => expect(writes(calls).at(-1)).toEqual({ method: 'DELETE', url: '/api/platform/people/p1/churches/c1', body: undefined }))
})
