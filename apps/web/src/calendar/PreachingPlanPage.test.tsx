import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { HomePage } from './HomePage'
import { ProductRoutes } from './ProductRoutes'
import type { Who } from './participations-api'
import type { Preaching } from './preaching-api'
import { PreachingPlanPage } from './PreachingPlanPage'
import { church, detail, mount, service, stubApi } from './test-utils'

vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken: async () => 'token-ficticio' }), UserButton: () => <button>Cuenta</button> }))

// Viernes 13 de noviembre de 2026.
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-13T18:00:00Z') }) })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

const luis: Who = { id: 'p2', name: 'Luis Herrera' }
const withPreaching = { ...church, usesPreaching: true }
const section = (over: Partial<Preaching> = {}): Preaching => ({ serviceId: 's1', preacher: luis, topic: 'La gracia', passages: [], canSeeNotes: true, notes: '', ...over })
const services = [service({ id: 's1', date: '2026-11-13' }), service({ id: 's2', date: '2026-11-20', title: 'Otro viernes', director: null })]
const page = () => mount(
  <Routes><Route path="/predicaciones" element={<PreachingPlanPage />} /><Route path="/servicios/nuevo" element={<p>Formulario</p>} /></Routes>,
  '/predicaciones',
)

test('lists the month with who preaches and the topic, and says what is still missing', async () => {
  const calls = stubApi({ church: withPreaching, services, preaching: { s1: section() }, directory: [detail(luis)] })
  page()
  expect(await screen.findByText('Luis Herrera')).toBeTruthy()
  expect(screen.getByText('La gracia')).toBeTruthy()
  expect(screen.getByText('Sin predicador')).toBeTruthy()
  expect(screen.getByText('Sin tema')).toBeTruthy()
  expect(calls.some((call) => call.url === '/api/preaching?month=2026-11')).toBe(true)
})

test('a row opens its preaching section for editing, and «Nueva predicación» goes to the service form', async () => {
  stubApi({ church: withPreaching, services, preaching: { s1: section() }, directory: [detail(luis)] })
  page()
  fireEvent.click(await screen.findByRole('button', { name: /Luis Herrera/ }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Servicio de viernes' }))
  expect(await dialog.findByRole('heading', { name: 'Predicación' })).toBeTruthy()
  expect(await dialog.findByRole('button', { name: /Editar/ })).toBeTruthy()
  fireEvent.keyDown(document, { key: 'Escape' })
  fireEvent.click(screen.getByRole('button', { name: 'Nueva predicación' }))
  expect(await screen.findByText('Formulario')).toBeTruthy()
})

test('members read the plan but cannot create; a church without preaching explains how to turn it on', async () => {
  stubApi({ church: { ...withPreaching, canEdit: false }, services })
  page()
  expect((await screen.findAllByText('Sin predicador')).length).toBe(2)
  expect(screen.queryByRole('button', { name: 'Nueva predicación' })).toBeNull()
  cleanup(); vi.unstubAllGlobals()
  const calls = stubApi({ church, services })
  page()
  expect(await screen.findByText('Tu iglesia no usa predicación')).toBeTruthy()
  expect(calls.some((call) => call.url.startsWith('/api/preaching?month='))).toBe(false)
})

test('the «Predicaciones» tab exists only when the church uses preaching', async () => {
  stubApi({ church: withPreaching, services })
  mount(<HomePage />)
  expect((await screen.findAllByRole('button', { name: 'Predicaciones' })).length).toBeGreaterThan(0)
  cleanup(); vi.unstubAllGlobals()
  stubApi({ church, services })
  mount(<HomePage />)
  await screen.findAllByRole('button', { name: 'Personas' })
  expect(screen.queryByRole('button', { name: 'Predicaciones' })).toBeNull()
})

test('a month without services invites to create the first one', async () => {
  stubApi({ church: withPreaching, services: [] })
  page()
  await waitFor(() => expect(screen.getByText(/No hay servicios en/)).toBeTruthy())
})

test.each(['Servicio individual', 'Lote mensual'])('elegir «%s» en «Nuevo» cierra la hoja', async (option) => {
  stubApi({ services })
  mount(<ProductRoutes />)
  fireEvent.click((await screen.findAllByRole('button', { name: 'Nuevo' }))[0]!)
  fireEvent.click(within(await screen.findByRole('dialog', { name: 'Nuevo' })).getByRole('button', { name: new RegExp(option) }))
  await screen.findByRole('heading', { name: option === 'Lote mensual' ? /lote/i : 'Nuevo servicio' })
  expect(screen.queryByRole('dialog', { name: 'Nuevo' })).toBeNull()
})
