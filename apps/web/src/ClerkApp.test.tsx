import type { ReactNode } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { esMX } from '@clerk/localizations'
import { ClerkApp } from './ClerkApp'

const clerk = vi.hoisted(() => ({
  state: 'ready', signedIn: false, provider: vi.fn(), signIn: vi.fn(),
}))

type Children = { children: ReactNode }
vi.mock('@clerk/react', () => ({
  useAuth: () => ({ getToken: async () => 'token-ficticio' }),
  useUser: () => ({ user: { id: 'user-ficticio' } }),
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
  expect(screen.queryByText(/Clerk pendiente/)).toBeNull()
  expect(clerk.provider).not.toHaveBeenCalled()
  expect((screen.getByRole('button', { name: 'Iniciar sesión' }) as HTMLButtonElement).disabled).toBe(true)
})

test('a secret key is rejected without reflection or initializing the SDK', () => {
  const forbidden = 'sk_test_never_expose_this_value'
  mount(forbidden)
  expect((screen.getByRole('button', { name: 'Iniciar sesión' }) as HTMLButtonElement).disabled).toBe(true)
  expect(document.body.textContent).not.toContain(forbidden)
  expect(clerk.provider).not.toHaveBeenCalled()
})

test('loading does not claim a session or offer account controls', () => {
  clerk.state = 'loading'
  mount(publicKey)
  expect(screen.getByText('Cargando autenticación…')).toBeTruthy()
  expect(screen.queryByRole('button', { name: /Iniciar sesión|Cuenta/ })).toBeNull()
})

test('SDK failure is visible without granting access', () => {
  clerk.state = 'failed'
  mount(publicKey)
  expect(screen.getByRole('alert').textContent).toBe('No se pudo cargar Clerk. Recargá la página para reintentar.')
  expect(screen.queryByRole('button', { name: /Iniciar sesión|Cuenta/ })).toBeNull()
})

test('without Clerk but with saved data the product opens read-only instead of the failure', async () => {
  clerk.state = 'failed'
  const { restoreCache, forgetCache } = await import('./offline-cache')
  localStorage.setItem('plan-lyrics.cache', JSON.stringify({ v: 1, owner: 'user-ficticio', church: null, queries: [{ key: ['church'], data: { id: 'c1', name: 'Betel', canEdit: false, canConfigure: false, usesPreaching: false, days: [] } }] }))
  const client = new QueryClient()
  restoreCache(client)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'x' }), { status: 503 })))
  render(<QueryClientProvider client={client}><MemoryRouter><ClerkApp publishableKey={publicKey} /></MemoryRouter></QueryClientProvider>)
  expect((await screen.findAllByText('Betel')).length).toBeGreaterThan(0)
  expect(screen.queryByText('No se pudo cargar Clerk. Recargá la página para reintentar.')).toBeNull()
  forgetCache()
})

test('signed-out view delegates modal sign-in to Clerk', () => {
  mount(publicKey)
  expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Cuenta de Clerk' })).toBeNull()
  expect(clerk.signIn).toHaveBeenCalledWith({ mode: 'modal' })
  expect(clerk.provider).toHaveBeenCalledWith({ publishableKey: publicKey, afterSignOutUrl: '/', localization: esMX })
})

test('signed-in view hands over to the product screens, with the Clerk account', async () => {
  clerk.signedIn = true
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })))
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><ClerkApp publishableKey={publicKey} /></MemoryRouter></QueryClientProvider>)
  expect(await screen.findByText('Sin iglesia asignada')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Cuenta de Clerk' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Iniciar sesión' })).toBeNull()
})
