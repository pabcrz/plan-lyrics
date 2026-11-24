import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { ChurchesPage } from './ChurchesPage'
import { ShellLayout } from './ShellLayout'
import { church, mount, stubApi } from './test-utils'

vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken: async () => 'token-ficticio' }), UserButton: () => <button>Cuenta</button> }))
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals() })

const myChurches = [
  { id: 'c1', name: 'Iglesia Central', role: 'ADMIN' as const },
  { id: 'c3', name: 'Iglesia Sur', role: null },
]

test('the owner sees their churches and the rest, opens one in support mode and founds another without joining it', async () => {
  const calls = stubApi({ owner: true, myChurches })
  mount(<ChurchesPage />)
  const mine = await screen.findByRole('region', { name: 'Mis iglesias' })
  expect(within(mine).getByText('Administrador')).toBeTruthy()
  expect(within(screen.getByRole('region', { name: 'Otras iglesias' })).getByText('Sin membresía · modo soporte')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Abrir Iglesia Sur' }))
  expect(localStorage.getItem('plan-lyrics.activeChurch')).toBe('c3')

  fireEvent.change(await screen.findByLabelText('Nombre de la iglesia'), { target: { value: 'Iglesia Este' } })
  fireEvent.click(screen.getByRole('switch', { name: 'Agregarme como administrador' }))
  fireEvent.click(screen.getByRole('button', { name: 'Crear iglesia' }))
  await waitFor(() => expect(calls.find((call) => call.url === '/api/churches')).toBeTruthy())
  expect(JSON.parse(String(calls.find((call) => call.url === '/api/churches')?.init?.body))).toEqual({ name: 'Iglesia Este', addMe: false })
})

test('a person who is not the owner can neither see other churches nor found one', async () => {
  stubApi({ myChurches: [myChurches[0]!] })
  mount(<ChurchesPage />)
  await screen.findByRole('region', { name: 'Mis iglesias' })
  expect(screen.queryByRole('region', { name: 'Otras iglesias' })).toBeNull()
  expect(screen.queryByRole('region', { name: 'Crear iglesia' })).toBeNull()
})

test('support mode is announced on every screen and leaving it forgets the church', async () => {
  localStorage.setItem('plan-lyrics.activeChurch', 'c3')
  stubApi({ church: { ...church, name: 'Iglesia Sur', support: true } })
  mount(<Routes><Route element={<ShellLayout />}><Route path="/" element={<p>Pantalla</p>} /><Route path="/iglesias" element={<p>Lista</p>} /></Route></Routes>)
  expect((await screen.findByRole('status')).textContent).toContain('Modo soporte · Iglesia Sur')
  fireEvent.click(screen.getByRole('button', { name: 'Salir' }))
  expect(await screen.findByText('Lista')).toBeTruthy()
  expect(localStorage.getItem('plan-lyrics.activeChurch')).toBeNull()
})
