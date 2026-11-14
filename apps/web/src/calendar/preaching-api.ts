import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiFetch } from './api'
import type { Who } from './participations-api'

/** Sección de predicación de un servicio; `notes` solo llega a quien puede leerlas (`canSeeNotes`). */
export type Preaching = { serviceId: string; preacher: Who | null; topic: string; passages: string[]; canSeeNotes: boolean; notes?: string }
export type PreachingBody = { preacherId: string | null; topic: string; passages: string[]; notes: string }
export type PreachingTurn = { serviceId: string; date: string; slot: string; title: string; person: Who }

export function usePreaching(serviceId: string, enabled: boolean) {
  const api = useApiFetch()
  return useQuery({ queryKey: ['preaching', serviceId], queryFn: () => api<Preaching>(`/api/services/${encodeURIComponent(serviceId)}/preaching`), enabled, retry: false })
}

/** Próximas fechas con predicador, para elegir con cuál intercambiar. */
export function usePreachingTurns(enabled: boolean) {
  const api = useApiFetch()
  return useQuery({ queryKey: ['preaching-turns'], queryFn: () => api<PreachingTurn[]>('/api/preaching-turns'), enabled, retry: false })
}

/** Guardar la sección e intercambiar predicadores; éxito o rechazo, lo visible vuelve a pedirse al servidor. */
export function usePreachingActions() {
  const api = useApiFetch()
  const client = useQueryClient()
  const run = useCallback(async <T,>(request: () => Promise<T>) => {
    try {
      return await request()
    } finally {
      await Promise.all([client.invalidateQueries({ queryKey: ['preaching'] }), client.invalidateQueries({ queryKey: ['preaching-turns'] })])
    }
  }, [client])
  return {
    save: useCallback((serviceId: string, body: PreachingBody) => run(() => api<Preaching>(`/api/services/${encodeURIComponent(serviceId)}/preaching`, { method: 'PUT', body })), [api, run]),
    swap: useCallback((first: string, second: string) => run(() => api<{ swapped: string[] }>('/api/preaching/swap', { method: 'POST', body: { first, second } })), [api, run]),
  }
}
