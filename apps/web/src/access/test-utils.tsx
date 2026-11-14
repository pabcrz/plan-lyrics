import { vi } from 'vitest'
import { church as baseChurch } from '../calendar/test-utils'
import type { Church } from '../calendar/model'
import type { Account, Accounts, Candidate, Member, Members } from './access-api'

export const admin = (over: Partial<Member> = {}): Member => ({ userId: 'u-admin', role: 'ADMIN', self: true, protected: false, person: { id: 'p-admin', name: 'Ana Ramírez' }, ...over })
export const members: Member[] = [
  admin(),
  { userId: 'u-editor', role: 'EDITOR', self: false, protected: false, person: { id: 'p-editor', name: 'Luis Herrera' } },
  { userId: 'u-member', role: 'MEMBER', self: false, protected: false, person: null },
  { userId: 'u-owner', role: 'MEMBER', self: false, protected: true, person: { id: 'p-owner', name: 'Pablo Cruz' } },
]
export const candidates: Candidate[] = [{ personId: 'p-new', name: 'Marta Solís' }]

export const account = (over: Partial<Account> = {}): Account => ({ id: 'a1', email: 'ana@example.com', accountManager: false, libraryEditor: false, owner: false, person: { id: 'p1', name: 'Ana Ramírez' }, ...over })
export const accountList: Account[] = [
  account(),
  account({ id: 'a2', email: 'nuevo@example.com', person: null }),
  account({ id: 'a-owner', email: null, owner: true, person: { id: 'p-owner', name: 'Pablo Cruz' } }),
]

type Reply = { status: number; body?: unknown }
export type Stub = {
  church?: Church | number
  access?: { owner: boolean; accountManager: boolean } | number
  members?: Members | number
  accounts?: Accounts | number
  /** Respuesta forzada por «MÉTODO ruta» (con prefijo `startsWith` sobre la ruta). */
  fail?: Record<string, Reply>
}

/** Doble de fetch de las pantallas de accesos: devuelve las peticiones para inspeccionarlas. */
export function stubAccess(routes: Stub = {}) {
  const calls: Array<{ method: string; url: string; body?: unknown }> = []
  let current = routes.members
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ method, url, body })
    const reply = (status: number, payload?: unknown) => (status === 204 ? new Response(null, { status }) : new Response(JSON.stringify(payload ?? {}), { status }))
    const forced = Object.entries(routes.fail ?? {}).find(([key]) => `${method} ${url}`.startsWith(key))
    if (forced) return reply(forced[1].status, forced[1].body ?? { error: 'x' })
    if (url === '/api/active-church') return typeof routes.church === 'number' ? reply(routes.church, { error: 'x' }) : reply(200, routes.church ?? baseChurch)
    if (url === '/api/access') return typeof routes.access === 'number' ? reply(routes.access, { error: 'x' }) : reply(200, routes.access ?? { owner: false, accountManager: false })
    if (url === '/api/members' && method === 'GET') {
      if (typeof current === 'number') return reply(current, { error: 'x' })
      return reply(200, current ?? { members, candidates })
    }
    if (url === '/api/members' && method === 'POST') {
      const base = (typeof current === 'object' ? current : { members, candidates }) as Members
      const person = base.candidates.find((item) => item.personId === body.personId)
      const created: Member = { userId: `u-${body.personId}`, role: body.role, self: false, protected: false, person: person ? { id: person.personId, name: person.name } : null }
      current = { members: [...base.members, created], candidates: base.candidates.filter((item) => item.personId !== body.personId) }
      return reply(201, created)
    }
    if (url.startsWith('/api/members/')) {
      const id = decodeURIComponent(url.split('/').pop() ?? '')
      const base = (typeof current === 'object' ? current : { members, candidates }) as Members
      if (method === 'PATCH') {
        current = { ...base, members: base.members.map((item) => (item.userId === id ? { ...item, role: body.role } : item)) }
        return reply(200, current.members.find((item) => item.userId === id))
      }
      current = { ...base, members: base.members.filter((item) => item.userId !== id) }
      return reply(204)
    }
    if (url === '/api/accounts' && method === 'GET') {
      return typeof routes.accounts === 'number' ? reply(routes.accounts, { error: 'x' })
        : reply(200, routes.accounts ?? { viewer: { owner: typeof routes.access === 'object' && routes.access.owner }, accounts: accountList, people: [{ id: 'p-free', name: 'Marta Solís' }] })
    }
    if (url === '/api/accounts' && method === 'POST') return reply(201, account({ id: 'a-new', email: body.email, person: null }))
    if (url.endsWith('/person') && method === 'PUT') return reply(200, account({ person: { id: body.personId, name: 'Marta Solís' } }))
    if (url.endsWith('/person') && method === 'DELETE') return reply(204)
    if (url.endsWith('/library-editor') && method === 'PUT') return reply(200, account({ libraryEditor: body.enabled }))
    if (url.endsWith('/account-manager') && method === 'PUT') return reply(200, { id: 'a1', accountManager: body.enabled })
    return reply(404, { error: 'Not found' })
  }))
  return calls
}
