import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiFetch } from '../calendar/api'
import type { NewLink, ShareLink } from './share-model'

export function useShareLinks(enabled: boolean) {
  const api = useApiFetch()
  return useQuery({ queryKey: ['share-links'], queryFn: () => api<ShareLink[]>('/api/share-links'), enabled, retry: false })
}

/** Crear, revocar y reactivar; el servidor decide permisos, vigencia y reglas, y la lista se vuelve a leer siempre. */
export function useShareLinkActions() {
  const api = useApiFetch()
  const client = useQueryClient()
  const refresh = useCallback(() => client.invalidateQueries({ queryKey: ['share-links'] }), [client])
  const create = useCallback(async (link: NewLink) => {
    try {
      return await api<ShareLink>('/api/share-links', { method: 'POST', body: link })
    } finally { await refresh() }
  }, [api, refresh])
  const revoke = useCallback(async (id: string) => {
    try {
      return await api<ShareLink>(`/api/share-links/${encodeURIComponent(id)}/revoke`, { method: 'POST' })
    } finally { await refresh() }
  }, [api, refresh])
  const reactivate = useCallback(async (id: string) => {
    try {
      return await api<ShareLink>(`/api/share-links/${encodeURIComponent(id)}/reactivate`, { method: 'POST' })
    } finally { await refresh() }
  }, [api, refresh])
  return { create, revoke, reactivate }
}

/** Lo que muestra la vista pública: solo lo que la versión y los bloques del enlace incluyen. */
export type PublicSong = { kind: 'SONG'; title: string; author: string; key?: string | null }
export type PublicMoment = { kind: 'MOMENT'; name: string | null }
export type PublicService = {
  date: string; slot: 'SINGLE' | 'MORNING' | 'AFTERNOON'; time?: string | null; director?: string
  setlist?: Array<PublicSong | PublicMoment>
  preaching?: { topic: string; passages: string[]; preacher?: string; notes?: string } | null
}
export type PublicView = {
  version: 'PRAISE' | 'PREACHING' | 'FULL'; church: string; activeUntil: string
  blocks: { keys: boolean; notes: boolean; people: boolean }
  services: PublicService[]; closedDates: Array<{ date: string; reason: string | null }>
}

export class PublicLinkError extends Error {
  constructor(readonly status: number) { super(`Public link ${status}`) }
}

/** Sin sesión, sin cookies y sin caché: quien abre el enlace no tiene cuenta. */
export async function fetchPublicLink(token: string, signal?: AbortSignal): Promise<PublicView> {
  const response = await fetch(`/api/public/links/${encodeURIComponent(token)}`, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal })
  if (!response.ok) throw new PublicLinkError(response.status)
  return (await response.json()) as PublicView
}
