import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
