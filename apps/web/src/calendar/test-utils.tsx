import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import type { Church, ClosedDate, PersonDetail, Service } from './model'
import type { Assignment, RoleParticipation, Turn } from './participations-api'
import type { Preaching, PreachingTurn } from './preaching-api'
import type { MusicalRole, RoleRestriction } from './roles-api'

export const church: Church = {
  id: 'church-a', name: 'Betel', sundayDouble: false, usesPreaching: false, congregationShowsPreacher: false, canEdit: true, canConfigure: true, timeZone: 'America/Mexico_City',
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

export const defaultRoles: MusicalRole[] = [
  { id: 'r-drums', name: 'Batería' }, { id: 'r-guitar', name: 'Guitarra' }, { id: 'r-piano', name: 'Piano' }, { id: 'r-voices', name: 'Voces' },
]
export const defaultRestrictions: RoleRestriction[] = [{ id: 'x1', first: 'DIRIGIR', second: 'r-drums' }]

type Handler =(url: string, init?: RequestInit) => { status?: number; body?: unknown } | undefined

/** Doble de fetch por ruta; devuelve las peticiones hechas para poder inspeccionarlas. */
export const detail = (over: Partial<PersonDetail> = {}): PersonDetail => ({
  id: 'p1', name: 'Ana Ramírez', phone: null, hasAccount: false, sharedWithOtherChurches: false, upcomingServices: 0, ...over,
})

export function stubApi(routes: {
  church?: Church | number; services?: Service[]; closed?: ClosedDate[]; post?: Handler; save?: Handler; mark?: Handler; unmark?: Handler
  /** Directorio: lista, ficha por id y respuestas a alta, edición y baja. */
  directory?: PersonDetail[]; createPerson?: Handler; patchPerson?: Handler; removePerson?: Handler
  /** Roles y restricciones de la iglesia; las altas y bajas los cambian como lo haría el servidor. */
  roles?: MusicalRole[]; restrictions?: RoleRestriction[]; createRole?: Handler; addRestriction?: Handler
  /** Lote mensual: período (por URL) y creación. */
  period?: Handler; batch?: Handler
  /** Participaciones por rol, asignaciones por servicio, turnos para intercambiar y servicios futuros por rol (avisa al quitarlo). */
  participations?: RoleParticipation[]; assignments?: Record<string, Assignment[]>; turns?: Turn[]; futureServices?: Record<string, number>
  /** Respuestas a guardar un rol, y a reemplazar, agregar, quitar e intercambiar asignaciones. */
  saveParticipation?: Handler; assignmentChange?: Handler
  /** Predicación por servicio (por id), fechas con predicador para intercambiar y la respuesta a guardar o intercambiar. */
  preaching?: Record<string, Preaching>; preachingTurns?: PreachingTurn[]; preachingChange?: Handler
}) {
  const roles = [...(routes.roles ?? defaultRoles)]
  const restrictions = [...(routes.restrictions ?? defaultRestrictions)]
  const directoryPeople = () => (routes.directory ?? people.map((person) => detail(person))).map(({ id, name }) => ({ id, name }))
  const participations = routes.participations ?? roles.map((role): RoleParticipation => ({
    roleId: role.id, name: role.name, habitual: [], rotation: { enabled: false, mode: 'BY_DAY', startsOn: null, sequences: [] }, preview: [],
  }))
  const assignments = { ...routes.assignments }
  const preaching = { ...routes.preaching }
  const calls: Array<{ url: string; init?: RequestInit }> = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })
    if (url === '/api/active-church' && init?.method !== 'PUT') return typeof routes.church === 'number' ? reply(routes.church, { error: 'x' }) : reply(200, routes.church ?? church)
    if (url === '/api/active-church' && init?.method === 'PUT') {
      const result = routes.save?.(url, init)
      return reply(result?.status ?? 200, result?.body ?? { ...church, ...JSON.parse(String(init.body)) })
    }
    if (url === '/api/roles' && init?.method === 'POST') {
      const result = routes.createRole?.(url, init)
      if (result?.status && result.status >= 400) return reply(result.status, result.body ?? { error: 'x' })
      const role = { id: `new-${roles.length}`, name: JSON.parse(String(init.body)).name as string }
      roles.push(role)
      return reply(201, result?.body ?? role)
    }
    if (url === '/api/roles') return reply(200, [...roles].sort((a, b) => a.name.localeCompare(b.name, 'es')))
    if (url.startsWith('/api/roles/') && init?.method === 'DELETE') {
      const [path, query = ''] = url.split('?')
      const id = decodeURIComponent(path.split('/').pop() ?? '')
      const ahead = routes.futureServices?.[id] ?? 0
      if (ahead > 0 && query !== 'confirm=future-assignments') return reply(409, { error: 'Future assignments', services: ahead })
      roles.splice(0, roles.length, ...roles.filter((role) => role.id !== id))
      restrictions.splice(0, restrictions.length, ...restrictions.filter((item) => item.first !== id && item.second !== id))
      return new Response(null, { status: 204 })
    }
    if (url === '/api/role-restrictions' && init?.method === 'POST') {
      const result = routes.addRestriction?.(url, init)
      if (result?.status && result.status >= 400) return reply(result.status, result.body ?? { error: 'x' })
      const item = { id: `rr-${restrictions.length}`, ...JSON.parse(String(init.body)) } as RoleRestriction
      restrictions.push(item)
      return reply(201, item)
    }
    if (url === '/api/role-restrictions') return reply(200, restrictions)
    if (url.startsWith('/api/role-restrictions/') && init?.method === 'DELETE') {
      const id = decodeURIComponent(url.split('/').pop() ?? '')
      restrictions.splice(0, restrictions.length, ...restrictions.filter((item) => item.id !== id))
      return new Response(null, { status: 204 })
    }
    if (url === '/api/role-participations') return reply(200, participations)
    if (url.startsWith('/api/role-participations/') && init?.method === 'PUT') {
      const result = routes.saveParticipation?.(url, init)
      if (result?.status && result.status >= 400) return reply(result.status, result.body ?? { error: 'x' })
      const id = decodeURIComponent(url.split('/').pop() ?? '')
      const body = JSON.parse(String(init.body)) as { habitualIds: string[]; rotation: { enabled: boolean; mode: 'BY_DAY' | 'SHARED'; startsOn: string | null; sequences: { weekday: number | null; personIds: string[] }[] } }
      const who = (ids: string[]) => ids.map((personId) => directoryPeople().find((person) => person.id === personId)!)
      const index = participations.findIndex((role) => role.roleId === id)
      participations[index] = {
        ...participations[index], habitual: who(body.habitualIds),
        rotation: { ...body.rotation, sequences: body.rotation.sequences.map((sequence) => ({ weekday: sequence.weekday, people: who(sequence.personIds) })) },
      }
      return reply(200, participations[index])
    }
    if (url.startsWith('/api/services/') && url.endsWith('/preaching')) {
      const serviceId = decodeURIComponent(url.split('/')[3] ?? '')
      if (init?.method === 'PUT') {
        const result = routes.preachingChange?.(url, init)
        if (result?.status && result.status >= 400) return reply(result.status, result.body ?? { error: 'x' })
        const body = JSON.parse(String(init.body)) as { preacherId: string | null; topic: string; passages: string[]; notes: string }
        preaching[serviceId] = { serviceId, preacher: directoryPeople().find((person) => person.id === body.preacherId) ?? null, topic: body.topic, passages: body.passages, canSeeNotes: true, notes: body.notes }
        return reply(200, preaching[serviceId])
      }
      return reply(200, preaching[serviceId] ?? { serviceId, preacher: null, topic: '', passages: [], canSeeNotes: true, notes: '' })
    }
    if (url === '/api/preaching-turns') return reply(200, routes.preachingTurns ?? [])
    if (url === '/api/preaching/swap' && init?.method === 'POST') {
      const result = routes.preachingChange?.(url, init)
      return result?.status && result.status >= 400 ? reply(result.status, result.body ?? { error: 'x' }) : reply(200, { swapped: [] })
    }
    if (url.startsWith('/api/services/') && url.endsWith('/assignments')) {
      const serviceId = decodeURIComponent(url.split('/')[3] ?? '')
      if (init?.method === 'POST') {
        const result = routes.assignmentChange?.(url, init)
        if (result?.status && result.status >= 400) return reply(result.status, result.body ?? { error: 'x' })
        const body = JSON.parse(String(init.body)) as { roleId: string; personId: string }
        const row: Assignment = { id: `new-${Math.random()}`, roleId: body.roleId, roleName: roles.find((role) => role.id === body.roleId)?.name ?? '', source: 'MANUAL', pending: null, person: directoryPeople().find((person) => person.id === body.personId)!, proposed: null }
        assignments[serviceId] = [...(assignments[serviceId] ?? []), row]
        return reply(201, row)
      }
      return reply(200, { service: { id: serviceId, title: 'Servicio', date: '2026-11-13', slot: 'SINGLE', director: people[0] }, assignments: assignments[serviceId] ?? [] })
    }
    if (url === '/api/assignments/swap' && init?.method === 'POST') {
      const result = routes.assignmentChange?.(url, init)
      return result?.status && result.status >= 400 ? reply(result.status, result.body ?? { error: 'x' }) : reply(200, { swapped: [] })
    }
    if (url.startsWith('/api/assignments/')) {
      const result = routes.assignmentChange?.(url, init)
      if (result?.status && result.status >= 400) return reply(result.status, result.body ?? { error: 'x' })
      const id = decodeURIComponent(url.split('/').pop() ?? '')
      for (const key of Object.keys(assignments)) {
        assignments[key] = init?.method === 'DELETE' ? assignments[key].filter((row) => row.id !== id)
          : assignments[key].map((row) => (row.id === id ? { ...row, person: directoryPeople().find((person) => person.id === JSON.parse(String(init?.body)).personId)!, pending: null, source: 'MANUAL' } : row))
      }
      return init?.method === 'DELETE' ? new Response(null, { status: 204 }) : reply(200, {})
    }
    if (url.startsWith('/api/role-turns')) return reply(200, routes.turns ?? [])
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
    if (url.startsWith('/api/service-batches/period')) {
      const result = routes.period?.(url, init)
      return reply(result?.status ?? 200, result?.body ?? { month: '', entries: [], previous: null })
    }
    if (url === '/api/service-batches' && init?.method === 'POST') {
      const result = routes.batch?.(url, init)
      return reply(result?.status ?? 201, result?.body ?? { services: [] })
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
