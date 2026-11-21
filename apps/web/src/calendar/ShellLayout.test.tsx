import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { ShellLayout } from './ShellLayout'
import { church, mount, stubApi } from './test-utils'

vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken: async () => 'token-ficticio' }), UserButton: () => <button>Cuenta</button> }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const app = (path: string) => mount(
  <Routes>
    <Route element={<ShellLayout />}>
      <Route path="/" element={<p>Pantalla de inicio</p>} />
      <Route path="/ajustes" element={<p>Pantalla de ajustes</p>} />
      <Route path="/accesos" element={<p>Pantalla de accesos</p>} />
      <Route path="/servicios/nuevo" element={<p>Pantalla de servicio nuevo</p>} />
    </Route>
  </Routes>, path)

test('the sidebar frames every screen, secondary ones included, and marks where you are', async () => {
  stubApi({})
  app('/')
  const nav = await screen.findByRole('navigation', { name: 'Secciones' })
  expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['Inicio', 'Canciones', 'Personas', 'Compartir', 'Participaciones', 'Ajustes'])
  expect(within(nav).getByRole('link', { name: 'Inicio' }).getAttribute('aria-current')).toBe('page')
  expect(within(nav).getByRole('link', { name: 'Canciones' }).getAttribute('href')).toBe('/canciones')
  cleanup()
  stubApi({})
  app('/ajustes')
  const settings = await screen.findByRole('navigation', { name: 'Secciones' })
  expect(screen.getByText('Pantalla de ajustes')).toBeTruthy()
  expect(within(settings).getByRole('link', { name: 'Ajustes' }).getAttribute('aria-current')).toBe('page')
  expect(within(settings).getByRole('link', { name: 'Inicio' }).getAttribute('aria-current')).toBeNull()
  cleanup()
  stubApi({})
  app('/accesos')
  expect(within(await screen.findByRole('navigation', { name: 'Secciones' })).getByRole('link', { name: 'Ajustes' }).getAttribute('aria-current')).toBe('page')
  cleanup()
  stubApi({})
  app('/servicios/nuevo')
  expect(within(await screen.findByRole('navigation', { name: 'Secciones' })).getByRole('link', { name: 'Inicio' }).getAttribute('aria-current')).toBe('page')
})

test('«Nuevo servicio» opens the creation choices for whoever edits', async () => {
  stubApi({})
  app('/ajustes')
  fireEvent.click(await screen.findByRole('button', { name: 'Nuevo servicio' }))
  expect(within(screen.getByRole('dialog', { name: 'Nuevo' })).getByRole('button', { name: /Lote mensual/ })).toBeTruthy()
})

test('a reader gets the three sections with no creation and no «Más» group', async () => {
  stubApi({ church: { ...church, canEdit: false, canConfigure: false } })
  app('/')
  const nav = await screen.findByRole('navigation', { name: 'Secciones' })
  expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['Inicio', 'Canciones', 'Personas'])
  expect(screen.queryByRole('button', { name: 'Nuevo servicio' })).toBeNull()
  expect(within(nav).queryByText('Más')).toBeNull()
})

test('without a church there is no sidebar and the screen keeps its own explanation', async () => {
  stubApi({ church: 404 })
  app('/')
  expect(await screen.findByText('Pantalla de inicio')).toBeTruthy()
  expect(screen.queryByRole('navigation', { name: 'Secciones' })).toBeNull()
})
