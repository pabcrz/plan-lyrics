import { vi } from 'vitest'
import { church as baseChurch, stubApi } from '../calendar/test-utils'
import type { Church, ClosedDate, Service } from '../calendar/model'
import type { ShareLink } from './share-model'

export const link = (over: Partial<ShareLink> = {}): ShareLink => ({
  id: 'l1', version: 'FULL', scope: { kind: 'range', from: '2026-12-01', to: '2026-12-31' }, blocks: { keys: false, notes: true, people: true },
  status: 'ACTIVE', activeUntil: '2027-01-26', reactivated: false, canReactivate: false, createdAt: '2026-11-04T12:00:00.000Z',
  path: '/m/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', ...over,
})

type Reply = { status?: number; body?: unknown }
type Options = {
  church?: Partial<Church>; services?: Service[]; closed?: ClosedDate[]; links?: ShareLink[] | number
  /** Cualquier otra ruta (setlist, documento de predicaciones…), antes que el servidor de calendario. */
  extra?: (url: string, init?: RequestInit) => Reply | undefined
  create?: (body: Record<string, unknown>) => Reply | undefined; revoke?: (id: string) => Reply | undefined; reactivate?: (id: string) => Reply | undefined
}

/** Servidor ficticio de enlaces sobre el de calendario: lista viva, y creación, revocación y reactivación que la cambian. */
export function stubShare(options: Options = {}) {
  const links = typeof options.links === 'number' ? [] : [...(options.links ?? [])]
  const base = stubApi({ church: { ...baseChurch, ...options.church }, services: options.services, closed: options.closed })
  const calendar = globalThis.fetch as unknown as (url: string, init?: RequestInit) => Promise<Response>
  const calls: Array<{ url: string; method: string; body?: Record<string, unknown> }> = []
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const other = options.extra?.(url, init)
    if (other) return reply(other.status ?? 200, other.body)
    if (!url.startsWith('/api/share-links')) return calendar(url, init)
    const method = init?.method ?? 'GET'
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (typeof options.links === 'number') return reply(options.links, { error: 'x' })
    if (url === '/api/share-links' && method === 'GET') return reply(200, links)
    if (url === '/api/share-links' && method === 'POST') {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      const result = options.create?.(body)
      if (result?.status && result.status >= 400) return reply(result.status, result.body ?? { error: 'x' })
      const asked = body.scope as { kind: 'service'; serviceId: string } | { kind: 'range'; from: string; to: string }
      const scope: ShareLink['scope'] = asked.kind === 'service' ? { kind: 'service', serviceId: asked.serviceId, date: options.services?.find((item) => item.id === asked.serviceId)?.date ?? '' } : asked
      const created = link({ id: `new-${links.length}`, version: body.version as ShareLink['version'], blocks: body.blocks as ShareLink['blocks'], scope })
      links.unshift(created)
      return reply(201, result?.body ?? created)
    }
    const [, , , id = '', action = ''] = url.split('/')
    const index = links.findIndex((item) => item.id === decodeURIComponent(id))
    const handler = action === 'revoke' ? options.revoke : options.reactivate
    const result = handler?.(id)
    if (result?.status && result.status >= 400) return reply(result.status, result.body ?? { error: 'x' })
    if (action === 'revoke') links[index] = { ...links[index]!, status: 'REVOKED', path: null, canReactivate: !links[index]!.reactivated }
    else links[index] = { ...links[index]!, status: 'ACTIVE', path: link().path, reactivated: true, canReactivate: false, activeUntil: '2026-12-13' }
    return reply(200, links[index])
  }))
  return { calls, base, links }
}
