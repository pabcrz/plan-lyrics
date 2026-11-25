import { clearActiveChurch, getActiveChurch, setActiveChurch } from './active-church'
import { homeAll } from './home-filter'
import { useCallback } from 'react'
import { useAuth } from '@clerk/react'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Church, ChurchSettings, ClosedDate, Person, PersonDetail, Service, Status, Slot } from './model'
import { apiUrl } from '../api-url'

export class ApiError extends Error {
  constructor(readonly status: number, readonly code = '', readonly issues: string[] = [], readonly existing?: { id: string; name: string }, readonly services?: number, readonly affected: Array<{ position: number; kind: string; label: string | null }> = []) {
    super(`API ${status}`)
  }
}

/** Secciones que la API nombra al rechazar un guardado que perdería acordes (`chords_would_be_lost`). */
function affectedSections(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.flatMap((item: { position?: unknown; kind?: unknown; label?: unknown }) =>
    typeof item?.position === 'number' && typeof item.kind === 'string' ? [{ position: item.position, kind: item.kind, label: typeof item.label === 'string' ? item.label : null }] : [])
}

/** Petición con el Bearer de Clerk; sin cookies ni caché. La API decide siempre los permisos. */
export function useApiFetch() {
  const { getToken } = useAuth()
  return useCallback(async <T,>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> => {
    const token = await getToken()
    if (!token) throw new ApiError(401)
    const response = await fetch(apiUrl(path), {
      method: init.method ?? 'GET',
      headers: { Authorization: `Bearer ${token}`, ...(getActiveChurch() ? { 'X-Church-Id': getActiveChurch() as string } : {}), ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
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
        typeof (body as { services?: unknown } | null)?.services === 'number' ? (body as { services: number }).services : undefined,
        affectedSections((body as { sections?: unknown } | null)?.sections),
      )
    }
    return (response.status === 204 ? undefined : await response.json()) as T
  }, [getToken])
}

export function useChurch() {
  const api = useApiFetch()
  return useQuery({
    queryKey: ['church'], retry: false,
    queryFn: async () => {
      try { return await api<Church>('/api/active-church') } catch (caught) {
        // La iglesia guardada ya no es suya (le quitaron el acceso): se descarta y se vuelve a resolver sin ella.
        if (caught instanceof ApiError && caught.status === 404 && getActiveChurch()) { clearActiveChurch(); return api<Church>('/api/active-church') }
        throw caught
      }
    },
  })
}

/** `role: null` solo para el superadministrador: iglesias a las que no pertenece (se abren en modo soporte). */
export type AgendaService = Service & { churchId: string; churchName: string }

/** Próximos servicios de todas las iglesias de la cuenta; solo se pide con dos o más. */
export function useAgenda(enabled: boolean) {
  const api = useApiFetch()
  return useQuery({ queryKey: ['agenda'], queryFn: () => api<AgendaService[]>('/api/me/agenda'), retry: false, enabled })
}

export type MyChurch = { id: string; name: string; role: 'ADMIN' | 'EDITOR' | 'MEMBER' | null }

/** Iglesias a las que pertenece la cuenta, para elegir la activa. */
export function useMyChurches() {
  const api = useApiFetch()
  return useQuery({ queryKey: ['my-churches'], queryFn: () => api<MyChurch[]>('/api/me/churches'), retry: false, staleTime: 60_000 })
}

/** Cambia la iglesia activa de este dispositivo y vuelve a pedir todo lo demás con ella. */
export function useSwitchChurch() {
  const client = useQueryClient()
  return useCallback((id: string) => {
    setActiveChurch(id)
    // Elegir una iglesia (desde el menú o el filtro del inicio) deja de ser la vista «Todas».
    homeAll.set(false)
    void client.resetQueries({ predicate: (query) => query.queryKey[0] !== 'my-churches' })
  }, [client])
}

/** Guarda los ajustes; la respuesta del servidor reemplaza la iglesia en caché para calendario y formulario. */
export function useSaveChurch() {
  const api = useApiFetch()
  const client = useQueryClient()
  return useCallback(async (settings: ChurchSettings & { congregationShowsPreacher?: boolean }) => {
    const saved = await api<Church>('/api/active-church', { method: 'PUT', body: settings })
    client.setQueryData(['church'], saved)
    return saved
  }, [api, client])
}

/** Directorio de la iglesia; con `role` solo quienes pueden dirigir o predicar. */
export function usePeople(enabled: boolean, role?: 'direct' | 'preach' | 'play') {
  const api = useApiFetch()
  return useQuery({ queryKey: role ? ['people', role] : ['people'], queryFn: () => api<Person[]>(`/api/people${role ? `?role=${role}` : ''}`), enabled, retry: false })
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
  const create = useCallback(async (person: { name: string; phone?: string; email?: string; canDirect?: boolean; canPreach?: boolean }) => {
    const created = await api<Omit<PersonDetail, 'sharedWithOtherChurches' | 'upcomingServices'>>('/api/people', { method: 'POST', body: person })
    await refresh()
    return created
  }, [api, refresh])
  const update = useCallback(async (id: string, patch: { name?: string; phone?: string | null; email?: string | null; canDirect?: boolean; canPreach?: boolean }) => {
    const saved = await api<Omit<PersonDetail, 'sharedWithOtherChurches' | 'upcomingServices'>>(`/api/people/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch })
    await refresh()
    return saved
  }, [api, refresh])
  const setRoles = useCallback(async (id: string, roleIds: string[]) => {
    const saved = await api<{ roleIds: string[] }>(`/api/people/${encodeURIComponent(id)}/roles`, { method: 'PUT', body: { roleIds } })
    await Promise.all([refresh(), client.invalidateQueries({ queryKey: ['participations'] })])
    return saved
  }, [api, client, refresh])
  const remove = useCallback(async (id: string) => {
    await api<void>(`/api/people/${encodeURIComponent(id)}`, { method: 'DELETE' })
    await refresh()
  }, [api, refresh])
  return { create, update, setRoles, remove }
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

/** Al menos `directorId` o `preacher`; el servidor lo vuelve a exigir. */
export type NewService = {
  title: string; date: string; status: Extract<Status, 'DRAFT' | 'PUBLISHED'>; directorId?: string; preacher?: { personId: string; topic?: string }
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

export type ServicePatch = { title?: string; date?: string; slot?: 'MORNING' | 'AFTERNOON'; time?: string | null; status?: Status; directorId?: string }

/** Corregir un servicio; el servidor decide permisos, fechas y combinaciones de roles, y todo lo que lo muestra se vuelve a leer. */
export function useUpdateService() {
  const api = useApiFetch()
  const client = useQueryClient()
  return useCallback(async (id: string, patch: ServicePatch) => {
    try {
      return await api<Service>(`/api/services/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch })
    } finally {
      await Promise.all(['services', 'setlist', 'assignments', 'closed'].map((key) => client.invalidateQueries({ queryKey: [key] })))
    }
  }, [api, client])
}

/** Elimina un servicio con su lista de canciones, participaciones y predicación; las personas y canciones se conservan. */
export function useDeleteService() {
  const api = useApiFetch()
  const client = useQueryClient()
  return useCallback(async (id: string) => {
    await api<void>(`/api/services/${encodeURIComponent(id)}`, { method: 'DELETE' })
    // El servicio ya no existe: se descartan sus lecturas y se vuelve a leer lo que lo listaba.
    client.removeQueries({ queryKey: ['setlist'] })
    await Promise.all(['services', 'assignments', 'closed', 'preaching', 'preaching-turns', 'participations'].map((key) => client.invalidateQueries({ queryKey: [key] })))
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
