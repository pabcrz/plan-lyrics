import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import type { Church, ClosedDate, PersonDetail, Service } from './model'

export const church: Church = {
  id: 'church-a', name: 'Betel', sundayDouble: false, usesPreaching: false, canEdit: true, canConfigure: true, timeZone: 'America/Mexico_City',
  days: [
    { weekday: 5, slot: 'SINGLE', time: '19:30', title: 'Servicio de viernes' },
    { weekday: 0, slot: 'SINGLE', time: '10:00', title: 'Servicio dominical' },
  ],
}
export const people = [{ id: 'p1', name: 'Ana Ramírez' }, { id: 'p2', name: 'Luis Herrera' }]
export const service = (over: Partial<Service>): Service => ({
  id: 's1', title: 'Servicio de viernes', date: '2026-11-13', slot: 'SINGLE', time: '19:30', status: 'PUBLISHED',
  director: people[0], ...over,
})

type Handler = (url: string, init?: RequestInit) => { status?: number; body?: unknown } | undefined

/** Doble de fetch por ruta; devuelve las peticiones hechas para poder inspeccionarlas. */
export const detail = (over: Partial<PersonDetail> = {}): PersonDetail => ({
  id: 'p1', name: 'Ana Ramírez', phone: null, hasAccount: false, sharedWithOtherChurches: false, upcomingServices: 0, ...over,
})

export function stubApi(routes: {
  church?: Church | number; services?: Service[]; closed?: ClosedDate[]; post?: Handler; save?: Handler; mark?: Handler; unmark?: Handler
  /** Directorio: lista, ficha por id y respuestas a alta, edición y baja. */
  directory?: PersonDetail[]; createPerson?: Handler; patchPerson?: Handler; removePerson?: Handler
}) {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })
    if (url === '/api/active-church' && init?.method !== 'PUT') return typeof routes.church === 'number' ? reply(routes.church, { error: 'x' }) : reply(200, routes.church ?? church)
    if (url === '/api/active-church' && init?.method === 'PUT') {
      const result = routes.save?.(url, init)
      return reply(result?.status ?? 200, result?.body ?? { ...church, ...JSON.parse(String(init.body)) })
    }
    if (url === '/api/people' && init?.method === 'POST') {
      const result = routes.createPerson?.(url, init)
      return reply(result?.status ?? 201, result?.body ?? detail({ id: 'new', ...JSON.parse(String(init.body)) }))
    }
    if (url === '/api/people') {
      const list = routes.directory ?? people.map((person) => detail(person))
      return reply(200, list.map(({ id, name, hasAccount }) => ({ id, name, hasAccount })))
    }
    if (url.startsWith('/api/people/')) {
      const id = decodeURIComponent(url.split('/').pop() ?? '')
      if (init?.method === 'PATCH') {
        const result = routes.patchPerson?.(url, init)
        return reply(result?.status ?? 200, result?.body ?? { ...detail({ id }), ...JSON.parse(String(init.body)) })
      }
      if (init?.method === 'DELETE') {
        const result = routes.removePerson?.(url, init)
        return result?.status && result.status >= 400 ? reply(result.status, result.body ?? { error: 'x' }) : new Response(null, { status: 204 })
      }
      const found = (routes.directory ?? [detail()]).find((person) => person.id === id)
      return found ? reply(200, found) : reply(404, { error: 'Not found' })
    }
    if (url.startsWith('/api/services?month=')) {
      const month = url.split('=')[1]
      return reply(200, (routes.services ?? []).filter((item) => item.date.startsWith(month)))
    }
    if (url.startsWith('/api/closed-dates?month=')) {
      const month = url.split('=')[1]
      return reply(200, (routes.closed ?? []).filter((item) => item.date.startsWith(month)))
    }
    if (url.startsWith('/api/closed-dates/') && init?.method === 'PUT') {
      const result = routes.mark?.(url, init)
      return reply(result?.status ?? 201, result?.body ?? { date: url.split('/').pop(), reason: null })
    }
    if (url.startsWith('/api/closed-dates/') && init?.method === 'DELETE') {
      const result = routes.unmark?.(url, init)
      return result?.status && result.status >= 400 ? reply(result.status, result.body ?? { error: 'x' }) : new Response(null, { status: 204 })
    }
    if (url === '/api/services' && init?.method === 'POST') {
      const result = routes.post?.(url, init)
      return reply(result?.status ?? 201, result?.body ?? service({}))
    }
    return reply(404, {})
  }))
  return calls
}

export function mount(ui: ReactNode, path = '/') {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}
