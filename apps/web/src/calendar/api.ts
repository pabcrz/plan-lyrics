import { useCallback } from 'react'
import { useAuth } from '@clerk/react'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Church, ChurchSettings, ClosedDate, Person, PersonDetail, Service, Status, Slot } from './model'

export class ApiError extends Error {
  constructor(readonly status: number, readonly code = '', readonly issues: string[] = [], readonly existing?: { id: string; name: string }) {
    super(`API ${status}`)
  }
}

/** Petición con el Bearer de Clerk; sin cookies ni caché. La API decide siempre los permisos. */
export function useApiFetch() {
  const { getToken } = useAuth()
  return useCallback(async <T,>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> => {
    const token = await getToken()
    if (!token) throw new ApiError(401)
    const response = await fetch(path, {
      method: init.method ?? 'GET',
      headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
      credentials: 'omit',
    })
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: unknown } | null
      const issues = (body as { issues?: unknown } | null)?.issues
      const existing = (body as { existing?: { id?: unknown; name?: unknown } } | null)?.existing
      throw new ApiError(
        response.status, typeof body?.error === 'string' ? body.error : '',
        Array.isArray(issues) ? issues.filter((item): item is string => typeof item === 'string') : [],
        typeof existing?.id === 'string' && typeof existing.name === 'string' ? { id: existing.id, name: existing.name } : undefined,
      )
    }
    return (response.status === 204 ? undefined : await response.json()) as T
  }, [getToken])
}

export function useChurch() {
  const api = useApiFetch()
  return useQuery({ queryKey: ['church'], queryFn: () => api<Church>('/api/active-church'), retry: false })
}

/** Guarda los ajustes; la respuesta del servidor reemplaza la iglesia en caché para calendario y formulario. */
export function useSaveChurch() {
  const api = useApiFetch()
  const client = useQueryClient()
  return useCallback(async (settings: ChurchSettings) => {
    const saved = await api<Church>('/api/active-church', { method: 'PUT', body: settings })
    client.setQueryData(['church'], saved)
    return saved
  }, [api, client])
}

export function usePeople(enabled: boolean) {
  const api = useApiFetch()
  return useQuery({ queryKey: ['people'], queryFn: () => api<Person[]>('/api/people'), enabled, retry: false })
}

export function usePerson(id: string) {
  const api = useApiFetch()
  return useQuery({ queryKey: ['person', id], queryFn: () => api<PersonDetail>(`/api/people/${encodeURIComponent(id)}`), retry: false })
}

/** Alta, edición de datos personales y baja; el servidor decide permisos, duplicados e iglesia. */
export function usePersonActions() {
  const api = useApiFetch()
  const client = useQueryClient()
  const refresh = useCallback(() => Promise.all([client.invalidateQueries({ queryKey: ['people'] }), client.invalidateQueries({ queryKey: ['person'] })]), [client])
  const create = useCallback(async (person: { name: string; phone?: string }) => {
    const created = await api<Omit<PersonDetail, 'sharedWithOtherChurches' | 'upcomingServices'>>('/api/people', { method: 'POST', body: person })
    await refresh()
    return created
  }, [api, refresh])
  const update = useCallback(async (id: string, patch: { name?: string; phone?: string | null }) => {
    const saved = await api<Omit<PersonDetail, 'sharedWithOtherChurches' | 'upcomingServices'>>(`/api/people/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch })
    await refresh()
    return saved
  }, [api, refresh])
  const remove = useCallback(async (id: string) => {
    await api<void>(`/api/people/${encodeURIComponent(id)}`, { method: 'DELETE' })
    await refresh()
  }, [api, refresh])
  return { create, update, remove }
}

/** Servicios de uno o varios meses (`YYYY-MM`), cada uno en su propia consulta. */
export function useServices(months: string[]) {
  const api = useApiFetch()
  const results = useQueries({
    queries: months.map((month) => ({
      queryKey: ['services', month],
      queryFn: () => api<Service[]>(`/api/services?month=${month}`),
      retry: false,
    })),
  })
  return {
    services: results.flatMap((result) => result.data ?? []),
    loading: results.some((result) => result.isPending),
    error: results.find((result) => result.error)?.error ?? null,
  }
}

export type NewService = {
  title: string; date: string; status: Extract<Status, 'DRAFT' | 'PUBLISHED'>; directorId: string
  time?: string | null; slot?: Exclude<Slot, 'SINGLE'>
}

export function useCreateService() {
  const api = useApiFetch()
  const client = useQueryClient()
  return useCallback(async (service: NewService) => {
    try {
      return await api<Service>('/api/services', { method: 'POST', body: service })
    } finally {
      // Éxito o rechazo (p. ej. fecha completa): la lista visible debe reflejar el servidor.
      await Promise.all([client.invalidateQueries({ queryKey: ['services'] }), client.invalidateQueries({ queryKey: ['closed'] })])
    }
  }, [api, client])
}

/** Fechas «No hay culto» de uno o varios meses (`YYYY-MM`). */
export function useClosedDates(months: string[]) {
  const api = useApiFetch()
  const results = useQueries({
    queries: months.map((month) => ({
      queryKey: ['closed', month],
      queryFn: () => api<ClosedDate[]>(`/api/closed-dates?month=${month}`),
      retry: false,
    })),
  })
  return {
    closed: results.flatMap((result) => result.data ?? []),
    loading: results.some((result) => result.isPending),
    error: results.find((result) => result.error)?.error ?? null,
  }
}

/** Marca (con motivo opcional) o desmarca una fecha; el servidor decide permisos y reglas. */
export function useClosedDateActions() {
  const api = useApiFetch()
  const client = useQueryClient()
  const mark = useCallback(async (date: string, reason: string) => {
    try {
      await api<ClosedDate>(`/api/closed-dates/${date}`, { method: 'PUT', body: reason ? { reason } : {} })
    } finally {
      await client.invalidateQueries({ queryKey: ['closed'] })
    }
  }, [api, client])
  const unmark = useCallback(async (date: string) => {
    try {
      await api<void>(`/api/closed-dates/${date}`, { method: 'DELETE' })
    } finally {
      await client.invalidateQueries({ queryKey: ['closed'] })
    }
  }, [api, client])
  return { mark, unmark }
}
