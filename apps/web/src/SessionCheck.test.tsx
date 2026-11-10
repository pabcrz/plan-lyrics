import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { SessionCheck } from './SessionCheck'

const getToken = vi.hoisted(() => vi.fn())
vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken }) }))
const fixture = 'fictitious-token-not-valid-outside-this-test'

beforeEach(() => {
  getToken.mockReset().mockResolvedValue(fixture)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

function check() {
  render(<SessionCheck />)
  fireEvent.click(screen.getByRole('button', { name: 'Comprobar sesión en API' }))
}

test('gets a fresh token on demand and sends Bearer without storing or displaying it', async () => {
  const store = vi.spyOn(Storage.prototype, 'setItem')
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ authenticated: true })))
  vi.stubGlobal('fetch', fetcher)
  check()
  expect(screen.getByRole('button')).toHaveProperty('disabled', true)
  expect(screen.getByText('Verificando sesión en API…')).toBeTruthy()
  await screen.findByText('Sesión verificada por la API. Permisos de iglesia aún pendientes.')
  expect(getToken).toHaveBeenCalledOnce()
  expect(fetcher).toHaveBeenCalledExactlyOnceWith('/api/session', {
    headers: { Authorization: `Bearer ${fixture}` }, cache: 'no-store', credentials: 'omit',
  })
  expect(store).not.toHaveBeenCalled()
  expect(document.body.textContent).not.toContain(fixture)
  expect(screen.getByRole('button')).toHaveProperty('disabled', false)
})

test('does not send an unauthenticated request when Clerk has no token', async () => {
  getToken.mockResolvedValue(null)
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  check()
  await screen.findByText('No hay una sesión válida para la API. Volvé a iniciar sesión.')
  expect(fetcher).not.toHaveBeenCalled()
})

test.each([
  [401, 'No hay una sesión válida para la API. Volvé a iniciar sesión.'],
  [503, 'La autenticación de la API no está configurada o no está disponible.'],
])('reports API rejection %i without claiming verification', async (status, message) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: status as number })))
  check()
  expect((await screen.findByRole('alert')).textContent).toBe(message)
  expect(screen.queryByText('Sesión verificada por la API. Permisos de iglesia aún pendientes.')).toBeNull()
})

test('a nonconforming success response does not become verified identity', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')))
  check()
  expect((await screen.findByRole('alert')).textContent).toBe('No se pudo comprobar la sesión en la API.')
})

test('token acquisition failure is visible without leaking details or calling API', async () => {
  getToken.mockRejectedValue(new Error(fixture))
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  check()
  await screen.findByText('No se pudo comprobar la sesión en la API.')
  expect(document.body.textContent).not.toContain(fixture)
  expect(fetcher).not.toHaveBeenCalled()
})
