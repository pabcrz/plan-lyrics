import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
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
  fireEvent.change(screen.getByLabelText('Teléfono (opcional)'), { target: { value: '5550101234' } })
  fireEvent.click(save)
  await waitFor(() => expect(sent(calls, 'POST')).toEqual([{ url: '/api/people', body: { name: 'Juan Pérez Rodríguez', phone: '+525550101234', canDirect: false, canPreach: false, canPlay: false } }]))
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

test('a member sees only the name, phone and a WhatsApp link', async () => {
  stubApi({ directory: [detail({ id: 'p1', hasAccount: true, sharedWithOtherChurches: true, phone: '+525512345678' })], church: member })
  app('/personas/p1')
  expect(await screen.findByRole('heading', { name: 'Ana Ramírez', level: 1 })).toBeTruthy()
  expect((screen.getByRole('link', { name: 'Contactar por WhatsApp' }) as HTMLAnchorElement).href).toBe('https://wa.me/525512345678')
  expect(screen.queryByText(/Con cuenta/)).toBeNull()
  expect(screen.queryByText(/otra iglesia|demás iglesias/)).toBeNull()
  expect(screen.queryByLabelText('Nombre completo')).toBeNull()
  expect(screen.queryByRole('button', { name: /Quitar de/ })).toBeNull()
})

test('a member sees which profile is theirs, without a WhatsApp link to themselves', async () => {
  stubApi({ directory: [detail({ id: 'p1', isYou: true, phone: '+525512345678' })], church: member })
  app('/personas/p1')
  await screen.findByRole('heading', { name: 'Ana Ramírez', level: 1 })
  expect(screen.getByText('Tú')).toBeTruthy()
  expect(screen.getByText(/gestiona el administrador/)).toBeTruthy()
  expect(screen.queryByRole('link', { name: /WhatsApp/ })).toBeNull()
})

test('the directory marks your own entry', async () => {
  stubApi({ directory: [detail({ id: 'p1', isYou: true }), detail({ id: 'p2', name: 'Álvaro Núñez' })], church: member })
  app('/personas')
  await screen.findByText('Álvaro Núñez')
  expect(screen.getAllByText('Tú')).toHaveLength(1)
})

test('an editor types only 10 digits after a fixed +52 and a legacy phone does not block a name change', async () => {
  const calls = stubApi({ directory: [detail({ id: 'p1', phone: '23342' })], church: editor, patchPerson: () => ({ body: detail({ id: 'p1', name: 'Ana Soto', phone: '23342' }) }) })
  app('/personas/p1')
  const phone = await screen.findByLabelText('Teléfono (opcional)') as HTMLInputElement
  expect(phone.value).toBe('23342')
  fireEvent.change(await screen.findByLabelText('Nombre completo'), { target: { value: 'Ana Soto' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  await waitFor(() => expect(sent(calls, 'PATCH')).toHaveLength(1))
  expect(sent(calls, 'PATCH')[0]?.body).toEqual({ name: 'Ana Soto' })
  fireEvent.change(phone, { target: { value: '55 1234-56789012' } })
  expect(phone.value).toBe('5512345678')
  fireEvent.change(phone, { target: { value: '55123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  expect(await screen.findByText('Escribe los 10 dígitos del teléfono.')).toBeTruthy()
  expect(sent(calls, 'PATCH')).toHaveLength(1)
})

test('without a usable phone a member gets no WhatsApp link', async () => {
  stubApi({ directory: [detail({ id: 'p1', phone: '23342' })], church: member })
  app('/personas/p1')
  await screen.findByRole('heading', { name: 'Ana Ramírez', level: 1 })
  expect(screen.queryByRole('link', { name: /WhatsApp/ })).toBeNull()
})

test('an editor changes name and phone; save and discard appear only when something changed', async () => {
  const calls = stubApi({ directory, church: editor, patchPerson: () => ({ body: detail({ id: 'p1', name: 'Ana Ramírez Soto', phone: '+525550199000', email: 'ana@example.com' }) }) })
  app('/personas/p1')
  const name = await screen.findByLabelText('Nombre completo') as HTMLInputElement
  expect(screen.queryByRole('button', { name: 'Guardar cambios' })).toBeNull()
  fireEvent.change(name, { target: { value: 'Ana Ramírez Soto' } })
  fireEvent.change(screen.getByLabelText('Teléfono (opcional)'), { target: { value: '5550199000' } })
  fireEvent.click(screen.getByRole('button', { name: 'Descartar cambios' }))
  expect(name.value).toBe('Ana Ramírez')
  fireEvent.change(name, { target: { value: 'Ana Ramírez Soto' } })
  fireEvent.change(screen.getByLabelText('Teléfono (opcional)'), { target: { value: '5550199000' } })
  fireEvent.change(screen.getByLabelText('Correo'), { target: { value: ' ana@example.com ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  expect(await screen.findByText('Cambios guardados')).toBeTruthy()
  expect(sent(calls, 'PATCH')).toEqual([{ url: '/api/people/p1', body: { name: 'Ana Ramírez Soto', phone: '+525550199000', email: 'ana@example.com' } }])
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

test('an administrator sets the musical roles of a person; an editor only reads them', async () => {
  const calls = stubApi({ directory: [detail({ id: 'p1', name: 'Ana Ramírez', roleIds: ['r-drums'] })], church })
  app('/personas/p1')
  const piano = await screen.findByRole('button', { name: 'Piano' })
  expect(screen.getByRole('button', { name: 'Batería' }).getAttribute('aria-pressed')).toBe('true')
  expect(screen.queryByRole('button', { name: 'Guardar roles' })).toBeNull()
  fireEvent.click(piano)
  fireEvent.click(screen.getByRole('button', { name: 'Batería' }))
  fireEvent.click(screen.getByRole('button', { name: 'Guardar roles' }))
  expect(await screen.findByText('Roles guardados')).toBeTruthy()
  expect(sent(calls, 'PUT')).toEqual([{ url: '/api/people/p1/roles', body: { roleIds: ['r-piano'] } }])
})

test('without administration the roles are text, not controls', async () => {
  stubApi({ directory: [detail({ id: 'p1', name: 'Ana Ramírez', roleIds: ['r-drums', 'r-voices'] })], church: editor })
  app('/personas/p1')
  expect(await screen.findByText('Batería, Voces')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Piano' })).toBeNull()
})

const admin: Church = { ...church, canEdit: true, canConfigure: true }
const invitesOf = (calls: ReturnType<typeof stubApi>) => sent(calls, 'POST').filter((call) => call.url.endsWith('/invite'))

test('an administrator invites from the record to the e-mail of the personal information, choosing only the role', async () => {
  const calls = stubApi({ directory: [detail({ id: 'p2', name: 'Álvaro Núñez', email: 'alvaro@example.com' })], church: admin })
  app('/personas/p2')
  expect(await screen.findByText('La invitación se envía al correo de su información personal')).toBeTruthy()
  // No second e-mail field: the address is shown, not asked again.
  expect(screen.queryByLabelText('Correo para la invitación')).toBeNull()
  expect(within(screen.getByRole('region', { name: 'Acceso a la app' })).getByText('alvaro@example.com')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Editor' }))
  fireEvent.click(screen.getByRole('button', { name: 'Invitar a la app' }))
  expect(await screen.findByText('Invitación enviada a alvaro@example.com.')).toBeTruthy()
  expect(invitesOf(calls)).toEqual([{ url: '/api/people/p2/invite', body: { role: 'EDITOR' } }])
})

test('without an e-mail the person cannot be invited: the section points to the e-mail field and highlights it', async () => {
  stubApi({ directory: [detail({ id: 'p2', name: 'Álvaro Núñez', email: null })], church: admin })
  app('/personas/p2')
  expect(await screen.findByText('Falta su correo')).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Invitar a la app' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Agregar su correo' }))
  expect(document.activeElement).toBe(screen.getByLabelText('Correo'))
  expect(screen.getByLabelText('Correo').closest('div.ring-2')).not.toBeNull()
})

test('changing the e-mail goes to the personal information, and an unsaved e-mail blocks the invitation until it is saved', async () => {
  stubApi({ directory: [detail({ id: 'p2', name: 'Álvaro Núñez', email: 'alvaro@example.com' })], church: admin })
  app('/personas/p2')
  const invite = await screen.findByRole('button', { name: 'Invitar a la app' }) as HTMLButtonElement
  expect(invite.disabled).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Cambiar correo' }))
  expect(document.activeElement).toBe(screen.getByLabelText('Correo'))
  fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'otro@example.com' } })
  expect(await screen.findByText(/Guarda los cambios de su correo antes de invitarla/)).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Invitar a la app' }) as HTMLButtonElement).disabled).toBe(true)
})

test('a registered address is explained, and who already has access sees the role instead of the form', async () => {
  stubApi({ directory: [detail({ id: 'p2', name: 'Álvaro Núñez', email: 'alvaro@example.com' })], church: admin, invite: () => ({ status: 409, body: { error: 'Email registered' } }) })
  app('/personas/p2')
  fireEvent.click(await screen.findByRole('button', { name: 'Invitar a la app' }))
  expect((await screen.findByRole('alert')).textContent).toContain('ya tiene una cuenta')
  cleanup()

  stubApi({ directory: [detail({ id: 'p1', name: 'Ana Ramírez', hasAccount: true })], church: admin, members: [{ userId: 'u1', role: 'EDITOR', self: false, protected: false, email: null, person: { id: 'p1', name: 'Ana Ramírez' } }] })
  app('/personas/p1')
  expect(await screen.findByText('Editor de servicios')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Invitar a la app' })).toBeNull()
})

test('only whoever administers the church is offered the invitation', async () => {
  stubApi({ directory: [detail({ id: 'p2', name: 'Álvaro Núñez' })], church: editor })
  app('/personas/p2')
  expect(await screen.findByText(/Quien administra .* da el acceso/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Invitar a la app' })).toBeNull()
})

test('adding a person can invite them in the same step', async () => {
  const calls = stubApi({ directory, church: admin, createPerson: () => ({ body: detail({ id: 'new', name: 'Juan Pérez Rodríguez' }) }) })
  app('/personas/nueva')
  fireEvent.change(await screen.findByLabelText('Nombre completo'), { target: { value: 'Juan Pérez Rodríguez' } })
  fireEvent.click(screen.getByRole('switch', { name: 'Invitar a la app' }))
  const save = screen.getByRole('button', { name: 'Agregar e invitar' }) as HTMLButtonElement
  expect(save.disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Correo (con el que entrará a la app)'), { target: { value: 'juan@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: 'Editor' }))
  fireEvent.click(save)
  await waitFor(() => expect(invitesOf(calls)).toEqual([{ url: '/api/people/new/invite', body: { role: 'EDITOR' } }]))
  expect(sent(calls, 'POST')[0]!.body).toMatchObject({ name: 'Juan Pérez Rodríguez', email: 'juan@example.com' })
})

const mixed = [
  detail({ id: 'a1', name: 'Abril Soto', canPlay: true, canDirect: false, canPreach: false, roleIds: ['r-voices'] }),
  detail({ id: 'a2', name: 'Fernando Maya', canPlay: false, canDirect: false, canPreach: true, roleIds: [] }),
  detail({ id: 'a3', name: 'Isaac Ruiz', canPlay: true, canDirect: true, canPreach: false, roleIds: ['r-drums', 'r-guitar'] }),
  detail({ id: 'a4', name: 'Marta Vega', canPlay: false, canDirect: false, canPreach: false, roleIds: [] }),
]
const names = () => screen.getAllByRole('button', { name: /^(Abril|Fernando|Isaac|Marta)/ }).map((item) => item.querySelector('b')?.textContent)
const preaching: Church = { ...church, usesPreaching: true }

test('the directory separates the worship group, direction and preaching from everyone else, with counts', async () => {
  stubApi({ directory: mixed, church: preaching })
  app('/personas')
  await screen.findByText('Abril Soto')
  expect(screen.getByRole('button', { name: /^Todas 4/ })).toBeTruthy()
  expect(screen.getByRole('button', { name: /^Alabanza 2/ })).toBeTruthy()
  expect(screen.getByRole('button', { name: /^Dirección 1/ })).toBeTruthy()
  expect(screen.getByRole('button', { name: /^Predicación 1/ })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /^Alabanza/ }))
  expect(names()).toEqual(['Abril Soto', 'Isaac Ruiz'])
  // Each row says the musical roles of the group and the other jobs.
  expect(screen.getByText('Batería, Guitarra · Dirige')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /^Predicación/ }))
  expect(names()).toEqual(['Fernando Maya'])
  fireEvent.click(screen.getByRole('button', { name: /^Todas/ }))
  expect(names()).toHaveLength(4)
})

test('a church without preaching has no preaching filter, and an empty group explains how to fill it', async () => {
  stubApi({ directory: [mixed[1]!, mixed[3]!], church })
  app('/personas')
  await screen.findByText('Fernando Maya')
  expect(screen.queryByRole('button', { name: /^Predicación/ })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /^Alabanza/ }))
  expect(await screen.findByText(/Nadie está en el grupo de alabanza todavía/)).toBeTruthy()
})

test('musical roles only exist for the worship group: without it the record offers none and says how to get them', async () => {
  const calls = stubApi({ directory: [mixed[1]!], church: admin })
  app('/personas/a2')
  expect(await screen.findByText('Sin roles de alabanza')).toBeTruthy()
  expect(screen.queryByRole('group', { name: 'Roles de la persona' })).toBeNull()
  fireEvent.click(screen.getByRole('switch', { name: 'Grupo de alabanza' }))
  await waitFor(() => expect(calls.filter((call) => call.init?.method === 'PATCH').map((call) => JSON.parse(String(call.init?.body)))).toEqual([{ canDirect: false, canPreach: true, canPlay: true }]))
})

test('someone in the worship group has the roles section; leaving it while still habitual in a role is explained', async () => {
  stubApi({ directory: [mixed[2]!], church: admin, patchPerson: () => ({ status: 409, body: { error: 'In use' } }) })
  app('/personas/a3')
  expect(await screen.findByRole('group', { name: 'Roles de la persona' })).toBeTruthy()
  fireEvent.click(screen.getByRole('switch', { name: 'Grupo de alabanza' }))
  expect((await screen.findByRole('alert')).textContent).toContain('habitual o en una rotación')
  expect((screen.getByRole('switch', { name: 'Grupo de alabanza' }) as HTMLButtonElement).getAttribute('aria-checked')).toBe('true')
})
