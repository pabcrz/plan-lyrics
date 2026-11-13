import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ServiceFormPage } from './ServiceFormPage'
import { church, mount, service, stubApi } from './test-utils'

vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken: async () => 'token-ficticio' }), UserButton: () => <button>Cuenta</button> }))

// Jueves 12 de noviembre de 2026: las próximas fechas son vie 13, dom 15, vie 20 y dom 22.
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-12T18:00:00Z') }) })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

const form = () => mount(
  <Routes><Route path="/servicios/nuevo" element={<ServiceFormPage />} /><Route path="/" element={<p>Calendario</p>} /></Routes>,
  '/servicios/nuevo',
)
// Las fechas se habilitan cuando llegan los servicios del mes (para marcar las ocupadas).
const date = async (name: RegExp) => {
  const button = await screen.findByRole('button', { name })
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))
  return button
}
const posted = (calls: ReturnType<typeof stubApi>) => calls.filter((call) => call.init?.method === 'POST')

test('offers the habitual dates with their hour and preloads title and hour for the chosen one', async () => {
  stubApi({})
  form()
  expect(await date(/vie 13 nov\s*7:30 p\.m\./)).toBeTruthy()
  expect(screen.getByRole('button', { name: /dom 15 nov\s*10:00 a\.m\./ })).toBeTruthy()
  fireEvent.click(await date(/vie 13 nov/))
  expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('Servicio de viernes')
  expect(screen.getByRole('button', { name: 'Hora de inicio: 7:30 p.m.' })).toBeTruthy()
})

test('a full date is disabled and labelled, and a special date has no preloaded hour', async () => {
  stubApi({ services: [service({ date: '2026-11-13' })] })
  form()
  const busy = await screen.findByRole('button', { name: /vie 13 nov\s*Completo/ })
  expect((busy as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: /Otra fecha/ }))
  fireEvent.change(screen.getByLabelText('Día del servicio'), { target: { value: '2026-11-17' } })
  expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('')
  expect(screen.getByRole('button', { name: 'Hora de inicio: Sin hora fija' })).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Día del servicio'), { target: { value: '2026-11-13' } })
  expect(await screen.findByText('Fecha completa')).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Crear servicio' }) as HTMLButtonElement).disabled).toBe(true)
})

test('does not create without a director and shows the error beside the field', async () => {
  const calls = stubApi({})
  form()
  fireEvent.click(await date(/vie 13 nov/))
  fireEvent.click(screen.getByRole('button', { name: 'Crear servicio' }))
  expect(await screen.findByText('Elige quién dirige el servicio.')).toBeTruthy()
  expect(posted(calls)).toHaveLength(0)
})

test('creates the service for the active church with the chosen director and returns to the calendar', async () => {
  const calls = stubApi({})
  form()
  fireEvent.click(await date(/vie 13 nov/))
  const director = screen.getByRole('combobox', { name: /Dirección/ })
  fireEvent.focus(director)
  fireEvent.change(director, { target: { value: 'luis' } })
  fireEvent.click(await screen.findByRole('option', { name: /Luis Herrera/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Publicado' }))
  fireEvent.click(screen.getByRole('button', { name: 'Crear servicio' }))
  expect(await screen.findByText('Calendario')).toBeTruthy()
  const [call] = posted(calls)
  expect(JSON.parse(call.init!.body as string)).toEqual({ title: 'Servicio de viernes', date: '2026-11-13', status: 'PUBLISHED', directorId: 'p2', time: '19:30' })
})

test('a double Sunday asks for the slot, disables the taken one and bounds the hour to it', async () => {
  const calls = stubApi({ church: { ...church, sundayDouble: true, days: [
    { weekday: 0, slot: 'MORNING', time: '09:00', title: 'Culto de la mañana' },
    { weekday: 0, slot: 'AFTERNOON', time: '17:00', title: 'Culto de la tarde' },
  ] }, services: [service({ id: 'm', date: '2026-11-15', slot: 'MORNING', time: '09:00' })] })
  form()
  fireEvent.click(await date(/dom 15 nov/))
  const group = screen.getByRole('group', { name: 'Franja del domingo' })
  expect((within(group).getByRole('button', { name: /Mañana/ }) as HTMLButtonElement).disabled).toBe(true)
  expect(within(group).getByRole('button', { name: /Tarde/ }).getAttribute('aria-pressed')).toBe('true')
  expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('Culto de la tarde')
  fireEvent.click(screen.getByRole('button', { name: 'Hora de inicio: 5:00 p.m.' }))
  const wheel = await screen.findByRole('group', { name: 'Hora' })
  expect(within(wheel).queryByRole('option', { name: 'a.m.' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Listo' }))
  const director = screen.getByRole('combobox', { name: /Dirección/ })
  fireEvent.focus(director)
  fireEvent.change(director, { target: { value: 'ana' } })
  fireEvent.click(await screen.findByRole('option', { name: /Ana Ramírez/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Crear servicio' }))
  await waitFor(() => expect(posted(calls)).toHaveLength(1))
  expect(JSON.parse(posted(calls)[0].init!.body as string)).toMatchObject({ date: '2026-11-15', slot: 'AFTERNOON', time: '17:00' })
})

test('shows the server rejection when the date filled up meanwhile', async () => {
  stubApi({ post: () => ({ status: 409, body: { error: 'Date full' } }) })
  form()
  fireEvent.click(await date(/vie 13 nov/))
  const director = screen.getByRole('combobox', { name: /Dirección/ })
  fireEvent.focus(director)
  fireEvent.change(director, { target: { value: 'ana' } })
  fireEvent.click(await screen.findByRole('option', { name: /Ana/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Crear servicio' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Esa fecha ya está completa')
})

test('members who can only read see a notice instead of the form', async () => {
  stubApi({ church: { ...church, canEdit: false } })
  form()
  expect(await screen.findByText('Solo lectura')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Crear servicio' })).toBeNull()
})

test('a past date is refused in «Otra fecha» and cannot be submitted; today is allowed', async () => {
  const calls = stubApi({})
  form()
  fireEvent.click(await date(/Otra fecha/))
  const day = screen.getByLabelText('Día del servicio') as HTMLInputElement
  expect(day.min).toBe('2026-11-12')
  fireEvent.change(day, { target: { value: '2026-11-11' } })
  expect(await screen.findByText('No se pueden crear servicios en fechas pasadas.')).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Crear servicio' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.change(day, { target: { value: '2026-11-12' } })
  expect(screen.queryByText('No se pueden crear servicios en fechas pasadas.')).toBeNull()
  expect((screen.getByRole('button', { name: 'Crear servicio' }) as HTMLButtonElement).disabled).toBe(false)
  expect(calls.filter((call) => call.init?.method === 'POST')).toHaveLength(0)
})
