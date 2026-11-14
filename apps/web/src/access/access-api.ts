import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiFetch } from '../calendar/api'

export type Role = 'ADMIN' | 'EDITOR' | 'MEMBER'
/** Miembro de la iglesia activa. `protected` es la cuenta del superadministrador: no se cambia desde una iglesia. */
export type Member = { userId: string; role: Role; self: boolean; protected: boolean; person: { id: string; name: string } | null }
/** Persona del directorio con cuenta y sin membresía: la única que se puede agregar. */
export type Candidate = { personId: string; name: string }
export type Members = { members: Member[]; candidates: Candidate[] }

export type Account = {
  id: string; email: string | null; accountManager: boolean; libraryEditor: boolean; owner: boolean; person: { id: string; name: string } | null
}
export type Accounts = { viewer: { owner: boolean }; accounts: Account[]; people: Array<{ id: string; name: string }> }
export type Access = { owner: boolean; accountManager: boolean }

/** Lo que puedes hacer con las cuentas, según el servidor; solo decide qué ofrecer, la API vuelve a comprobarlo. */
export function useAccess() {
  const api = useApiFetch()
  return useQuery({ queryKey: ['access'], queryFn: () => api<Access>('/api/access'), retry: false })
}

export function useMembers(enabled: boolean) {
  const api = useApiFetch()
  return useQuery({ queryKey: ['members'], queryFn: () => api<Members>('/api/members'), enabled, retry: false })
}

/** Altas, cambios de rol y bajas de la iglesia de la sesión: la iglesia nunca viaja en la petición. */
export function useMemberActions() {
  const api = useApiFetch()
  const client = useQueryClient()
  const run = useCallback(async <T,>(request: () => Promise<T>) => {
    try {
      return await request()
    } finally {
      // También cambian quién puede agregarse y lo que ve esa persona, así que se vuelve a leer todo.
      await Promise.all([client.invalidateQueries({ queryKey: ['members'] }), client.invalidateQueries({ queryKey: ['church'] })])
    }
  }, [client])
  return {
    grant: useCallback((personId: string, role: Role) => run(() => api<Member>('/api/members', { method: 'POST', body: { personId, role } })), [api, run]),
    changeRole: useCallback((userId: string, role: Role) => run(() => api<Member>(`/api/members/${encodeURIComponent(userId)}`, { method: 'PATCH', body: { role } })), [api, run]),
    remove: useCallback((userId: string) => run(() => api<void>(`/api/members/${encodeURIComponent(userId)}`, { method: 'DELETE' })), [api, run]),
  }
}

export function useAccounts(enabled: boolean) {
  const api = useApiFetch()
  return useQuery({ queryKey: ['accounts'], queryFn: () => api<Accounts>('/api/accounts'), enabled, retry: false })
}

/** Cuentas: invitar, vincular personas y capacidades globales. Solo el superadministrador o un gestor llegan aquí. */
export function useAccountActions() {
  const api = useApiFetch()
  const client = useQueryClient()
  const run = useCallback(async <T,>(request: () => Promise<T>) => {
    try {
      return await request()
    } finally {
      await Promise.all([client.invalidateQueries({ queryKey: ['accounts'] }), client.invalidateQueries({ queryKey: ['people'] })])
    }
  }, [client])
  const account = (id: string) => `/api/accounts/${encodeURIComponent(id)}`
  return {
    invite: useCallback((email: string) => run(() => api<Account>('/api/accounts', { method: 'POST', body: { email } })), [api, run]),
    link: useCallback((id: string, personId: string) => run(() => api<Account>(`${account(id)}/person`, { method: 'PUT', body: { personId } })), [api, run]),
    unlink: useCallback((id: string) => run(() => api<void>(`${account(id)}/person`, { method: 'DELETE' })), [api, run]),
    setAccountManager: useCallback((id: string, enabled: boolean) => run(() => api<{ id: string; accountManager: boolean }>(`/api/users/${encodeURIComponent(id)}/account-manager`, { method: 'PUT', body: { enabled } })), [api, run]),
    setLibraryEditor: useCallback((id: string, enabled: boolean) => run(() => api<Account>(`${account(id)}/library-editor`, { method: 'PUT', body: { enabled } })), [api, run]),
  }
}
