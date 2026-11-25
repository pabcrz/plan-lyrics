import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
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
  // El nombre de cada servicio se genera solo: ya no hay título que llenar.
  expect(screen.queryByLabelText('Título · viernes')).toBeNull()
  expect(screen.getByRole('button', { name: 'Hora viernes: 7:30 p.m.' })).toBeTruthy()
  expect(screen.getByRole('switch', { name: 'Usa predicación' }).getAttribute('aria-checked')).toBe('false')
  expect(save().disabled).toBe(true)
})

test('the preaching switch says what it does now: it hides or shows the section and the API refuses changes', async () => {
  stubApi({})
  page()
  const off = await screen.findByText(/Sin predicación: la sección se oculta en el servicio y en el lote/)
  expect(off.textContent).toContain('la API no acepta cambios')
  expect(screen.queryByText(/llegará más adelante|Solo se guarda/)).toBeNull()
  fireEvent.click(screen.getByRole('switch', { name: 'Usa predicación' }))
  expect(screen.getByText('El servicio y el lote mensual muestran la predicación: predicador, tema, citas y notas.')).toBeTruthy()
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
    name: 'Nueva Betel', sundayDouble: false, usesPreaching: true, usesRotation: true, songRepeat: null,
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
  fireEvent.click(save())
  expect(await screen.findByText('Escribe el nombre de la iglesia.')).toBeTruthy()
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
  expect(screen.getByLabelText('Hora · domingo por la mañana')).toBeTruthy()
  expect(screen.getByLabelText('Hora · domingo por la tarde')).toBeTruthy()
  expect(screen.queryByLabelText('Hora · domingo')).toBeNull()
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
  stubApi({ save: () => ({ status: 400, body: { error: 'Invalid request', issues: ['days.5.SINGLE.time'] } }) })
  page()
  fireEvent.change(await screen.findByLabelText('Nombre de la iglesia'), { target: { value: 'Otra Betel' } })
  fireEvent.click(save())
  expect(await screen.findByText('La hora no es válida para esta franja.')).toBeTruthy()
  expect(screen.getByText(/No se pudieron guardar/)).toBeTruthy()
})

test('a non-administrator only sees a read-only notice', async () => {
  stubApi({ church: { ...church, canConfigure: false } })
  page()
  expect(await screen.findByText('Solo lectura')).toBeTruthy()
  expect(screen.queryByLabelText('Nombre de la iglesia')).toBeNull()
})

test('the rotation switch is saved with the settings and explains itself with an example', async () => {
  const calls = stubApi({ church: { ...church, usesRotation: false } })
  mount(<SettingsPage />)
  const toggle = await screen.findByRole('switch', { name: 'Usa rotación de turnos' })
  expect(toggle.getAttribute('aria-checked')).toBe('false')
  expect(within(screen.getByRole('list', { name: 'Ejemplo de rotación' })).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Servicio 1 · Luis', 'Servicio 2 · Mariana', 'Servicio 3 · Juan', 'Servicio 4 · Luis, otra vez'])
  fireEvent.click(toggle)
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  await waitFor(() => expect(calls.some((call) => call.init?.method === 'PUT' && JSON.parse(String(call.init.body)).usesRotation === true)).toBe(true))
})

test('the repetition rule is turned on by weeks or by services and saved with the settings', async () => {
  const calls = stubApi({})
  page()
  fireEvent.click(await screen.findByRole('switch', { name: 'Evitar repetir canciones' }))
  const rule = within(screen.getByRole('region', { name: 'Repetición de canciones' }))
  // Por semanas, con 2: la semana en que se canta y 1 bloqueada, y a la tercera ya se puede.
  const weeks = within(rule.getByLabelText('Ejemplo de la regla'))
  expect(weeks.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Semana 1la cantas', 'Semana 2no', 'Semana 3ya puedes'])
  expect(weeks.getByText(/hasta la semana 2 no se ofrece; desde la semana 3 ya sí/)).toBeTruthy()
  fireEvent.click(rule.getByRole('button', { name: 'Más' }))
  fireEvent.click(rule.getByRole('button', { name: 'Cultos' }))
  // Por cultos, con 3 y cultos de viernes y domingo: viernes la cantas, domingo, viernes y domingo no, y el viernes siguiente ya.
  const services = within(rule.getByLabelText('Ejemplo de la regla'))
  expect(services.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Domla cantas', 'Vieno', 'Domno', 'Vieno', 'Domya puedes'])
  expect(services.getByText(/Si la cantas el domingo, los 3 cultos siguientes no la ofrecen; desde el domingo ya sí/)).toBeTruthy()
  fireEvent.click(save())
  expect(await screen.findByText('Cambios guardados')).toBeTruthy()
  expect(sent(calls)).toMatchObject({ songRepeat: { unit: 'SERVICES', amount: 3 } })
  fireEvent.click(screen.getByRole('switch', { name: 'Evitar repetir canciones' }))
  fireEvent.click(save())
  const puts = () => calls.filter((call) => call.init?.method === 'PUT')
  await waitFor(() => expect(puts()).toHaveLength(2))
  expect(JSON.parse(String(puts()[1]!.init?.body))).toMatchObject({ songRepeat: null })
})

test('the example uses the services the church has configured above, and follows them when they change', async () => {
  stubApi({})
  page()
  fireEvent.click(await screen.findByRole('switch', { name: 'Evitar repetir canciones' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cultos' }))
  const names = () => within(screen.getByLabelText('Ejemplo de la regla')).getAllByRole('listitem').map((item) => item.querySelector('b')?.textContent)
  // Domingo y viernes configurados, con 2: la que cantas, 2 bloqueados y el siguiente libre.
  expect(names()).toEqual(['Dom', 'Vie', 'Dom', 'Vie'])
  fireEvent.click(day('martes'))
  expect(names()).toEqual(['Dom', 'Mar', 'Vie', 'Dom'])
  fireEvent.click(day('domingo'))
  expect(names()).toEqual(['Mar', 'Vie', 'Mar', 'Vie'])
})

test('with two Sunday services the example counts the morning and the afternoon one', async () => {
  stubApi({ church: { ...church, sundayDouble: true, days: [{ weekday: 0, slot: 'MORNING', time: '09:00', title: 'Mañana' }, { weekday: 0, slot: 'AFTERNOON', time: '17:00', title: 'Tarde' }] } })
  page()
  fireEvent.click(await screen.findByRole('switch', { name: 'Evitar repetir canciones' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cultos' }))
  const names = within(screen.getByLabelText('Ejemplo de la regla')).getAllByRole('listitem').map((item) => item.querySelector('b')?.textContent)
  expect(names).toEqual(['Dom mañana', 'Dom tarde', 'Dom mañana', 'Dom tarde'])
  expect(screen.getByText(/Si la cantas el domingo por la mañana/)).toBeTruthy()
})
