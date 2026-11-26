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
  useAuth: () => ({ getToken: async () => 'token-ficticio', isLoaded: clerk.state === 'ready', isSignedIn: clerk.state === 'ready' && clerk.signedIn }),
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
  expect((screen.getByRole('button', { name: 'Iniciar sesión' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.queryByRole('button', { name: /Cuenta/ })).toBeNull()
})

test('SDK failure is visible without granting access', () => {
  clerk.state = 'failed'
  mount(publicKey)
  expect(screen.getByRole('alert').textContent).toBe('No se pudo preparar el inicio de sesión. Revisa tu conexión.')
  expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: /Iniciar sesión|Cuenta/ })).toBeNull()
})

test.each(['loading', 'failed'])('with saved data the product opens at once while Clerk is %s', async (state) => {
  clerk.state = state
  const { restoreCache, forgetCache } = await import('./offline-cache')
  localStorage.setItem('plan-lyrics.cache', JSON.stringify({ v: 1, owner: 'user-ficticio', church: null, queries: [{ key: ['church'], data: { id: 'c1', name: 'Betel', canEdit: false, canConfigure: false, usesPreaching: false, days: [] } }] }))
  const client = new QueryClient()
  restoreCache(client)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'x' }), { status: 503 })))
  render(<QueryClientProvider client={client}><MemoryRouter><ClerkApp publishableKey={publicKey} /></MemoryRouter></QueryClientProvider>)
  expect((await screen.findAllByText('Betel')).length).toBeGreaterThan(0)
  expect(screen.queryByRole('button', { name: 'Iniciar sesión' })).toBeNull()
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

test.each([true, false])('when Clerk answers after opening with saved data (signed in: %s) the product stays or closes', async (signedIn) => {
  clerk.state = 'loading'
  const { restoreCache, hasOfflineData } = await import('./offline-cache')
  localStorage.setItem('plan-lyrics.cache', JSON.stringify({ v: 1, owner: 'user-ficticio', church: null, queries: [{ key: ['church'], data: { id: 'c1', name: 'Betel', canEdit: false, canConfigure: false, usesPreaching: false, days: [] } }] }))
  const client = new QueryClient()
  restoreCache(client)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'x' }), { status: 503 })))
  const tree = () => <QueryClientProvider client={client}><MemoryRouter><ClerkApp publishableKey={publicKey} /></MemoryRouter></QueryClientProvider>
  const view = render(tree())
  const main = (await screen.findAllByRole('main'))[0]
  clerk.state = 'ready'
  clerk.signedIn = signedIn
  view.rerender(tree())
  if (signedIn) expect(screen.getAllByRole('main')[0]).toBe(main)
  else {
    expect(await screen.findByRole('button', { name: 'Iniciar sesión' })).toBeTruthy()
    expect(hasOfflineData()).toBe(false)
    expect(localStorage.getItem('plan-lyrics.cache')).toBeNull()
  }
})

test('opened without Clerk, it offers to reload and reloads by itself when the network returns', async () => {
  clerk.state = 'failed'
  const { restoreCache, forgetCache } = await import('./offline-cache')
  localStorage.setItem('plan-lyrics.cache', JSON.stringify({ v: 1, owner: 'user-ficticio', church: null, queries: [{ key: ['church'], data: { id: 'c1', name: 'Betel', canEdit: false, canConfigure: false, usesPreaching: false, days: [] } }] }))
  const client = new QueryClient()
  restoreCache(client)
  const reload = vi.fn()
  vi.stubGlobal('location', { ...window.location, reload })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'x' }), { status: 503 })))
  render(<QueryClientProvider client={client}><MemoryRouter><ClerkApp publishableKey={publicKey} /></MemoryRouter></QueryClientProvider>)
  expect(await screen.findByRole('button', { name: 'Recargar' })).toBeTruthy()
  window.dispatchEvent(new Event('online'))
  expect(reload).toHaveBeenCalledOnce()
  forgetCache()
})
