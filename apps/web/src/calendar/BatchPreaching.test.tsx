import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { BatchPage } from './BatchPage'
import type { PeriodEntry } from './batch'
import { church, detail, mount, stubApi } from './test-utils'

vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken: async () => 'token-ficticio' }), UserButton: () => <button>Cuenta</button> }))

// Jueves 12 de noviembre de 2026; la iglesia de prueba tiene viernes (19:30) y domingo (10:00) habituales.
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-12T18:00:00Z') }) })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

const page = () => mount(<Routes><Route path="/servicios/lote" element={<BatchPage />} /></Routes>, '/servicios/lote')
const fridays = (...days: string[]): PeriodEntry[] => days.map((day) => ({ date: `2026-11-${day}`, slot: 'SINGLE', lock: null }))
const period = (entries: PeriodEntry[]) => () => ({ body: { month: '2026-11', entries, previous: null } })
const people = [detail({ id: 'p1', name: 'Ana Ramírez' }), detail({ id: 'p2', name: 'Luis Herrera' }), detail({ id: 'p3', name: 'Juan Pérez' })]
const echo = (_url: string, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body)) as { entries: Array<{ date: string; title: string; time: string; directorId: string }> }
  return { body: { services: body.entries.map((entry) => ({ id: entry.date, title: entry.title, date: entry.date, slot: 'SINGLE', time: entry.time, status: 'DRAFT', director: { id: entry.directorId, name: people.find((p) => p.id === entry.directorId)!.name } })) } }
}
const sent = (calls: ReturnType<typeof stubApi>) => JSON.parse(String(calls.find((call) => call.url === '/api/service-batches' && call.init?.method === 'POST')!.init!.body)) as { entries: Array<Record<string, string>> }
const preachingChurch = { ...church, usesPreaching: true }

async function add(kind: 'director' | 'predicador', name: string) {
  fireEvent.click(await screen.findByRole('button', { name: `Agregar ${kind}` }))
  const dialog = await screen.findByRole('dialog', { name: `Agregar ${kind}` })
  const search = within(dialog).getByRole('combobox', { name: /Buscar persona/ })
  fireEvent.focus(search)
  fireEvent.change(search, { target: { value: name } })
  fireEvent.click(await within(dialog).findByRole('option', { name: new RegExp(`^${name}`) }))
}
const toDirectors = async () => {
  await screen.findByText(/fechas? disponibles?/)
  fireEvent.click(screen.getByRole('button', { name: 'Continuar con directores' }))
}
/** Hasta el paso de predicadores con Juan como único director, y los turnos dados. */
const toPreachers = async (...names: string[]) => {
  await toDirectors()
  await add('director', 'Juan')
  fireEvent.click(screen.getByRole('button', { name: 'Continuar con predicadores' }))
  for (const name of names) await add('predicador', name)
}
const rowOf = (day: string) => screen.getByRole('button', { name: new RegExp(`viernes,? ${day} de noviembre`) })
const openPreaching = async (day: string) => {
  fireEvent.click(rowOf(day))
  fireEvent.click(await screen.findByRole('button', { name: /Predicación/ }))
}

test('without preaching the batch keeps its three steps and sends no preacher', async () => {
  const calls = stubApi({ period: period(fridays('13')), directory: people, batch: echo })
  page()
  await toDirectors()
  expect(screen.getByLabelText('Paso 2/3')).toBeTruthy()
  await add('director', 'Ana')
  expect(screen.queryByRole('button', { name: 'Continuar con predicadores' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Revisar' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Crear 1 servicio' }))
  await screen.findByText('1 servicio creado')
  expect(sent(calls).entries[0]).not.toHaveProperty('preacherId')
})

test('with preaching the batch has a fourth, optional step that can be skipped', async () => {
  const calls = stubApi({ church: preachingChurch, period: period(fridays('13', '20')), directory: people, batch: echo })
  page()
  await toPreachers()
  expect(screen.getByLabelText('Paso 3/4')).toBeTruthy()
  expect(screen.getByText(/Opcional\./)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Revisar sin predicadores' }))
  expect(await screen.findByLabelText('Paso 4/4')).toBeTruthy()
  expect(screen.queryByText(/Predica:/)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Crear 2 servicios/ }))
  await screen.findByText('2 servicios creados')
  expect(sent(calls).entries.every((entry) => !('preacherId' in entry))).toBe(true)
})

test('a person can hold several turns, also in a row, and the list repeats up to the last date', async () => {
  stubApi({ church: preachingChurch, period: period(fridays('13', '20', '27', '28')), directory: people })
  page()
  await toPreachers('Ana', 'Ana', 'Luis')
  const list = screen.getByRole('region', { name: 'Lista de predicadores, en orden' })
  expect(within(list).getAllByRole('listitem').map((row) => row.textContent)).toEqual([expect.stringContaining('Ana Ramírez'), expect.stringContaining('Ana Ramírez'), expect.stringContaining('Luis Herrera')])
  // Quien ya está sigue en el selector: cada turno cuenta.
  fireEvent.click(screen.getByRole('button', { name: 'Agregar predicador' }))
  const dialog = await screen.findByRole('dialog', { name: 'Agregar predicador' })
  fireEvent.focus(within(dialog).getByRole('combobox'))
  expect(await within(dialog).findByRole('option', { name: /Ana Ramírez/ })).toBeTruthy()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
  const dates = within(screen.getByRole('region', { name: 'Predicadores por fecha' })).getAllByRole('listitem').map((row) => row.textContent)
  expect(dates).toEqual([expect.stringMatching(/13 nov.*Ana Ramírez/), expect.stringMatching(/20 nov.*Ana Ramírez/), expect.stringMatching(/27 nov.*Luis Herrera/), expect.stringMatching(/28 nov.*Ana Ramírez/)])
  fireEvent.click(screen.getByRole('button', { name: 'Quitar el turno 2 de Ana Ramírez' }))
  expect(within(list).getAllByRole('listitem')).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'Subir el turno 2 de Luis Herrera' }))
  expect(within(list).getAllByRole('listitem')[0]!.textContent).toContain('Luis Herrera')
})

test('without repeating, only the first dates get a preacher', async () => {
  stubApi({ church: preachingChurch, period: period(fridays('13', '20', '27')), directory: people })
  page()
  await toPreachers('Ana')
  fireEvent.click(screen.getByRole('switch', { name: 'Repetir la lista de predicadores hasta cubrir todas las fechas' }))
  expect(screen.getByText('Solo se asignan las primeras 1 fechas; el resto queda sin predicador.')).toBeTruthy()
  expect(within(screen.getByRole('region', { name: 'Predicadores por fecha' })).getAllByRole('listitem').map((row) => row.textContent?.endsWith('Sin predicador'))).toEqual([false, true, true])
})

test('the review shows each preacher and the batch sends them, also when the preacher is the director', async () => {
  const calls = stubApi({ church: preachingChurch, period: period(fridays('13', '20')), directory: people, batch: echo })
  page()
  await toPreachers('Juan', 'Luis')
  fireEvent.click(screen.getByRole('button', { name: 'Revisar' }))
  expect(await screen.findByLabelText('Paso 4/4')).toBeTruthy()
  expect(rowOf('13').getAttribute('aria-label')).toContain('Juan Pérez, predica Juan Pérez')
  expect(rowOf('20').textContent).toContain('Predica: Luis Herrera')
  fireEvent.click(screen.getByRole('button', { name: /Crear 2 servicios/ }))
  await screen.findByText('2 servicios creados')
  expect(sent(calls).entries.map((entry) => [entry.date, entry.directorId, entry.preacherId])).toEqual([['2026-11-13', 'p3', 'p3'], ['2026-11-20', 'p3', 'p2']])
})

test('in the review a preacher is changed for one date only, and can be removed', async () => {
  const calls = stubApi({ church: preachingChurch, period: period(fridays('13', '20')), directory: people, batch: echo })
  page()
  await toPreachers('Ana')
  fireEvent.click(screen.getByRole('button', { name: 'Revisar' }))
  await openPreaching('13')
  fireEvent.click(await screen.findByRole('button', { name: /Cambiar predicador/ }))
  const dialog = await screen.findByRole('dialog', { name: 'Cambiar predicador' })
  fireEvent.focus(within(dialog).getByRole('combobox'))
  fireEvent.click(await within(dialog).findByRole('option', { name: /Luis Herrera/ }))
  await waitFor(() => expect(rowOf('13').textContent).toContain('Predica: Luis Herrera'))
  expect(rowOf('20').textContent).toContain('Predica: Ana Ramírez')
  await openPreaching('20')
  fireEvent.click(await screen.findByRole('button', { name: /Quitar predicador/ }))
  await waitFor(() => expect(rowOf('20').textContent).not.toContain('Predica:'))
  fireEvent.click(screen.getByRole('button', { name: /Crear 2 servicios/ }))
  await screen.findByText('2 servicios creados')
  expect(sent(calls).entries.map((entry) => entry.preacherId)).toEqual(['p2', undefined])
})

test('swapping preachers in the review shows both dates and changes only the preachers', async () => {
  const calls = stubApi({ church: preachingChurch, period: period(fridays('13', '20', '27')), directory: people, batch: echo })
  page()
  await toPreachers('Ana', 'Luis', 'Ana')
  fireEvent.click(screen.getByRole('button', { name: 'Revisar' }))
  await openPreaching('13')
  fireEvent.click(await screen.findByRole('button', { name: /Intercambiar con otra fecha/ }))
  // La fecha del 27 tiene a la misma persona: no se ofrece.
  const dialog = within(await screen.findByRole('dialog'))
  const options = await dialog.findAllByRole('button', { name: /vie \d+ nov/ })
  expect(options.map((option) => option.textContent)).toEqual([expect.stringContaining('vie 20 nov')])
  fireEvent.click(options[0]!)
  expect(dialog.getByText('Ana Ramírez → Luis Herrera')).toBeTruthy()
  expect(dialog.getByText('Luis Herrera → Ana Ramírez')).toBeTruthy()
  fireEvent.click(dialog.getByRole('button', { name: 'Confirmar intercambio' }))
  await waitFor(() => expect(rowOf('13').textContent).toContain('Predica: Luis Herrera'))
  expect(rowOf('20').textContent).toContain('Predica: Ana Ramírez')
  fireEvent.click(screen.getByRole('button', { name: /Crear 3 servicios/ }))
  await screen.findByText('3 servicios creados')
  expect(sent(calls).entries.map((entry) => [entry.directorId, entry.preacherId])).toEqual([['p3', 'p2'], ['p3', 'p1'], ['p3', 'p1']])
})

test('a date removed from the batch takes no preacher with it', async () => {
  const calls = stubApi({ church: preachingChurch, period: period(fridays('13', '20')), directory: people, batch: echo })
  page()
  await toPreachers('Ana', 'Luis')
  fireEvent.click(screen.getByRole('button', { name: 'Revisar' }))
  fireEvent.click(rowOf('13'))
  fireEvent.click(await screen.findByRole('button', { name: /Quitar de este lote/ }))
  await waitFor(() => expect(rowOf('13').textContent).not.toContain('Predica:'))
  fireEvent.click(screen.getByRole('button', { name: /Crear 1 servicio/ }))
  fireEvent.click(await screen.findByRole('button', { name: 'Confirmar y crear' }))
  await screen.findByText('1 servicio creado')
  expect(sent(calls).entries.map((entry) => [entry.date, entry.preacherId])).toEqual([['2026-11-20', 'p2']])
})
