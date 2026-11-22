import { useCallback } from 'react'
import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiFetch } from '../calendar/api'
import type { Song } from '../setlist/setlist-api'

/** Quién puede crear canciones en la biblioteca compartida; el servidor vuelve a comprobarlo al crear. */
export function useLibraryAccess() {
  const api = useApiFetch()
  return useQuery({ queryKey: ['songs', 'access'], queryFn: () => api<{ canCreate: boolean }>('/api/songs/access'), retry: false })
}

export function useCreateSong() {
  const api = useApiFetch()
  const client = useQueryClient()
  return useCallback(async (song: { title: string; author: string }) => {
    const created = await api<Song>('/api/songs', { method: 'POST', body: song })
    await client.invalidateQueries({ queryKey: ['songs'] })
    return created
  }, [api, client])
}

export const lyricsPath = (songId: string) => `/canciones/${encodeURIComponent(songId)}/letra`

export function useUpdateSong() {
  const api = useApiFetch()
  const client = useQueryClient()
  return useCallback(async (songId: string, song: { title: string; author: string }) => {
    const saved = await api<Song>(`/api/songs/${encodeURIComponent(songId)}`, { method: 'PATCH', body: song })
    await client.invalidateQueries({ queryKey: ['songs'] })
    return saved
  }, [api, client])
}

export function useDeleteSong() {
  const api = useApiFetch()
  const client = useQueryClient()
  return useCallback(async (songId: string) => {
    await api<void>(`/api/songs/${encodeURIComponent(songId)}`, { method: 'DELETE' })
    await client.invalidateQueries({ queryKey: ['songs'] })
  }, [api, client])
}

export type LibraryFilter = 'all' | 'no-lyrics' | 'no-chords'
/** Canciones por página; una página llena indica que puede haber más. */
export const PAGE = 50

/** La biblioteca por páginas, con búsqueda y filtro de lo que falta; conserva la lista anterior mientras llega la nueva. */
export function useLibrary(term: string, filter: LibraryFilter) {
  const api = useApiFetch()
  const query = useInfiniteQuery({
    queryKey: ['songs', 'library', term, filter],
    queryFn: ({ pageParam }) => api<Song[]>(`/api/songs?q=${encodeURIComponent(term)}${filter === 'all' ? '' : `&filter=${filter}`}&offset=${pageParam}`),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length === PAGE ? all.length * PAGE : undefined),
    retry: false,
    placeholderData: keepPreviousData,
  })
  return { ...query, rows: query.data?.pages.flat() ?? [] }
}
