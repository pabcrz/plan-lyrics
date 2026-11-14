import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiFetch } from './api'
import type { Period } from './batch'
import type { Service, Slot } from './model'

/** Fechas del período (libres y bloqueadas) y lo que dejó el lote anterior; el servidor decide ambos. */
export function useBatchPeriod(month: string, weekdays: ReadonlyArray<number>, enabled: boolean) {
  const api = useApiFetch()
  const days = [...weekdays].sort((a, b) => a - b).join(',')
  return useQuery({
    queryKey: ['batch-period', month, days],
    queryFn: () => api<Period>(`/api/service-batches/period?month=${month}&weekdays=${days}`),
    enabled: enabled && weekdays.length > 0,
    retry: false,
  })
}

export type NewBatch = {
  month: string
  directorIds: string[]
  entries: Array<{ date: string; title: string; time: string; directorId: string; preacherId?: string; slot?: Exclude<Slot, 'SINGLE'> }>
}

/** Crea el lote completo o nada; éxito o rechazo, las listas visibles se vuelven a pedir al servidor. */
export function useCreateBatch() {
  const api = useApiFetch()
  const client = useQueryClient()
  return useCallback(async (batch: NewBatch) => {
    try {
      return await api<{ services: Service[] }>('/api/service-batches', { method: 'POST', body: batch })
    } finally {
      await Promise.all(['services', 'closed', 'batch-period'].map((key) => client.invalidateQueries({ queryKey: [key] })))
    }
  }, [api, client])
}
