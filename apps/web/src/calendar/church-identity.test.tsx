import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { TopBar } from './ChurchGate'
import { ChurchAccentSync, ChurchColorNotice } from './church-identity'
import { churchColorsStore } from './church-colors'
import { church as base, mount, stubApi } from './test-utils'

vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken: async () => 'token-ficticio' }), UserButton: () => <button>Cuenta</button> }))

const two = [{ id: 'church-a', name: 'Betel', role: 'ADMIN' as const }, { id: 'c2', name: 'Iglesia de Cristo', role: 'EDITOR' as const }]
const root = document.documentElement
const church = (patch: { id: string; name: string }) => ({ ...base, ...patch })

beforeEach(() => { localStorage.clear(); churchColorsStore.set({}); delete root.dataset.accent })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

test('the header always shows which church you are in, with its own color when there are several', async () => {
  stubApi({ church: church({ id: 'c2', name: 'Iglesia de Cristo' }), myChurches: two })
  mount(<TopBar name="Iglesia de Cristo" />)
  expect(await screen.findByRole('button', { name: /Iglesia de Cristo\. Cambiar de iglesia/ })).toBeTruthy()
  await waitFor(() => expect(document.querySelector('[data-church-badge].tone')).not.toBeNull())
})

test('with one church the header badge keeps the app color', async () => {
  stubApi({ church: church({ id: 'church-a', name: 'Betel' }), myChurches: [two[0]!] })
  mount(<TopBar name="Betel" />)
  await screen.findByText('Betel')
  expect(document.querySelector('[data-church-badge]')?.classList.contains('tone')).toBe(false)
})

test('the appearance sheet offers fixed or by church only with several churches, and picks each church color', async () => {
  stubApi({ church: church({ id: 'church-a', name: 'Betel' }), myChurches: two })
  mount(<><ChurchAccentSync /><TopBar name="Betel" /></>)
  await waitFor(() => expect(document.querySelector('[data-church-badge].tone')).not.toBeNull())
  fireEvent.click(screen.getByRole('button', { name: 'Apariencia' }))
  expect(await screen.findByRole('button', { name: 'Fijo' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Según la iglesia' }))
  expect(await screen.findByText('Color de cada iglesia')).toBeTruthy()
  fireEvent.click(screen.getByRole('group', { name: 'Color de Betel' }).querySelectorAll('button')[3]!)
  expect(JSON.parse(localStorage.getItem('plan-lyrics.churchColors') ?? '{}')['church-a']).toBe('ocre')
  await waitFor(() => expect(root.dataset.accent).toBe('ocre'))
})

test('the app color follows the active church only after choosing «Según la iglesia»', async () => {
  stubApi({ church: church({ id: 'church-a', name: 'Betel' }), myChurches: two })
  mount(<ChurchAccentSync />)
  await waitFor(() => expect(localStorage.getItem('plan-lyrics.churchAccent')).toBe('salvia'))
  expect(root.dataset.accent ?? 'azul').toBe('azul')
  cleanup()
  localStorage.setItem('plan-lyrics.appearance', JSON.stringify({ accent: 'azul', mode: 'light', byChurch: true }))
  stubApi({ church: church({ id: 'church-a', name: 'Betel' }), myChurches: two })
  mount(<ChurchAccentSync />)
  await waitFor(() => expect(root.dataset.accent).toBe('salvia'))
})

test('the availability notice appears once to people with several churches and can turn the option on', async () => {
  stubApi({ church: church({ id: 'church-a', name: 'Betel' }), myChurches: two })
  mount(<ChurchColorNotice />)
  expect(await screen.findByText('Un color para cada iglesia')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Activarlo' }))
  expect(JSON.parse(localStorage.getItem('plan-lyrics.appearance') ?? '{}').byChurch).toBe(true)
  expect(screen.queryByText('Un color para cada iglesia')).toBeNull()
  cleanup()
  stubApi({ church: church({ id: 'church-a', name: 'Betel' }), myChurches: two })
  mount(<ChurchColorNotice />)
  await waitFor(() => expect(screen.queryByText('Un color para cada iglesia')).toBeNull())
})

test('people with one church never see the notice', async () => {
  stubApi({ church: church({ id: 'church-a', name: 'Betel' }), myChurches: [two[0]!] })
  mount(<ChurchColorNotice />)
  await new Promise((resolve) => setTimeout(resolve, 20))
  expect(screen.queryByText('Un color para cada iglesia')).toBeNull()
})
