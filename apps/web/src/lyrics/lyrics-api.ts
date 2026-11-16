import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiFetch } from '../calendar/api'
import type { Lyrics, Section } from './lyrics-model'

const key = (songId: string) => ['lyrics', songId]
const path = (songId: string) => `/api/songs/${encodeURIComponent(songId)}/lyrics`

/**
 * La letra de una canción. Al editar (`stable`) no se vuelve a pedir sola al volver a la ventana: lo que alguien
 * escribe no se reemplaza a escondidas; el servidor rechaza con 409 un guardado sobre una versión vieja.
 */
export function useLyrics(songId: string, stable = false) {
  const api = useApiFetch()
  return useQuery({
    queryKey: key(songId), queryFn: () => api<Lyrics>(path(songId)), retry: false,
    ...(stable ? { refetchOnWindowFocus: false, refetchOnReconnect: false } : {}),
  })
}

export type LyricsBody = { version: number; published: boolean; sections: Section[] }

/** Reemplazo completo de la letra; la respuesta (con la versión nueva) reemplaza la caché. */
export function useSaveLyrics(songId: string) {
  const api = useApiFetch()
  const client = useQueryClient()
  return useCallback(async (body: LyricsBody) => {
    const saved = await api<Lyrics>(path(songId), { method: 'PUT', body })
    client.setQueryData(key(songId), saved)
    return saved
  }, [api, client, songId])
}

/** Vuelve a pedir la letra al servidor (tras un conflicto de versión). */
export function useReloadLyrics(songId: string) {
  const client = useQueryClient()
  return useCallback(() => client.refetchQueries({ queryKey: key(songId) }), [client, songId])
}
