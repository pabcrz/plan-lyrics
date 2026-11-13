import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { SettingsPage } from './SettingsPage'
import { church, mount, stubApi } from './test-utils'

vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken: async () => 'token-ficticio' }), UserButton: () => <button>Cuenta</button> }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const page = () => mount(<Routes><Route path="/ajustes" element={<SettingsPage />} /><Route path="/" element={<p>Calendario</p>} /></Routes>, '/ajustes')
const puts = (calls: ReturnType<typeof stubApi>) => calls.filter((call) => call.init?.method === 'PUT')
const sent = (calls: ReturnType<typeof stubApi>) => JSON.parse(String(puts(calls)[0]?.init?.body))
const save = () => screen.getByRole('button', { name: 'Guardar cambios' }) as HTMLButtonElement
const day = (name: string) => screen.getByRole('button', { name })

test('shows the saved settings and keeps save disabled until something changes', async () => {
  stubApi({})
  page()
  expect(((await screen.findByLabelText('Nombre de la iglesia')) as HTMLInputElement).value).toBe('Betel')
  expect(day('viernes').getAttribute('aria-pressed')).toBe('true')
  expect(day('lunes').getAttribute('aria-pressed')).toBe('false')
  expect((screen.getByLabelText('Título · viernes') as HTMLInputElement).value).toBe('Servicio de viernes')
  expect(screen.getByRole('button', { name: 'Hora viernes: 7:30 p.m.' })).toBeTruthy()
  expect(screen.getByRole('switch', { name: 'Usa predicación' }).getAttribute('aria-checked')).toBe('false')
  expect(save().disabled).toBe(true)
})

test('saves a name, a new day and the preaching switch, then confirms and discards nothing', async () => {
  const calls = stubApi({})
  page()
  fireEvent.change(await screen.findByLabelText('Nombre de la iglesia'), { target: { value: '  Nueva Betel ' } })
  fireEvent.click(day('martes'))
  fireEvent.click(screen.getByRole('switch', { name: 'Usa predicación' }))
  expect(save().disabled).toBe(false)
  fireEvent.click(save())
  expect(await screen.findByText('Cambios guardados')).toBeTruthy()
  expect(sent(calls)).toEqual({
    name: 'Nueva Betel', sundayDouble: false, usesPreaching: true,
    days: [
      { weekday: 0, slot: 'SINGLE', time: '10:00', title: 'Servicio dominical' },
      { weekday: 2, slot: 'SINGLE', time: '19:00', title: 'Servicio de martes' },
      { weekday: 5, slot: 'SINGLE', time: '19:30', title: 'Servicio de viernes' },
    ],
  })
  expect(JSON.stringify(sent(calls))).not.toContain('church')
  await waitFor(() => expect(save().disabled).toBe(true))
})

test('discarding returns to the saved values', async () => {
  stubApi({})
  page()
  const name = (await screen.findByLabelText('Nombre de la iglesia')) as HTMLInputElement
  fireEvent.change(name, { target: { value: 'Otra' } })
  fireEvent.click(day('viernes'))
  fireEvent.click(screen.getByRole('button', { name: 'Descartar cambios' }))
  expect(name.value).toBe('Betel')
  expect(day('viernes').getAttribute('aria-pressed')).toBe('true')
  expect(save().disabled).toBe(true)
})

test('shows errors next to the field and sends nothing when invalid', async () => {
  const calls = stubApi({})
  page()
  fireEvent.change(await screen.findByLabelText('Nombre de la iglesia'), { target: { value: ' ' } })
  fireEvent.change(screen.getByLabelText('Título · viernes'), { target: { value: '' } })
  fireEvent.click(save())
  expect(await screen.findByText('Escribe el nombre de la iglesia.')).toBeTruthy()
  expect(screen.getByText('Escribe un título.')).toBeTruthy()
  expect(screen.getByLabelText('Nombre de la iglesia').getAttribute('aria-invalid')).toBe('true')
  fireEvent.click(day('viernes'))
  fireEvent.click(day('domingo'))
  fireEvent.click(save())
  expect((await screen.findByRole('alert')).textContent).toBe('Elige al menos un día de servicio.')
  expect(puts(calls)).toHaveLength(0)
})

test('the double Sunday shows a morning and an afternoon card and saves both slots', async () => {
  const calls = stubApi({})
  page()
  fireEvent.click(await screen.findByRole('switch', { name: 'Dos servicios los domingos' }))
  expect(screen.getByLabelText('Título · domingo por la mañana')).toBeTruthy()
  expect(screen.getByLabelText('Título · domingo por la tarde')).toBeTruthy()
  expect(screen.queryByLabelText('Título · domingo')).toBeNull()
  fireEvent.click(save())
  await screen.findByText('Cambios guardados')
  expect(sent(calls)).toMatchObject({
    sundayDouble: true,
    days: [
      { weekday: 0, slot: 'MORNING', time: '10:00', title: 'Servicio dominical (mañana)' },
      { weekday: 0, slot: 'AFTERNOON', time: '17:00', title: 'Servicio dominical (tarde)' },
      { weekday: 5, slot: 'SINGLE' },
    ],
  })
})

test('only Sunday offers two services', async () => {
  stubApi({})
  page()
  await screen.findByLabelText('Nombre de la iglesia')
  expect(screen.getAllByRole('switch', { name: 'Dos servicios los domingos' })).toHaveLength(1)
})

test('the hour opens the wheel and the chosen time is saved', async () => {
  const calls = stubApi({})
  page()
  fireEvent.click(await screen.findByRole('button', { name: 'Hora viernes: 7:30 p.m.' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Listo' }))
  expect(save().disabled).toBe(true) // sin cambiar la rueda, la hora no cambia
  expect(puts(calls)).toHaveLength(0)
})

test('server field errors appear next to the field', async () => {
  stubApi({ save: () => ({ status: 400, body: { error: 'Invalid request', issues: ['days.5.SINGLE.title'] } }) })
  page()
  fireEvent.change(await screen.findByLabelText('Título · viernes'), { target: { value: 'Otro' } })
  fireEvent.click(save())
  expect(await screen.findByText('Escribe un título.')).toBeTruthy()
  expect(screen.getByText(/No se pudieron guardar/)).toBeTruthy()
})

test('a non-administrator only sees a read-only notice', async () => {
  stubApi({ church: { ...church, canConfigure: false } })
  page()
  expect(await screen.findByText('Solo lectura')).toBeTruthy()
  expect(screen.queryByLabelText('Nombre de la iglesia')).toBeNull()
})
