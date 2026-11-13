import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiFetch } from './api'

/** Rol del catálogo musical de la iglesia (no incluye «Dirigir», que es un rol fijo del servicio). */
export type MusicalRole = { id: string; name: string }
/** Clave del rol fijo «Dirigir» dentro de una restricción. */
export const DIRECTOR_KEY = 'DIRIGIR'
/** Par de roles (ids del catálogo o `DIRIGIR`) que una misma persona no puede tener a la vez en un servicio. */
export type RoleRestriction = { id: string; first: string; second: string }

export function useRoles() {
  const api = useApiFetch()
  return useQuery({ queryKey: ['roles'], queryFn: () => api<MusicalRole[]>('/api/roles'), retry: false })
}

export function useRoleRestrictions() {
  const api = useApiFetch()
  return useQuery({ queryKey: ['role-restrictions'], queryFn: () => api<RoleRestriction[]>('/api/role-restrictions'), retry: false })
}

/** Altas y bajas del catálogo y de las restricciones; el servidor decide permisos, duplicados e iglesia. */
export function useRoleActions() {
  const api = useApiFetch()
  const client = useQueryClient()
  // Quitar un rol también quita sus restricciones, así que ambas listas se vuelven a leer siempre.
  const refresh = useCallback(() => Promise.all([client.invalidateQueries({ queryKey: ['roles'] }), client.invalidateQueries({ queryKey: ['role-restrictions'] })]), [client])
  const run = useCallback(async <T,>(request: () => Promise<T>) => {
    try {
      return await request()
    } finally {
      await refresh()
    }
  }, [refresh])
  return {
    createRole: useCallback((name: string) => run(() => api<MusicalRole>('/api/roles', { method: 'POST', body: { name } })), [api, run]),
    removeRole: useCallback((id: string) => run(() => api<void>(`/api/roles/${encodeURIComponent(id)}`, { method: 'DELETE' })), [api, run]),
    addRestriction: useCallback((first: string, second: string) => run(() => api<RoleRestriction>('/api/role-restrictions', { method: 'POST', body: { first, second } })), [api, run]),
    removeRestriction: useCallback((id: string) => run(() => api<void>(`/api/role-restrictions/${encodeURIComponent(id)}`, { method: 'DELETE' })), [api, run]),
  }
}
