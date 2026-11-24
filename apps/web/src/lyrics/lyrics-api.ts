import { useCallback } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiFetch } from '../calendar/api'
import type { Lyrics, Section } from './lyrics-model'

export const key = (songId: string) => ['lyrics', songId]
export const path = (songId: string) => `/api/songs/${encodeURIComponent(songId)}/lyrics`

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

/** Una sección al guardar: con acordes basta `chordPro` (el texto sale de él); sin ellos va el `text` y `chordPro: null`. */
export type SectionBody = Omit<Section, 'text'> & { text?: string }
export type LyricsBody = { version: number; published: boolean; key?: string | null; sections: SectionBody[] }

/** Cómo se pide la letra movida de tono: a una tonalidad (del mismo modo que la guardada) o por medios tonos. Solo se calcula, no se guarda. */
export type Transposition = { toKey: string } | { semitones: number }

/** La letra con los acordes transpuestos solo para esta lectura; sin `transposition` no pide nada. */
export function useTransposedLyrics(songId: string, transposition: Transposition | null) {
  const api = useApiFetch()
  const query = transposition === null ? '' : 'toKey' in transposition ? `toKey=${encodeURIComponent(transposition.toKey)}` : `semitones=${transposition.semitones}`
  return useQuery({
    queryKey: [...key(songId), 'view', query], queryFn: () => api<Lyrics>(`${path(songId)}?${query}`),
    enabled: transposition !== null, retry: false, placeholderData: keepPreviousData,
  })
}

/** Reemplazo completo de la letra; la respuesta (con la versión nueva) reemplaza la caché. */
export function useSaveLyrics(songId: string) {
  const api = useApiFetch()
  const client = useQueryClient()
  return useCallback(async (body: LyricsBody) => {
    const saved = await api<Lyrics>(path(songId), { method: 'PUT', body })
    client.setQueryData(key(songId), saved)
    // Las lecturas transpuestas se hicieron sobre la letra anterior.
    client.removeQueries({ queryKey: [...key(songId), 'view'] })
    return saved
  }, [api, client, songId])
}

/** Vuelve a pedir la letra al servidor (tras un conflicto de versión). */
export function useReloadLyrics(songId: string) {
  const client = useQueryClient()
  return useCallback(() => client.refetchQueries({ queryKey: key(songId) }), [client, songId])
}
