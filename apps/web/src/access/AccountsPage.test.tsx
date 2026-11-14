import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { ChurchGate } from '../calendar/ChurchGate'
import { mount } from '../calendar/test-utils'
import { AccountsPage } from './AccountsPage'
import { stubAccess } from './test-utils'

vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken: async () => 'token-ficticio' }), UserButton: () => <button>Cuenta</button> }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const app = (path = '/cuentas') => mount(<Routes><Route path="/cuentas" element={<AccountsPage />} /><Route path="/" element={<ChurchGate>{() => <p>Calendario</p>}</ChurchGate>} /></Routes>, path)
const manager = { owner: false, accountManager: true }
const owner = { owner: true, accountManager: false }
const sent = (calls: ReturnType<typeof stubAccess>, method: string) => calls.filter((call) => call.method === method && call.url !== '/api/access').map(({ url, body }) => ({ url, body }))

test('without the capability it shows a notice and never asks for the accounts', async () => {
  const calls = stubAccess({ access: { owner: false, accountManager: false } })
  app()
  expect(await screen.findByText('Sin permiso para gestionar cuentas')).toBeTruthy()
  expect(calls.some((call) => call.url === '/api/accounts')).toBe(false)
  expect(screen.queryByLabelText('Correo electrónico')).toBeNull()
})

test('an account manager invites by e-mail and sees the confirmation', async () => {
  const calls = stubAccess({ access: manager })
  app()
  fireEvent.change(await screen.findByLabelText('Correo electrónico'), { target: { value: 'Marta@Example.com' } })
  fireEvent.click(screen.getByRole('button', { name: 'Enviar invitación' }))
  await waitFor(() => expect(sent(calls, 'POST')).toEqual([{ url: '/api/accounts', body: { email: 'Marta@Example.com' } }]))
  expect(await screen.findByText(/Invitación enviada a/)).toBeTruthy()
  expect((screen.getByLabelText('Correo electrónico') as HTMLInputElement).value).toBe('')
})

test('an invalid e-mail is caught before sending, and provider failures are explained', async () => {
  const calls = stubAccess({ access: manager, fail: { 'POST /api/accounts': { status: 502, body: { error: 'Identity provider unavailable' } } } })
  app()
  fireEvent.change(await screen.findByLabelText('Correo electrónico'), { target: { value: 'sin-arroba' } })
  fireEvent.click(screen.getByRole('button', { name: 'Enviar invitación' }))
  expect(await screen.findByText('Escribe un correo válido.')).toBeTruthy()
  expect(sent(calls, 'POST')).toEqual([])
  fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'ana@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: 'Enviar invitación' }))
  expect((await screen.findByRole('alert')).textContent).toMatch(/proveedor de acceso no respondió/)
})

test('says when the server has no identity provider configured', async () => {
  stubAccess({ access: owner, fail: { 'POST /api/accounts': { status: 503, body: { error: 'Identity provider unavailable' } } } })
  app()
  fireEvent.change(await screen.findByLabelText('Correo electrónico'), { target: { value: 'ana@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: 'Enviar invitación' }))
  expect((await screen.findByRole('alert')).textContent).toMatch(/todavía no está configurado/)
})

test('an account manager links and unlinks a person, but cannot change capabilities or touch the owner account', async () => {
  const calls = stubAccess({ access: manager })
  app()
  fireEvent.click(await screen.findByRole('button', { name: /nuevo@example.com/ }))
  let sheet = within(await screen.findByRole('dialog'))
  expect(sheet.queryByRole('switch')).toBeNull()
  fireEvent.click(sheet.getByRole('button', { name: /Marta Solís/ }))
  fireEvent.click(sheet.getByRole('button', { name: 'Vincular persona' }))
  await waitFor(() => expect(sent(calls, 'PUT')).toEqual([{ url: '/api/accounts/a2/person', body: { personId: 'p-free' } }]))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  fireEvent.click(await screen.findByRole('button', { name: /ana@example.com/ }))
  sheet = within(await screen.findByRole('dialog'))
  fireEvent.click(sheet.getByRole('button', { name: 'Desvincular persona' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Sí, desvincular' }))
  await waitFor(() => expect(sent(calls, 'DELETE')).toEqual([{ url: '/api/accounts/a1/person', body: undefined }]))
  expect(screen.queryByRole('button', { name: /Superadministrador/ })).toBeNull()
})

test('the owner grants the account-manager capability and library editing', async () => {
  const calls = stubAccess({ access: owner, accounts: undefined })
  app()
  fireEvent.click(await screen.findByRole('button', { name: /ana@example.com/ }))
  const sheet = within(await screen.findByRole('dialog'))
  fireEvent.click(sheet.getByRole('switch', { name: /Gestor de cuentas/ }))
  await waitFor(() => expect(sent(calls, 'PUT')).toContainEqual({ url: '/api/users/a1/account-manager', body: { enabled: true } }))
  fireEvent.click(sheet.getByRole('switch', { name: /Editor de biblioteca/ }))
  await waitFor(() => expect(sent(calls, 'PUT')).toContainEqual({ url: '/api/accounts/a1/library-editor', body: { enabled: true } }))
  // Library editing never mentions church access, and the owner row has no switches.
  expect(sheet.getByText(/no da acceso a ninguna iglesia/i)).toBeTruthy()
})

test('the owner account is shown as protected', async () => {
  stubAccess({ access: owner })
  app()
  fireEvent.click(await screen.findByRole('button', { name: /Pablo Cruz/ }))
  const sheet = within(await screen.findByRole('dialog'))
  expect(sheet.getByText(/superadministrador es único/i)).toBeTruthy()
  expect(sheet.queryByRole('switch')).toBeNull()
})

test('without a church, a manager reaches «Cuentas» from the empty state', async () => {
  stubAccess({ access: manager, church: 404 })
  app('/')
  expect(await screen.findByText('Sin iglesia asignada')).toBeTruthy()
  fireEvent.click(await screen.findByRole('button', { name: 'Gestionar cuentas' }))
  expect(await screen.findByLabelText('Correo electrónico')).toBeTruthy()
})

test('shows a load error with retry', async () => {
  stubAccess({ access: owner, accounts: 500 })
  app()
  expect(await screen.findByText('No se pudieron cargar las cuentas')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
})
