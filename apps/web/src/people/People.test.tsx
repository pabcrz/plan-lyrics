import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { church, detail, mount, stubApi } from '../calendar/test-utils'
import type { Church } from '../calendar/model'
import { NewPersonPage } from './NewPersonPage'
import { PeoplePage } from './PeoplePage'
import { PersonPage } from './PersonPage'

vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken: async () => 'token-ficticio' }), UserButton: () => <button>Cuenta</button> }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const app = (path: string) => mount(
  <Routes>
    <Route path="/personas" element={<PeoplePage />} />
    <Route path="/personas/nueva" element={<NewPersonPage />} />
    <Route path="/personas/:personId" element={<PersonPage />} />
    <Route path="/" element={<p>Calendario</p>} />
  </Routes>, path)
const member: Church = { ...church, canEdit: false, canConfigure: false }
const editor: Church = { ...church, canEdit: true, canConfigure: false }
const directory = [detail({ id: 'p1', name: 'Ana Ramírez', hasAccount: true }), detail({ id: 'p2', name: 'Álvaro Núñez' }), detail({ id: 'p3', name: 'Luis Herrera', phone: '555-0100' })]
const sent = (calls: ReturnType<typeof stubApi>, method: string) => calls.filter((call) => call.init?.method === method).map((call) => ({ url: call.url, body: call.init?.body ? JSON.parse(String(call.init.body)) : undefined }))

test('lists the people and finds them by name without accents or case', async () => {
  stubApi({ directory })
  app('/personas')
  expect(await screen.findByText('Ana Ramírez')).toBeTruthy()
  expect(screen.getByText('Con cuenta')).toBeTruthy()
  expect(screen.getByText('3 personas')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Buscar personas por nombre'), { target: { value: 'ramirez' } })
  expect(screen.queryByText('Luis Herrera')).toBeNull()
  expect(screen.getByText('1 de 3')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Buscar personas por nombre'), { target: { value: 'alvaro' } })
  expect(screen.getByText('Álvaro Núñez')).toBeTruthy()
})

test('with no results it offers to add the searched name, and a member cannot add', async () => {
  stubApi({ directory, church: editor })
  app('/personas')
  fireEvent.change(await screen.findByLabelText('Buscar personas por nombre'), { target: { value: 'Pedro Gómez' } })
  expect(screen.getByText('Sin resultados')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Agregar «Pedro Gómez»' }))
  expect((await screen.findByLabelText('Nombre completo') as HTMLInputElement).value).toBe('Pedro Gómez')
  cleanup()
  stubApi({ directory, church: member })
  app('/personas')
  await screen.findByText('Ana Ramírez')
  expect(screen.queryByRole('button', { name: /Agregar/ })).toBeNull()
})

test('shows an empty directory and a load error with retry', async () => {
  stubApi({ directory: [] })
  app('/personas')
  expect(await screen.findByText('Aún no hay personas')).toBeTruthy()
  cleanup()
  vi.unstubAllGlobals()
  vi.stubGlobal('fetch', vi.fn(async (url: string) => (url === '/api/active-church' ? new Response(JSON.stringify(church)) : new Response('{}', { status: 500 }))))
  app('/personas')
  expect(await screen.findByText('No se pudo cargar el directorio')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
})

test('adds a person with a full name and an optional phone, then opens the record', async () => {
  const calls = stubApi({ directory, church: editor, createPerson: () => ({ body: detail({ id: 'new', name: 'Juan Pérez Rodríguez' }) }) })
  app('/personas/nueva')
  const save = await screen.findByRole('button', { name: 'Agregar persona' }) as HTMLButtonElement
  expect(save.disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Nombre completo'), { target: { value: ' Juan Pérez Rodríguez ' } })
  fireEvent.change(screen.getByLabelText('Teléfono (opcional)'), { target: { value: '555 0101' } })
  fireEvent.click(save)
  await waitFor(() => expect(sent(calls, 'POST')).toEqual([{ url: '/api/people', body: { name: 'Juan Pérez Rodríguez', phone: '555 0101' } }]))
})

test('an existing name is not created again: it asks to complete the name and links to the record', async () => {
  stubApi({ directory, church: editor, createPerson: () => ({ status: 409, body: { error: 'Name exists', existing: { id: 'p1', name: 'Ana Ramírez' } } }) })
  app('/personas/nueva')
  fireEvent.change(await screen.findByLabelText('Nombre completo'), { target: { value: 'ana ramirez' } })
  fireEvent.click(screen.getByRole('button', { name: 'Agregar persona' }))
  expect(await screen.findByText('Ya existe «Ana Ramírez»')).toBeTruthy()
  expect(screen.getByText('Ya hay una persona con ese nombre.')).toBeTruthy()
  expect(screen.queryByRole('checkbox')).toBeNull()
  fireEvent.click(screen.getByRole('link', { name: 'abre su ficha' }))
  expect(await screen.findByRole('heading', { name: 'Ana Ramírez', level: 1 })).toBeTruthy()
})

test('the record shows the account state read-only and the note about shared data', async () => {
  stubApi({ directory: [detail({ id: 'p1', hasAccount: true, sharedWithOtherChurches: true })], church: member })
  app('/personas/p1')
  expect(await screen.findByRole('heading', { name: 'Ana Ramírez', level: 1 })).toBeTruthy()
  expect(screen.getByText('Con cuenta vinculada')).toBeTruthy()
  expect(screen.getByText(/se ve igual en las demás iglesias/)).toBeTruthy()
  expect(screen.getByText(/Vincular o desvincular la cuenta lo hace el superadministrador/)).toBeTruthy()
  expect(screen.queryByLabelText('Nombre completo')).toBeNull()
  expect(screen.queryByRole('button', { name: /Quitar de/ })).toBeNull()
})

test('an editor changes name and phone; save and discard appear only when something changed', async () => {
  const calls = stubApi({ directory, church: editor, patchPerson: () => ({ body: detail({ id: 'p1', name: 'Ana Ramírez Soto', phone: '555-0199' }) }) })
  app('/personas/p1')
  const name = await screen.findByLabelText('Nombre completo') as HTMLInputElement
  expect(screen.queryByRole('button', { name: 'Guardar cambios' })).toBeNull()
  fireEvent.change(name, { target: { value: 'Ana Ramírez Soto' } })
  fireEvent.change(screen.getByLabelText('Teléfono (opcional)'), { target: { value: '555-0199' } })
  fireEvent.click(screen.getByRole('button', { name: 'Descartar cambios' }))
  expect(name.value).toBe('Ana Ramírez')
  fireEvent.change(name, { target: { value: 'Ana Ramírez Soto' } })
  fireEvent.change(screen.getByLabelText('Teléfono (opcional)'), { target: { value: '555-0199' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  expect(await screen.findByText('Cambios guardados')).toBeTruthy()
  expect(sent(calls, 'PATCH')).toEqual([{ url: '/api/people/p1', body: { name: 'Ana Ramírez Soto', phone: '555-0199' } }])
  expect(screen.queryByRole('button', { name: 'Guardar cambios' })).toBeNull()
})

test('renaming to an existing name shows the error beside the field and keeps the edit', async () => {
  stubApi({ directory, church: editor, patchPerson: () => ({ status: 409, body: { error: 'Name exists', existing: { id: 'p3', name: 'Luis Herrera' } } }) })
  app('/personas/p1')
  fireEvent.change(await screen.findByLabelText('Nombre completo'), { target: { value: 'luis herrera' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  expect(await screen.findByText(/Ya hay una persona llamada «Luis Herrera»/)).toBeTruthy()
  expect((screen.getByLabelText('Nombre completo') as HTMLInputElement).value).toBe('luis herrera')
})

test('only the administrator removes a person, after confirming; upcoming services are warned about', async () => {
  const calls = stubApi({ directory: [detail({ id: 'p1', upcomingServices: 2 }), ...directory.slice(1)], church: { ...church, canEdit: true, canConfigure: true } })
  app('/personas/p1')
  fireEvent.click(await screen.findByRole('button', { name: 'Quitar de Betel' }))
  expect(await screen.findByText(/Tiene 2 servicios próximos a su cargo/)).toBeTruthy()
  expect(sent(calls, 'DELETE')).toHaveLength(0)
  fireEvent.click(screen.getAllByRole('button', { name: 'Quitar de Betel' })[1])
  expect(await screen.findByText('Ana Ramírez ya no figura en Betel')).toBeTruthy()
  expect(sent(calls, 'DELETE')).toEqual([{ url: '/api/people/p1', body: undefined }])
})

test('an editor who is not administrator does not see the removal action', async () => {
  stubApi({ directory, church: editor })
  app('/personas/p1')
  await screen.findByLabelText('Nombre completo')
  expect(screen.queryByRole('button', { name: /Quitar de/ })).toBeNull()
})

test('a person of another church is not found', async () => {
  stubApi({ directory })
  app('/personas/otra')
  expect(await screen.findByText('No encontramos a esta persona')).toBeTruthy()
})
