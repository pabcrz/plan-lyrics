import { useCallback } from 'react'
import { useAuth } from '@clerk/react'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Church, Service, Status, Slot } from './model'

export class ApiError extends Error {
  constructor(readonly status: number) {
    super(`API ${status}`)
  }
}

/** Petición con el Bearer de Clerk; sin cookies ni caché. La API decide siempre los permisos. */
function useApiFetch() {
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
    if (!response.ok) throw new ApiError(response.status)
    return response.json() as Promise<T>
  }, [getToken])
}

export function useChurch() {
  const api = useApiFetch()
  return useQuery({ queryKey: ['church'], queryFn: () => api<Church>('/api/active-church'), retry: false })
}

export function usePeople(enabled: boolean) {
  const api = useApiFetch()
  return useQuery({ queryKey: ['people'], queryFn: () => api<Array<{ id: string; name: string }>>('/api/people'), enabled, retry: false })
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
      await client.invalidateQueries({ queryKey: ['services'] })
    }
  }, [api, client])
}
