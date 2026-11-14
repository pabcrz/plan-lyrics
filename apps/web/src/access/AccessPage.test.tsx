import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { church, mount } from '../calendar/test-utils'
import { AccessPage } from './AccessPage'
import { members, stubAccess } from './test-utils'

vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken: async () => 'token-ficticio' }), UserButton: () => <button>Cuenta</button> }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const app = () => mount(<Routes><Route path="/accesos" element={<AccessPage />} /><Route path="/ajustes" element={<p>Ajustes</p>} /></Routes>, '/accesos')
const sent = (calls: ReturnType<typeof stubAccess>, method: string) => calls.filter((call) => call.method === method && call.url.startsWith('/api/members')).map(({ url, body }) => ({ url, body }))

test('lists the members of the church with their role, marks you, and protects the superadministrator', async () => {
  stubAccess()
  app()
  expect(await screen.findByText('Ana Ramírez')).toBeTruthy()
  expect(screen.getByText('Tú')).toBeTruthy()
  expect(screen.getByText('Luis Herrera')).toBeTruthy()
  expect(screen.getByText('Cuenta sin persona vinculada')).toBeTruthy()
  expect(screen.getAllByText('Administrador').length).toBeGreaterThan(0)
  expect(screen.getByText('Editor de servicios')).toBeTruthy()
  // The owner's membership is not editable from a church screen.
  expect(screen.getByText('Superadministrador')).toBeTruthy()
  expect(screen.queryByRole('button', { name: /Pablo Cruz/ })).toBeNull()
})

test('offers no account creation or invitation here: that belongs to «Cuentas»', async () => {
  stubAccess()
  app()
  await screen.findByText('Ana Ramírez')
  expect(screen.queryByLabelText(/correo/i)).toBeNull()
  expect(screen.queryByRole('button', { name: /invitar/i })).toBeNull()
  expect(screen.queryByText(/biblioteca/i)).toBeNull()
})

test('changing a role sends only the role (the church never goes in the request) and shows the new one', async () => {
  const calls = stubAccess()
  app()
  fireEvent.click(await screen.findByRole('button', { name: /Luis Herrera/ }))
  const sheet = within(await screen.findByRole('dialog'))
  expect(sheet.getByRole('button', { name: 'Editor' }).getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(sheet.getByRole('button', { name: 'Integrante' }))
  fireEvent.click(sheet.getByRole('button', { name: 'Guardar rol' }))
  await waitFor(() => expect(sent(calls, 'PATCH')).toEqual([{ url: '/api/members/u-editor', body: { role: 'MEMBER' } }]))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.queryByText('Editor de servicios')).toBeNull()
})

test('removing asks for confirmation first and then deletes the membership only', async () => {
  const calls = stubAccess()
  app()
  fireEvent.click(await screen.findByRole('button', { name: /Luis Herrera/ }))
  fireEvent.click(await screen.findByRole('button', { name: 'Quitar de Betel' }))
  expect(sent(calls, 'DELETE')).toEqual([])
  expect(await screen.findByText(/seguirá en el directorio/i)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Sí, quitar acceso' }))
  await waitFor(() => expect(sent(calls, 'DELETE')).toEqual([{ url: '/api/members/u-editor', body: undefined }]))
  await waitFor(() => expect(screen.queryByText('Luis Herrera')).toBeNull())
})

test('explains why the last administrator cannot be demoted', async () => {
  stubAccess({ fail: { 'PATCH /api/members/u-admin': { status: 409, body: { error: 'Last administrator' } } } })
  app()
  fireEvent.click(await screen.findByRole('button', { name: /Ana Ramírez/ }))
  const sheet = within(await screen.findByRole('dialog'))
  fireEvent.click(sheet.getByRole('button', { name: 'Integrante' }))
  fireEvent.click(sheet.getByRole('button', { name: 'Guardar rol' }))
  expect((await screen.findByRole('alert')).textContent).toMatch(/al menos un administrador/)
})

test('adds a member from the people who already have an account, with the chosen role', async () => {
  const calls = stubAccess()
  app()
  fireEvent.click(await screen.findByRole('button', { name: /Agregar miembro/ }))
  const sheet = within(await screen.findByRole('dialog'))
  fireEvent.click(sheet.getByRole('button', { name: /Marta Solís/ }))
  fireEvent.click(sheet.getByRole('button', { name: 'Editor' }))
  fireEvent.click(sheet.getByRole('button', { name: 'Dar acceso' }))
  await waitFor(() => expect(sent(calls, 'POST')).toEqual([{ url: '/api/members', body: { personId: 'p-new', role: 'EDITOR' } }]))
  expect(await screen.findByText('Marta Solís')).toBeTruthy()
})

test('without candidates it points to «Cuentas» instead of creating accounts', async () => {
  stubAccess({ members: { members, candidates: [] } })
  app()
  fireEvent.click(await screen.findByRole('button', { name: /Agregar miembro/ }))
  expect(await screen.findByText(/superadministrador o un gestor de cuentas/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Dar acceso' })).toBeNull()
})

test('names the unavailable-account conflict instead of failing silently', async () => {
  stubAccess({ fail: { 'POST /api/members': { status: 409, body: { error: 'Account unavailable' } } } })
  app()
  fireEvent.click(await screen.findByRole('button', { name: /Agregar miembro/ }))
  const sheet = within(await screen.findByRole('dialog'))
  fireEvent.click(sheet.getByRole('button', { name: /Marta Solís/ }))
  fireEvent.click(sheet.getByRole('button', { name: 'Dar acceso' }))
  expect((await screen.findByRole('alert')).textContent).toMatch(/ya pertenece a otra iglesia/)
})

test('someone who does not administrate the church only reads a notice and the list is never requested', async () => {
  const calls = stubAccess({ church: { ...church, canConfigure: false } })
  app()
  expect(await screen.findByText('Solo administradores')).toBeTruthy()
  expect(calls.some((call) => call.url === '/api/members')).toBe(false)
})

test('shows a load error with retry', async () => {
  stubAccess({ members: 500 })
  app()
  expect(await screen.findByText('No se pudo cargar la lista de accesos')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
})
