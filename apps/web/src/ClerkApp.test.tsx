import type { ReactNode } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { ClerkApp } from './ClerkApp'

const clerk = vi.hoisted(() => ({
  state: 'ready', signedIn: false, provider: vi.fn(), signIn: vi.fn(),
}))

type Children = { children: ReactNode }
vi.mock('@clerk/react', () => ({
  useAuth: () => ({ getToken: async () => 'token-ficticio' }),
  ClerkProvider: ({ children, ...props }: Children) => {
    clerk.provider(props)
    return children
  },
  ClerkLoading: ({ children }: Children) => clerk.state === 'loading' ? children : null,
  ClerkFailed: ({ children }: Children) => clerk.state === 'failed' ? children : null,
  ClerkLoaded: ({ children }: Children) => clerk.state === 'ready' ? children : null,
  Show: ({ when, children }: Children & { when: string }) =>
    (when === 'signed-in') === clerk.signedIn ? children : null,
  SignInButton: ({ children, ...props }: Children) => {
    clerk.signIn(props)
    return children
  },
  UserButton: () => <button>Cuenta de Clerk</button>,
}))

// Fictitious public identifier used only with the SDK double, never a real session.
const publicKey = 'pk_test_Zml4dHVyZS5leGFtcGxlLmNvbSQ='

beforeEach(() => {
  clerk.state = 'ready'
  clerk.signedIn = false
  vi.clearAllMocks()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ status: 'ok', service: 'plan-lyrics-api' })),
  ))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function mount(publishableKey?: string) {
  render(<QueryClientProvider client={new QueryClient()}>
    <ClerkApp publishableKey={publishableKey} />
  </QueryClientProvider>)
}

test('missing key keeps health usable and does not initialize Clerk', async () => {
  mount()
  await screen.findByText('API disponible')
  expect(screen.getByText('Clerk pendiente: configurá VITE_CLERK_PUBLISHABLE_KEY.')).toBeTruthy()
  expect(clerk.provider).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Iniciar sesión' })).toBeNull()
})

test('a secret key is rejected without reflection or initializing the SDK', () => {
  const forbidden = 'sk_test_never_expose_this_value'
  mount(forbidden)
  expect(screen.getByRole('alert').textContent).toBe('Configuración de Clerk inválida: usá únicamente una clave publicable.')
  expect(document.body.textContent).not.toContain(forbidden)
  expect(clerk.provider).not.toHaveBeenCalled()
})

test('loading does not claim a session or offer account controls', () => {
  clerk.state = 'loading'
  mount(publicKey)
  expect(screen.getByText('Cargando autenticación…')).toBeTruthy()
  expect(screen.queryByRole('button')).toBeNull()
})

test('SDK failure is visible without granting access', () => {
  clerk.state = 'failed'
  mount(publicKey)
  expect(screen.getByRole('alert').textContent).toBe('No se pudo cargar Clerk. Recargá la página para reintentar.')
  expect(screen.queryByRole('button')).toBeNull()
})

test('signed-out view delegates modal sign-in to Clerk', () => {
  mount(publicKey)
  expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Cuenta de Clerk' })).toBeNull()
  expect(clerk.signIn).toHaveBeenCalledWith({ mode: 'modal' })
  expect(clerk.provider).toHaveBeenCalledWith({ publishableKey: publicKey, afterSignOutUrl: '/' })
})

test('signed-in view hands over to the product screens, with the Clerk account', async () => {
  clerk.signedIn = true
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })))
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><ClerkApp publishableKey={publicKey} /></MemoryRouter></QueryClientProvider>)
  expect(await screen.findByText('Sin iglesia asignada')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Cuenta de Clerk' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Iniciar sesión' })).toBeNull()
})
