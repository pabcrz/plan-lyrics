import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiFetch } from '../calendar/api'

export type ChurchLink = { id: string; canPlay: boolean; canDirect: boolean; canPreach: boolean; roleIds: string[] }
export type PlatformPerson = { id: string; name: string; phone: string | null; email: string | null; hasAccount: boolean; churches: ChurchLink[] }
export type PlatformChurch = { id: string; name: string; usesPreaching: boolean; roles: Array<{ id: string; name: string }> }
export type Flags = Omit<ChurchLink, 'id'>

export function usePlatformPeople(enabled: boolean) {
  const api = useApiFetch()
  return useQuery({ queryKey: ['platform', 'people'], queryFn: () => api<PlatformPerson[]>('/api/platform/people'), enabled, retry: false })
}

export function usePlatformChurches(enabled: boolean) {
  const api = useApiFetch()
  return useQuery({ queryKey: ['platform', 'churches'], queryFn: () => api<PlatformChurch[]>('/api/platform/churches'), enabled, retry: false })
}

/** Cada cambio refresca la lista global y, como las iglesias leen lo mismo, también sus directorios y participaciones. */
export function usePlatformActions() {
  const api = useApiFetch()
  const client = useQueryClient()
  const run = useCallback(async <T,>(request: () => Promise<T>) => {
    try {
      return await request()
    } finally {
      await Promise.all(['platform', 'people', 'person', 'participations'].map((key) => client.invalidateQueries({ queryKey: [key] })))
    }
  }, [client])
  const person = (id: string) => `/api/platform/people/${encodeURIComponent(id)}`
  return {
    create: useCallback((body: { name: string; phone?: string; email?: string }) => run(() => api<PlatformPerson>('/api/platform/people', { method: 'POST', body })), [api, run]),
    update: useCallback((id: string, body: { name?: string; phone?: string | null; email?: string | null }) => run(() => api<Omit<PlatformPerson, 'churches'>>(person(id), { method: 'PATCH', body })), [api, run]),
    assign: useCallback((id: string, churchId: string, flags: Flags) => run(() => api<ChurchLink>(`${person(id)}/churches/${encodeURIComponent(churchId)}`, { method: 'PUT', body: flags })), [api, run]),
    unassign: useCallback((id: string, churchId: string) => run(() => api<void>(`${person(id)}/churches/${encodeURIComponent(churchId)}`, { method: 'DELETE' })), [api, run]),
  }
}
