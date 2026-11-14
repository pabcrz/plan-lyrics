import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiFetch } from './api'

export type Who = { id: string; name: string }
export type Mode = 'BY_DAY' | 'SHARED'
export type Sequence = { weekday: number | null; people: Who[] }
/** Configuración de un rol tal como la lee el servidor, con la vista previa de los próximos servicios. */
export type RoleParticipation = {
  roleId: string; name: string; habitual: Who[]
  rotation: { enabled: boolean; mode: Mode; startsOn: string | null; sequences: Sequence[] }
  preview: { date: string; slot: string; rotation: Who | null; habitual: Who[] }[]
}
export type ParticipationBody = {
  habitualIds: string[]
  rotation: { enabled: boolean; mode: Mode; startsOn: string | null; sequences: { weekday: number | null; personIds: string[] }[] }
}

/** Lo que se envía al guardar: la configuración completa del rol, solo con ids. */
export const toBody = (role: RoleParticipation): ParticipationBody => ({
  habitualIds: role.habitual.map((person) => person.id),
  rotation: { ...role.rotation, sequences: role.rotation.sequences.map((sequence) => ({ weekday: sequence.weekday, personIds: sequence.people.map((person) => person.id) })) },
})

export type Pending = 'COMBINATION' | 'ROLE_REMOVED'
export type Assignment = { id: string; roleId: string | null; roleName: string; source: 'HABITUAL' | 'ROTATION' | 'MANUAL'; pending: Pending | null; person: Who | null; proposed: Who | null }
export type ServiceAssignments = { service: { id: string; title: string; date: string; slot: string; director: Who | null }; assignments: Assignment[] }
export type Turn = { id: string; serviceId: string; date: string; slot: string; person: Who }

export function useParticipations() {
  const api = useApiFetch()
  return useQuery({ queryKey: ['participations'], queryFn: () => api<RoleParticipation[]>('/api/role-participations'), retry: false })
}

/** Guarda la configuración completa de un rol; la respuesta del servidor reemplaza al rol en caché. */
export function useSaveParticipation() {
  const api = useApiFetch()
  const client = useQueryClient()
  return useCallback(async (roleId: string, body: ParticipationBody) => {
    const saved = await api<RoleParticipation>(`/api/role-participations/${encodeURIComponent(roleId)}`, { method: 'PUT', body })
    client.setQueryData<RoleParticipation[]>(['participations'], (list) => list?.map((role) => (role.roleId === roleId ? saved : role)))
    return saved
  }, [api, client])
}

export function useAssignments(serviceId: string) {
  const api = useApiFetch()
  return useQuery({ queryKey: ['assignments', serviceId], queryFn: () => api<ServiceAssignments>(`/api/services/${encodeURIComponent(serviceId)}/assignments`), retry: false })
}

/** Turnos próximos de un rol con persona, para elegir con quién intercambiar. */
export function useRoleTurns(roleId: string | null) {
  const api = useApiFetch()
  return useQuery({ queryKey: ['role-turns', roleId], queryFn: () => api<Turn[]>(`/api/role-turns?roleId=${encodeURIComponent(roleId ?? '')}`), enabled: roleId !== null, retry: false })
}

/** Cambios en un servicio: reemplazar, agregar, quitar e intercambiar. El servidor decide permisos y combinaciones. */
export function useAssignmentActions() {
  const api = useApiFetch()
  const client = useQueryClient()
  const run = useCallback(async <T,>(request: () => Promise<T>) => {
    try {
      return await request()
    } finally {
      // Éxito o rechazo: lo visible debe reflejar al servidor.
      await Promise.all([client.invalidateQueries({ queryKey: ['assignments'] }), client.invalidateQueries({ queryKey: ['role-turns'] })])
    }
  }, [client])
  return {
    replace: useCallback((id: string, personId: string) => run(() => api<Assignment>(`/api/assignments/${encodeURIComponent(id)}`, { method: 'PUT', body: { personId } })), [api, run]),
    add: useCallback((serviceId: string, roleId: string, personId: string) => run(() => api<Assignment>(`/api/services/${encodeURIComponent(serviceId)}/assignments`, { method: 'POST', body: { roleId, personId } })), [api, run]),
    remove: useCallback((id: string) => run(() => api<void>(`/api/assignments/${encodeURIComponent(id)}`, { method: 'DELETE' })), [api, run]),
    swap: useCallback((first: string, second: string) => run(() => api<{ swapped: string[] }>('/api/assignments/swap', { method: 'POST', body: { first, second } })), [api, run]),
  }
}
