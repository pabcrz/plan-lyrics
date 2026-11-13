import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { SettingsPage } from './SettingsPage'
import { church, mount, stubApi } from './test-utils'

vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken: async () => 'token-ficticio' }), UserButton: () => <button>Cuenta</button> }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const page = () => mount(<Routes><Route path="/ajustes" element={<SettingsPage />} /></Routes>, '/ajustes')
const requests = (calls: ReturnType<typeof stubApi>, method: string, prefix: string) => calls.filter((call) => call.init?.method === method && call.url.startsWith(prefix))
const roleNames = () => within(screen.getByRole('list', { name: 'Roles musicales' })).getAllByRole('listitem').map((item) => item.textContent)
const combos = () => screen.getByRole('list', { name: 'Roles que no se pueden combinar' })
const chip = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement

test('settings keep the preaching switch and show the catalog alphabetically with the default restriction', async () => {
  stubApi({})
  page()
  expect(await screen.findByRole('switch', { name: 'Usa predicación' })).toBeTruthy()
  expect(await screen.findByRole('list', { name: 'Roles musicales' })).toBeTruthy()
  expect(roleNames()).toEqual(['Batería', 'Guitarra', 'Piano', 'Voces'])
  expect(screen.queryByText('Dirigir', { selector: 'li span' })).toBeNull()
  expect(within(combos()).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Dirigir + BateríaNo a la vez en el mismo servicio'])
})

test('creating a role sends only its name and lists it in alphabetical order', async () => {
  const calls = stubApi({})
  page()
  fireEvent.click(await screen.findByRole('button', { name: 'Agregar rol' }))
  const sheet = within(screen.getByRole('dialog', { name: 'Nuevo rol' }))
  fireEvent.change(sheet.getByLabelText('Nombre del rol'), { target: { value: '  Bajo  ' } })
  fireEvent.click(sheet.getByRole('button', { name: 'Agregar rol' }))
  await waitFor(() => expect(roleNames()).toEqual(['Bajo', 'Batería', 'Guitarra', 'Piano', 'Voces']))
  expect(screen.queryByRole('dialog')).toBeNull()
  const [post] = requests(calls, 'POST', '/api/roles')
  expect(JSON.parse(String(post.init?.body))).toEqual({ name: 'Bajo' })
})

test('an empty or repeated role name (ignoring case and accents, and Dirigir) is refused before sending', async () => {
  const calls = stubApi({})
  page()
  fireEvent.click(await screen.findByRole('button', { name: 'Agregar rol' }))
  const sheet = within(screen.getByRole('dialog', { name: 'Nuevo rol' }))
  fireEvent.click(sheet.getByRole('button', { name: 'Agregar rol' }))
  expect(await sheet.findByText('Escribe el nombre del rol.')).toBeTruthy()
  for (const value of ['BATERIA', ' guitarra ', 'dirigir']) {
    fireEvent.change(sheet.getByLabelText('Nombre del rol'), { target: { value } })
    fireEvent.click(sheet.getByRole('button', { name: 'Agregar rol' }))
    expect(await sheet.findByText('Ya existe un rol con ese nombre.')).toBeTruthy()
  }
  expect(requests(calls, 'POST', '/api/roles')).toHaveLength(0)
})

test('a duplicate the server reports keeps the sheet open with the error', async () => {
  stubApi({ createRole: () => ({ status: 409, body: { error: 'Name exists' } }) })
  page()
  fireEvent.click(await screen.findByRole('button', { name: 'Agregar rol' }))
  const sheet = within(screen.getByRole('dialog', { name: 'Nuevo rol' }))
  fireEvent.change(sheet.getByLabelText('Nombre del rol'), { target: { value: 'Bajo' } })
  fireEvent.click(sheet.getByRole('button', { name: 'Agregar rol' }))
  expect(await sheet.findByText('Ya existe un rol con ese nombre.')).toBeTruthy()
  expect(screen.getByRole('dialog', { name: 'Nuevo rol' })).toBeTruthy()
})

test('removing a role asks first, then drops it and the restrictions that mention it', async () => {
  const calls = stubApi({})
  page()
  fireEvent.click(await screen.findByRole('button', { name: 'Quitar el rol Batería' }))
  const sheet = within(screen.getByRole('dialog', { name: '¿Quitar el rol Batería?' }))
  expect(sheet.getByText(/También se quitarán las restricciones/)).toBeTruthy()
  expect(requests(calls, 'DELETE', '/api/roles/')).toHaveLength(0)
  fireEvent.click(sheet.getByRole('button', { name: 'Quitar rol' }))
  await waitFor(() => expect(roleNames()).toEqual(['Guitarra', 'Piano', 'Voces']))
  expect(requests(calls, 'DELETE', '/api/roles/')[0].url).toBe('/api/roles/r-drums')
  expect(await screen.findByText('Sin restricciones: una persona puede combinar cualquier rol.')).toBeTruthy()
})

test('cancelling the removal keeps the role', async () => {
  const calls = stubApi({})
  page()
  fireEvent.click(await screen.findByRole('button', { name: 'Quitar el rol Piano' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(requests(calls, 'DELETE', '/api/roles/')).toHaveLength(0)
  expect(roleNames()).toContain('Piano')
})

test('adding a restriction needs exactly two roles, sends them and lists the pair', async () => {
  const calls = stubApi({})
  page()
  fireEvent.click(await screen.findByRole('button', { name: 'Agregar restricción' }))
  const sheet = within(screen.getByRole('dialog', { name: 'Nueva restricción' }))
  const add = sheet.getByRole('button', { name: 'Agregar restricción' }) as HTMLButtonElement
  expect(add.disabled).toBe(true)
  expect(sheet.getByText('Elige 2 roles.')).toBeTruthy()
  fireEvent.click(chip('Guitarra'))
  expect(sheet.getByText('Elige 1 rol más.')).toBeTruthy()
  fireEvent.click(chip('Voces'))
  expect(sheet.getByText('Guitarra y Voces no podrán combinarse.')).toBeTruthy()
  expect(chip('Piano').disabled).toBe(true)
  expect(add.disabled).toBe(false)
  fireEvent.click(add)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  const [post] = requests(calls, 'POST', '/api/role-restrictions')
  expect(JSON.parse(String(post.init?.body))).toEqual({ first: 'r-guitar', second: 'r-voices' })
  expect(within(combos()).getAllByRole('listitem').map((item) => item.textContent?.split('No a la vez')[0])).toEqual(['Dirigir + Batería', 'Guitarra + Voces'])
})

test('Dirigir can be picked, and a restriction that already exists cannot be added again in either order', async () => {
  const calls = stubApi({})
  page()
  fireEvent.click(await screen.findByRole('button', { name: 'Agregar restricción' }))
  const sheet = within(screen.getByRole('dialog', { name: 'Nueva restricción' }))
  fireEvent.click(chip('Batería'))
  fireEvent.click(chip('Dirigir'))
  expect(sheet.getByText('Esa restricción ya existe.')).toBeTruthy()
  expect((sheet.getByRole('button', { name: 'Agregar restricción' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(chip('Batería'))
  fireEvent.click(chip('Piano'))
  expect(sheet.getByText('Dirigir y Piano no podrán combinarse.')).toBeTruthy()
  expect(requests(calls, 'POST', '/api/role-restrictions')).toHaveLength(0)
})

test('a restriction the server rejects as repeated shows the error and keeps the sheet', async () => {
  stubApi({ addRestriction: () => ({ status: 409, body: { error: 'Restriction exists' } }) })
  page()
  fireEvent.click(await screen.findByRole('button', { name: 'Agregar restricción' }))
  fireEvent.click(chip('Guitarra'))
  fireEvent.click(chip('Piano'))
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Nueva restricción' })).getByRole('button', { name: 'Agregar restricción' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Esa restricción ya existe.')
  expect(screen.getByRole('dialog', { name: 'Nueva restricción' })).toBeTruthy()
})

test('removing a restriction applies at once', async () => {
  const calls = stubApi({})
  page()
  fireEvent.click(await screen.findByRole('button', { name: 'Quitar la restricción Dirigir y Batería' }))
  expect(await screen.findByText('Sin restricciones: una persona puede combinar cualquier rol.')).toBeTruthy()
  expect(requests(calls, 'DELETE', '/api/role-restrictions/')[0].url).toBe('/api/role-restrictions/x1')
})

test('someone who cannot configure the church only reads roles and restrictions', async () => {
  stubApi({ church: { ...church, canConfigure: false } })
  page()
  expect(await screen.findByText('Solo lectura')).toBeTruthy()
  expect(await screen.findByRole('list', { name: 'Roles musicales' })).toBeTruthy()
  expect(roleNames()).toEqual(['Batería', 'Guitarra', 'Piano', 'Voces'])
  expect(screen.getByText('Dirigir + Batería', { exact: false })).toBeTruthy()
  expect(screen.queryByRole('button', { name: /Quitar|Agregar/ })).toBeNull()
})

test('a failed load of the roles explains it instead of leaving an empty list', async () => {
  stubApi({})
  const fetchStub = globalThis.fetch
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => (url === '/api/roles' ? new Response('{}', { status: 503 }) : fetchStub(url, init))))
  page()
  expect((await screen.findByRole('alert')).textContent).toBe('No se pudieron cargar los roles. Inténtalo de nuevo más tarde.')
  expect(screen.queryByRole('list', { name: 'Roles musicales' })).toBeNull()
})
