import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { BatchPage } from './BatchPage'
import { CalendarPage } from './CalendarPage'
import type { PeriodEntry, Previous } from './batch'
import { church, detail, mount, stubApi } from './test-utils'

vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken: async () => 'token-ficticio' }), UserButton: () => <button>Cuenta</button> }))

// Jueves 12 de noviembre de 2026; la iglesia de prueba tiene viernes (19:30) y domingo (10:00) habituales.
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-12T18:00:00Z') }) })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

const page = () => mount(
  <Routes><Route path="/servicios/lote" element={<BatchPage />} /><Route path="/" element={<p>Calendario</p>} /></Routes>,
  '/servicios/lote',
)
const fridays = (...days: string[]): PeriodEntry[] => days.map((day) => ({ date: `2026-11-${day}`, slot: 'SINGLE', lock: null }))
const period = (entries: PeriodEntry[], previous: Previous | null = null) => () => ({ body: { month: '2026-11', entries, previous } })
const people = [detail({ id: 'p1', name: 'Ana Ramírez' }), detail({ id: 'p2', name: 'Luis Herrera' }), detail({ id: 'p3', name: 'Juan Pérez' })]
// Responde a la creación como el servidor: borradores con el director elegido.
const echo = (_url: string, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body)) as { entries: Array<{ date: string; title: string; time: string; directorId: string; slot?: string }> }
  return { body: { services: body.entries.map((entry) => ({ id: entry.date, title: entry.title, date: entry.date, slot: entry.slot ?? 'SINGLE', time: entry.time, status: 'DRAFT', director: { id: entry.directorId, name: people.find((p) => p.id === entry.directorId)!.name } })) } }
}
const posted = (calls: ReturnType<typeof stubApi>) => calls.filter((call) => call.url === '/api/service-batches' && call.init?.method === 'POST')
const sent = (calls: ReturnType<typeof stubApi>) => JSON.parse(String(posted(calls)[0]!.init!.body)) as { month: string; directorIds: string[]; entries: Array<Record<string, string>> }

async function addDirector(name: string) {
  fireEvent.click(await screen.findByRole('button', { name: 'Agregar director' }))
  const dialog = await screen.findByRole('dialog', { name: 'Agregar director' })
  const search = within(dialog).getByRole('combobox', { name: /Buscar persona/ })
  fireEvent.focus(search)
  fireEvent.change(search, { target: { value: name } })
  fireEvent.click(await within(dialog).findByRole("option", { name: new RegExp(`^${name}`) }))
}
const toDirectors = async () => {
  await screen.findByText(/fechas? disponibles?/)
  fireEvent.click(screen.getByRole('button', { name: 'Continuar con directores' }))
}
const toReview = async (...names: string[]) => {
  await toDirectors()
  for (const name of names) await addDirector(name)
  fireEvent.click(screen.getByRole('button', { name: 'Revisar' }))
}

test('the creation selector offers an individual service or a monthly batch', async () => {
  stubApi({})
  mount(<Routes><Route path="/servicios/lote" element={<p>Pantalla del lote</p>} /><Route path="*" element={<CalendarPage />} /></Routes>, '/')
  fireEvent.click(await screen.findByRole('button', { name: 'Nuevo' }))
  const dialog = screen.getByRole('dialog', { name: 'Nuevo' })
  expect(within(dialog).getByRole('button', { name: /Servicio individual/ })).toBeTruthy()
  fireEvent.click(within(dialog).getByRole('button', { name: /Lote mensual/ }))
  expect(await screen.findByText('Pantalla del lote')).toBeTruthy()
})

test('members who can only read see a notice instead of the batch', async () => {
  stubApi({ church: { ...church, canEdit: false } })
  page()
  expect(await screen.findByText('Solo lectura')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Continuar con directores' })).toBeNull()
})

test('the period offers the current and next months, up to three weekdays, and preloads the habitual name and hour', async () => {
  const calls = stubApi({ period: period(fridays('13', '20')) })
  page()
  expect(await screen.findByRole('radio', { name: /Noviembre 2026\s*Desde hoy, inclusive/ })).toBeTruthy()
  expect(screen.getByRole('radio', { name: /Diciembre 2026/ })).toBeTruthy()
  expect(screen.getByRole('radio', { name: /Enero 2027/ })).toBeTruthy()
  expect((screen.getByLabelText('Nombre del servicio (viernes)') as HTMLInputElement).value).toBe('Servicio de viernes')
  expect((screen.getByLabelText('Hora (viernes)') as HTMLInputElement).value).toBe('19:30')
  await screen.findByText('2 fechas disponibles · viernes')
  expect(calls.some((call) => call.url === '/api/service-batches/period?month=2026-11&weekdays=5')).toBe(true)
  for (const day of ['lunes', 'martes']) fireEvent.click(screen.getByRole('button', { name: day }))
  expect((screen.getByRole('button', { name: 'sábado' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getByText('Máximo 3 días. Quita uno para elegir otro.')).toBeTruthy()
  await waitFor(() => expect(calls.some((call) => call.url === '/api/service-batches/period?month=2026-11&weekdays=1,2,5')).toBe(true))
  fireEvent.click(screen.getByRole('radio', { name: /Diciembre 2026/ }))
  await waitFor(() => expect(calls.some((call) => call.url.startsWith('/api/service-batches/period?month=2026-12'))).toBe(true))
})

test('full and closed dates are shown locked with the existing service or the reason, and are not counted as available', async () => {
  stubApi({
    period: period([
      { date: '2026-11-13', slot: 'SINGLE', lock: { kind: 'service', title: 'Servicio de oración', director: 'Juan Pérez' } },
      { date: '2026-11-20', slot: 'SINGLE', lock: null },
      { date: '2026-11-27', slot: 'SINGLE', lock: { kind: 'closed', reason: 'Feriado' } },
    ]),
  })
  page()
  expect(await screen.findByText('1 fecha disponible · viernes')).toBeTruthy()
  expect(screen.getByText(/Ya tiene servicio · Servicio de oración · Juan Pérez/)).toBeTruthy()
  expect(screen.getByText('Sin culto · Feriado')).toBeTruthy()
})

test('a period without free dates cannot continue', async () => {
  stubApi({ period: period([{ date: '2026-11-13', slot: 'SINGLE', lock: { kind: 'closed', reason: null } }]) })
  page()
  expect(await screen.findByText('Sin fechas disponibles')).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Continuar con directores' }) as HTMLButtonElement).disabled).toBe(true)
})

test('asks for the service name before continuing', async () => {
  stubApi({ period: period(fridays('13')) })
  page()
  await screen.findByText('1 fecha disponible · viernes')
  fireEvent.change(screen.getByLabelText('Nombre del servicio (viernes)'), { target: { value: '  ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar con directores' }))
  expect(await screen.findByText('Escribe el nombre del servicio.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Revisar' })).toBeNull()
})

test('does not pass to the review without at least one director', async () => {
  stubApi({ period: period(fridays('13', '20')), directory: people })
  page()
  await toDirectors()
  expect(await screen.findByText('Agrega al menos un director para continuar.')).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Revisar' }) as HTMLButtonElement).disabled).toBe(true)
  await addDirector('Ana')
  expect((screen.getByRole('button', { name: 'Revisar' }) as HTMLButtonElement).disabled).toBe(false)
})

test('repeats the list until every free date has a director, and creates the reviewed batch as one request', async () => {
  const calls = stubApi({ period: period(fridays('13', '20', '27')), directory: people, batch: echo })
  page()
  await toReview('Ana', 'Luis')
  expect(await screen.findByText('Se crearán 3 de 3 servicios')).toBeTruthy()
  expect(screen.getByRole('button', { name: /viernes,? 13 de noviembre, Ana Ramírez/ })).toBeTruthy()
  expect(screen.getByRole('button', { name: /viernes,? 20 de noviembre, Luis Herrera/ })).toBeTruthy()
  expect(screen.getByRole('button', { name: /viernes,? 27 de noviembre, Ana Ramírez/ })).toBeTruthy()
  expect(screen.getByText(/participaciones habituales, la rotación y el setlist llegan después/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Crear 3 servicios' }))
  expect(await screen.findByText('3 servicios creados')).toBeTruthy()
  expect(posted(calls)).toHaveLength(1)
  expect(sent(calls)).toEqual({
    month: '2026-11', directorIds: ['p1', 'p2'],
    entries: [
      { date: '2026-11-13', title: 'Servicio de viernes', time: '19:30', directorId: 'p1' },
      { date: '2026-11-20', title: 'Servicio de viernes', time: '19:30', directorId: 'p2' },
      { date: '2026-11-27', title: 'Servicio de viernes', time: '19:30', directorId: 'p1' },
    ],
  })
  expect(screen.getByText(/Quedaron como borrador/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Ver en el calendario' }))
  expect(await screen.findByText('Calendario')).toBeTruthy()
})

test('without repetition a partial batch asks for confirmation and creates only the first dates with a director', async () => {
  const calls = stubApi({ period: period(fridays('13', '20', '27')), directory: people, batch: echo })
  page()
  await toDirectors()
  await addDirector('Ana')
  await addDirector('Luis')
  fireEvent.click(screen.getByRole('switch', { name: /Repetir la lista/ }))
  expect(screen.getByText('Solo se programan las primeras 2 fechas; el resto queda sin programar.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Revisar' }))
  expect(await screen.findByText('Se crearán 2 de 3 servicios')).toBeTruthy()
  expect(screen.getByText(/No se crea servicio ni participaciones para esta fecha/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Crear 2 servicios' }))
  const confirm = await screen.findByRole('dialog', { name: 'Se crearán 2 de 3 servicios' })
  expect(posted(calls)).toHaveLength(0)
  fireEvent.click(within(confirm).getByRole('button', { name: 'Volver a la revisión' }))
  expect(posted(calls)).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: 'Crear 2 servicios' }))
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar y crear' }))
  expect(await screen.findByText('2 servicios creados')).toBeTruthy()
  expect(sent(calls).entries.map((entry) => entry.date)).toEqual(['2026-11-13', '2026-11-20'])
  expect(screen.getByText(/vie 27 nov/)).toBeTruthy()
})

test('changes the director of one date without touching the others', async () => {
  const calls = stubApi({ period: period(fridays('13', '20', '27')), directory: people, batch: echo })
  page()
  await toReview('Ana', 'Luis')
  fireEvent.click(await screen.findByRole('button', { name: /viernes,? 20 de noviembre, Luis Herrera/ }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Cambiar director/ }))
  const picker = await screen.findByRole('dialog', { name: 'Cambiar director' })
  fireEvent.focus(within(picker).getByRole('combobox'))
  fireEvent.click(await within(picker).findByRole('option', { name: /Juan Pérez/ }))
  expect(await screen.findByRole('button', { name: /viernes,? 20 de noviembre, Juan Pérez/ })).toBeTruthy()
  expect(screen.getByRole('button', { name: /viernes,? 13 de noviembre, Ana Ramírez/ })).toBeTruthy()
  expect(screen.getByRole('button', { name: /viernes,? 27 de noviembre, Ana Ramírez/ })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Crear 3 servicios' }))
  await screen.findByText('3 servicios creados')
  expect(sent(calls).entries.map((entry) => entry.directorId)).toEqual(['p1', 'p3', 'p1'])
})

test('swaps two dates showing both before confirming, leaving the one in between untouched', async () => {
  const calls = stubApi({ period: period(fridays('13', '20', '27')), directory: people, batch: echo })
  page()
  await toReview('Ana', 'Luis', 'Juan')
  fireEvent.click(await screen.findByRole('button', { name: /viernes,? 13 de noviembre, Ana Ramírez/ }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Intercambiar con otra fecha/ }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /vie 20 nov.*Luis Herrera/ }))
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByText('Ana Ramírez → Luis Herrera')).toBeTruthy()
  expect(within(dialog).getByText('Luis Herrera → Ana Ramírez')).toBeTruthy()
  expect(screen.getByRole('button', { name: /viernes,? 13 de noviembre, Ana Ramírez/ })).toBeTruthy() // todavía sin confirmar
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar intercambio' }))
  expect(await screen.findByRole('button', { name: /viernes,? 13 de noviembre, Luis Herrera/ })).toBeTruthy()
  expect(screen.getByRole('button', { name: /viernes,? 20 de noviembre, Ana Ramírez/ })).toBeTruthy()
  expect(screen.getByRole('button', { name: /viernes,? 27 de noviembre, Juan Pérez/ })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Crear 3 servicios' }))
  await screen.findByText('3 servicios creados')
  expect(sent(calls).entries.map((entry) => entry.directorId)).toEqual(['p2', 'p1', 'p3'])
})

test('removes a date from the batch, which becomes a partial one, and can include it again', async () => {
  const calls = stubApi({ period: period(fridays('13', '20', '27')), directory: people, batch: echo })
  page()
  await toReview('Ana', 'Luis')
  fireEvent.click(await screen.findByRole('button', { name: /viernes,? 20 de noviembre, Luis Herrera/ }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Quitar de este lote/ }))
  expect(await screen.findByText('Se crearán 2 de 3 servicios')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /viernes,? 20 de noviembre, quitada del lote/ }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Volver a incluir en el lote/ }))
  expect(await screen.findByText('Se crearán 3 de 3 servicios')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /viernes,? 20 de noviembre, Luis Herrera/ }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Quitar de este lote/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Crear 2 servicios' }))
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar y crear' }))
  await screen.findByText('2 servicios creados')
  expect(sent(calls).entries.map((entry) => entry.date)).toEqual(['2026-11-13', '2026-11-27'])
})

test('continues the list of the previous batch after whoever closed it, unless continuity is switched off', async () => {
  stubApi({ period: period(fridays('13', '20', '27'), { directorIds: ['p1', 'p2', 'p3'], lastDirectorId: 'p2' }), directory: people })
  page()
  await toDirectors()
  const preview = screen.getByRole('region', { name: 'Así quedan las fechas' })
  expect(within(preview).getAllByRole('listitem').map((row) => row.textContent)).toEqual([
    expect.stringContaining('Juan Pérez'), expect.stringContaining('Ana Ramírez'), expect.stringContaining('Luis Herrera'),
  ])
  fireEvent.click(screen.getByRole('switch', { name: /Continuar desde el lote anterior/ }))
  expect(within(preview).getAllByRole('listitem')[0]!.textContent).toContain('Ana Ramírez')
})

test('a previous director who left the directory is dropped from the inherited list', async () => {
  stubApi({ period: period(fridays('13', '20'), { directorIds: ['p1', 'gone'], lastDirectorId: 'gone' }), directory: people })
  page()
  await toDirectors()
  const list = await screen.findByRole('region', { name: 'Lista de directores, en orden' })
  expect(within(list).getAllByRole('listitem')).toHaveLength(1)
  expect(screen.getByText('Quien cerró el lote anterior ya no está en la lista; empieza el primero.')).toBeTruthy()
})

test('a double Sunday asks for both hours, shows two entries and sends each slot with its own director', async () => {
  const sunday = (slot: PeriodEntry['slot']): PeriodEntry => ({ date: '2026-11-15', slot, lock: null })
  const calls = stubApi({
    church: { ...church, sundayDouble: true, days: [{ weekday: 0, slot: 'MORNING', time: '09:00', title: 'Culto de la mañana' }, { weekday: 0, slot: 'AFTERNOON', time: '17:00', title: 'Culto de la tarde' }] },
    period: period([sunday('MORNING'), sunday('AFTERNOON')]), directory: people, batch: echo,
  })
  page()
  await screen.findByText('2 fechas disponibles · domingos')
  expect((screen.getByLabelText('Hora de la mañana') as HTMLInputElement).value).toBe('09:00')
  expect((screen.getByLabelText('Hora de la tarde') as HTMLInputElement).value).toBe('17:00')
  fireEvent.change(screen.getByLabelText('Hora de la mañana'), { target: { value: '13:00' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar con directores' }))
  expect(await screen.findByText('Pon la hora de la mañana antes de las 12:00 y la de la tarde desde las 12:00.')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Hora de la mañana'), { target: { value: '09:00' } })
  await toDirectors()
  await addDirector('Ana')
  await addDirector('Luis')
  fireEvent.click(screen.getByRole('button', { name: 'Revisar' }))
  expect(await screen.findByRole('button', { name: /domingo,? 15 de noviembre · Mañana, Ana Ramírez/ })).toBeTruthy()
  expect(screen.getByRole('button', { name: /domingo,? 15 de noviembre · Tarde, Luis Herrera/ })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Crear 2 servicios' }))
  await screen.findByText('2 servicios creados')
  expect(sent(calls).entries).toEqual([
    { date: '2026-11-15', title: 'Culto de la mañana', time: '09:00', directorId: 'p1', slot: 'MORNING' },
    { date: '2026-11-15', title: 'Culto de la mañana', time: '17:00', directorId: 'p2', slot: 'AFTERNOON' },
  ])
})

test('a new person added from the picker is saved in the directory and joins the list', async () => {
  const calls = stubApi({ period: period(fridays('13')), directory: people, createPerson: () => ({ body: detail({ id: 'nueva', name: 'Marta Salas Cruz' }) }) })
  page()
  await toDirectors()
  fireEvent.click(await screen.findByRole('button', { name: 'Agregar director' }))
  const dialog = await screen.findByRole('dialog', { name: 'Agregar director' })
  const search = within(dialog).getByRole('combobox')
  fireEvent.focus(search)
  fireEvent.change(search, { target: { value: 'Marta Salas Cruz' } })
  fireEvent.click(await within(dialog).findByRole('option', { name: /Agregar «Marta Salas Cruz» como persona nueva/ }))
  expect(await within(await screen.findByRole('region', { name: 'Lista de directores, en orden' })).findByText('Marta Salas Cruz')).toBeTruthy()
  expect(calls.filter((call) => call.url === '/api/people' && call.init?.method === 'POST')).toHaveLength(1)
})

test('a person already in the list is not offered again', async () => {
  stubApi({ period: period(fridays('13')), directory: people })
  page()
  await toDirectors()
  await addDirector('Ana')
  fireEvent.click(screen.getByRole('button', { name: 'Agregar director' }))
  const dialog = await screen.findByRole('dialog', { name: 'Agregar director' })
  fireEvent.focus(within(dialog).getByRole('combobox'))
  expect(await within(dialog).findByRole('option', { name: /Luis Herrera/ })).toBeTruthy()
  expect(within(dialog).queryByRole('option', { name: /Ana Ramírez/ })).toBeNull()
})

test('reorders and removes directors from the list', async () => {
  stubApi({ period: period(fridays('13', '20')), directory: people })
  page()
  await toDirectors()
  await addDirector('Ana')
  await addDirector('Luis')
  fireEvent.click(screen.getByRole('button', { name: 'Subir a Luis Herrera' }))
  const list = screen.getByRole('region', { name: 'Lista de directores, en orden' })
  expect(within(list).getAllByRole('listitem').map((row) => row.textContent)).toEqual([expect.stringContaining('Luis Herrera'), expect.stringContaining('Ana Ramírez')])
  fireEvent.click(screen.getByRole('button', { name: 'Quitar a Luis Herrera de la lista' }))
  expect(within(list).getAllByRole('listitem')).toHaveLength(1)
})

test('when the server refuses a date that changed meanwhile, nothing is shown as created and the failure is explained', async () => {
  stubApi({ period: period(fridays('13')), directory: people, batch: () => ({ status: 409, body: { error: 'Date full', date: '2026-11-13' } }) })
  page()
  await toReview('Ana')
  fireEvent.click(await screen.findByRole('button', { name: 'Crear 1 servicio' }))
  expect((await screen.findByRole('alert')).textContent).toContain('No se creó ningún servicio')
  expect(screen.queryByText(/servicios? creados?/)).toBeNull()
})
