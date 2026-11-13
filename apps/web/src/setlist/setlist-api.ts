import { useCallback, useRef } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiFetch } from '../calendar/api'
import type { Slot, Status } from '../calendar/model'

export type Song = { id: string; title: string; author: string }
export type Entry = { id: string; kind: 'SONG' | 'MOMENT'; song: Song | null; moment: string | null; key: string | null; link: string | null }
export type Setlist = {
  service: { id: string; title: string; date: string; slot: Slot; time: string | null; status: Status }
  /** La versión que debe acompañar a un reordenamiento; cualquier cambio de la lista la incrementa. */
  version: number
  canEdit: boolean
  /** Solo quien edita la biblioteca puede dar de alta una canción nueva. */
  canCreateSongs: boolean
  entries: Entry[]
}

export const entryLabel = (entry: Entry) => entry.song?.title ?? entry.moment ?? ''

export const tonalities = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const

/** Origen de un enlace de referencia manual; el servidor vuelve a validarlo. */
export function referenceOrigin(value: string): 'YouTube' | 'Spotify' | null {
  if (value.length > 500) return null
  try {
    const url = new URL(value)
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password) return null
    const within = (host: string) => url.hostname === host || url.hostname.endsWith(`.${host}`)
    if (within('youtube.com') || within('youtu.be')) return 'YouTube'
    if (within('spotify.com')) return 'Spotify'
    return null
  } catch {
    return null
  }
}

const key = (serviceId: string) => ['setlist', serviceId]

export function useSetlist(serviceId: string) {
  const api = useApiFetch()
  return useQuery({ queryKey: key(serviceId), queryFn: () => api<Setlist>(`/api/services/${encodeURIComponent(serviceId)}/setlist`), retry: false })
}

/** Búsqueda en la biblioteca compartida (sin distinguir mayúsculas ni acentos); conserva la lista anterior mientras llega la nueva. */
export function useSongs(query: string, enabled: boolean) {
  const api = useApiFetch()
  return useQuery({
    queryKey: ['songs', query], queryFn: () => api<Song[]>(`/api/songs?q=${encodeURIComponent(query)}`),
    enabled, retry: false, placeholderData: keepPreviousData,
  })
}

export type NewEntry = { songId: string; key?: string | null; link?: string | null; position?: number } | { moment: string; position?: number }

/**
 * Cambios del setlist. El servidor decide permisos y orden; cada respuesta trae la lista completa y
 * reemplaza la caché. Los reordenamientos se aplican al instante y se envían de uno en uno, cada uno
 * con la versión que dejó el anterior: si el servidor rechaza uno, se recarga la lista real.
 */
export function useSetlistActions(serviceId: string) {
  const api = useApiFetch()
  const client = useQueryClient()
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const base = `/api/services/${encodeURIComponent(serviceId)}/setlist`
  const accept = useCallback((saved: Setlist) => { client.setQueryData(key(serviceId), saved); return saved }, [client, serviceId])
  const reload = useCallback(() => client.invalidateQueries({ queryKey: key(serviceId) }), [client, serviceId])

  const add = useCallback((entry: NewEntry) => api<Setlist>(`${base}/entries`, { method: 'POST', body: entry }).then(accept), [api, base, accept])
  const edit = useCallback((entryId: string, patch: { key?: string | null; link?: string | null; moment?: string }) =>
    api<Setlist>(`${base}/entries/${encodeURIComponent(entryId)}`, { method: 'PATCH', body: patch }).then(accept), [api, base, accept])
  const remove = useCallback((entryId: string) => api<Setlist>(`${base}/entries/${encodeURIComponent(entryId)}`, { method: 'DELETE' }).then(accept), [api, base, accept])
  const createSong = useCallback(async (song: { title: string; author: string }) => {
    const created = await api<Song>('/api/songs', { method: 'POST', body: song })
    await client.invalidateQueries({ queryKey: ['songs'] })
    return created
  }, [api, client])

  const reorder = useCallback((entryIds: string[]) => {
    const current = client.getQueryData<Setlist>(key(serviceId))
    if (!current) return Promise.resolve()
    const byId = new Map(current.entries.map((entry) => [entry.id, entry]))
    client.setQueryData<Setlist>(key(serviceId), { ...current, entries: entryIds.flatMap((id) => byId.get(id) ?? []) })
    const send = async () => {
      const latest = client.getQueryData<Setlist>(key(serviceId))
      if (!latest) return
      try {
        accept(await api<Setlist>(`${base}/order`, { method: 'PUT', body: { version: latest.version, entryIds } }))
      } catch (error) {
        await reload()
        throw error
      }
    }
    // Cada envío espera al anterior para usar la versión que este dejó; un fallo no detiene los siguientes.
    const next = queue.current.then(send, send)
    queue.current = next.catch(() => undefined)
    return next
  }, [accept, api, base, client, reload, serviceId])

  return { add, edit, remove, reorder, createSong, reload }
}
