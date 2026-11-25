import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { church, mount, people } from '../calendar/test-utils'
import { EditServiceSheet, updateFailure } from './EditServiceSheet'
import { ApiError } from '../calendar/api'

vi.mock('@clerk/react', () => ({ useAuth: () => ({ getToken: async () => 'token-ficticio' }), UserButton: () => <button>Cuenta</button> }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const service = { id: 's1', title: 'Servicio dominical', date: '2026-11-22', slot: 'SINGLE' as const, time: '10:00', status: 'DRAFT' as const }

function open(reply: { status: number; body?: unknown } = { status: 200, body: {} }, over: Partial<typeof church> = {}, current = service) {
  const calls: Array<{ method: string; url: string; body?: unknown }> = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (url === '/api/people?role=direct') return new Response(JSON.stringify(people), { status: 200 })
    return new Response(reply.status === 204 ? null : JSON.stringify(reply.body ?? {}), { status: reply.status })
  }))
  const onSaved = vi.fn()
  const onDeleted = vi.fn()
  mount(<EditServiceSheet church={{ ...church, ...over }} service={current} directorId="p1" onClose={() => undefined} onSaved={onSaved} onDeleted={onDeleted} />)
  return { calls, onSaved, onDeleted }
}
const patches = (calls: Array<{ method: string; url: string; body?: unknown }>) => calls.filter((call) => call.method === 'PATCH')

test('there is no title or status to manage: a new director renames the service on its own and only what changed is sent', async () => {
  const { calls, onSaved } = open()
  const save = await screen.findByRole('button', { name: 'Guardar cambios' })
  expect((save as HTMLButtonElement).disabled).toBe(true)
  expect(screen.queryByLabelText('Título')).toBeNull()
  expect(screen.queryByRole('group', { name: 'Estado' })).toBeNull()
  fireEvent.click(await screen.findByRole('button', { name: /Luis Herrera/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalled())
  expect(patches(calls)).toEqual([{ method: 'PATCH', url: '/api/services/s1', body: { title: 'Domingo 22 - Luis', directorId: 'p2' } }])
})

test('the date and an empty hour are sent, and the name follows the new date; the slot only appears on a double Sunday', async () => {
  const { calls, onSaved } = open({ status: 200, body: {} }, { sundayDouble: true })
  expect(await screen.findByRole('group', { name: 'Franja' })).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-11-27' } })
  expect(screen.queryByRole('group', { name: 'Franja' })).toBeNull()
  fireEvent.change(screen.getByLabelText('Hora de inicio'), { target: { value: '' } })
  await screen.findByRole('button', { name: /Ana Ramírez/ })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalled())
  expect(patches(calls)[0]?.body).toEqual({ title: 'Viernes 27 - Ana', date: '2026-11-27', time: null })
})

test('a service cancelled before can be reactivated, which is the only status left to manage', async () => {
  const { calls, onSaved } = open({ status: 200, body: {} }, {}, { ...service, status: 'CANCELLED' as never })
  fireEvent.click(await screen.findByRole('button', { name: 'Reactivar servicio' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalled())
  expect(patches(calls)).toEqual([{ method: 'PATCH', url: '/api/services/s1', body: { status: 'PUBLISHED' } }])
})

test('a refused change explains why and keeps the sheet open', async () => {
  const { onSaved } = open({ status: 409, body: { error: 'Date closed' } })
  fireEvent.change(await screen.findByLabelText('Fecha'), { target: { value: '2026-11-27' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  expect((await screen.findByRole('alert')).textContent).toContain('No hay culto')
  expect(onSaved).not.toHaveBeenCalled()
})

test('every refusal the server can give has its own message', () => {
  const text = (status: number, code: string) => updateFailure(new ApiError(status, code))
  expect(text(400, 'Date in the past')).toContain('fecha pasada')
  expect(text(409, 'Date full')).toContain('máximo')
  expect(text(409, 'Combination not allowed')).toContain('no puede dirigir')
  expect(text(403, 'Forbidden')).toContain('permiso')
  expect(text(404, 'Not found')).toContain('ya no existe')
})

test('deleting asks for confirmation first, then removes the service', async () => {
  const { calls, onDeleted } = open({ status: 204 })
  fireEvent.click(await screen.findByRole('button', { name: 'Eliminar servicio' }))
  expect(calls.some((call) => call.method === 'DELETE')).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Sí, eliminar servicio' }))
  await waitFor(() => expect(onDeleted).toHaveBeenCalled())
  expect(calls.filter((call) => call.method === 'DELETE')).toEqual([{ method: 'DELETE', url: '/api/services/s1', body: undefined }])
})

test('a refused deletion explains why and does not leave the page', async () => {
  const { onDeleted } = open({ status: 403, body: { error: 'Forbidden' } })
  fireEvent.click(await screen.findByRole('button', { name: 'Eliminar servicio' }))
  fireEvent.click(screen.getByRole('button', { name: 'Sí, eliminar servicio' }))
  await waitFor(() => expect(screen.getAllByRole('alert').map((a) => a.textContent).join(' ')).toContain('No tienes permiso para eliminar'))
  expect(onDeleted).not.toHaveBeenCalled()
})
