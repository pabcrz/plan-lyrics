import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { InstallBar } from './InstallBar'
import { watchInstall } from './install'

beforeAll(() => watchInstall())
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks() })

const offerInstall = () => {
  const prompt = vi.fn(async () => undefined)
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome: 'accepted' as const }) })
  act(() => { window.dispatchEvent(event) })
  return { prompt, event }
}

test('offers to install when the browser allows it, and asks the browser when the person accepts', async () => {
  render(<InstallBar />)
  expect(screen.queryByRole('region', { name: 'Instalar la aplicación' })).toBeNull()
  const { prompt, event } = offerInstall()
  expect(event.defaultPrevented).toBe(true)
  fireEvent.click(await screen.findByRole('button', { name: 'Instalar' }))
  await vi.waitFor(() => expect(prompt).toHaveBeenCalledTimes(1))
  await vi.waitFor(() => expect(screen.queryByRole('region', { name: 'Instalar la aplicación' })).toBeNull())
})

test('postponing hides the offer for later visits too', async () => {
  offerInstall()
  const { unmount } = render(<InstallBar />)
  fireEvent.click(await screen.findByRole('button', { name: 'Ahora no' }))
  expect(screen.queryByRole('region', { name: 'Instalar la aplicación' })).toBeNull()
  unmount()
  offerInstall()
  render(<InstallBar />)
  expect(screen.queryByRole('region', { name: 'Instalar la aplicación' })).toBeNull()
})

test('an installed app is never asked to install again', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  offerInstall()
  render(<InstallBar />)
  expect(screen.queryByRole('region', { name: 'Instalar la aplicación' })).toBeNull()
  vi.unstubAllGlobals()
})
