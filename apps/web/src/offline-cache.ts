import type { QueryClient } from '@tanstack/react-query'
import { getActiveChurch } from './calendar/active-church'
import { ApiError } from './calendar/api'
import { semitonesBetween } from './lyrics/chords'
import { key as lyricsKey, path as lyricsPath, transpositionQuery } from './lyrics/lyrics-api'
import type { Lyrics } from './lyrics/lyrics-model'
import { key as setlistKey } from './setlist/setlist-api'
import type { Setlist } from './setlist/setlist-api'

/**
 * Lo último que la persona vio, guardado en el dispositivo para leerlo sin conexión (solo lectura).
 * Se restaura solo si es de la misma iglesia activa; la cuenta se comprueba al iniciar sesión y se borra al cerrarla.
 */
const KEY = 'plan-lyrics.cache'
const LIMIT = 2_500_000 // caracteres: localStorage ronda los 5 MB; pasado esto se conserva lo guardado antes
type Snapshot = { v: 1; owner: string | null; church: string | null; queries: Array<{ key: readonly unknown[]; data: unknown; at?: number }> }

const read = (): Snapshot | null => {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Snapshot | null
    return parsed?.v === 1 && Array.isArray(parsed.queries) ? parsed : null
  } catch { return null }
}
/** Sin esto la aplicación no abre sin conexión: nunca se recorta. */
const ESSENTIAL: ReadonlyArray<unknown> = ['church', 'my-churches', 'agenda']
let restored = false
let owner: string | null = null

/** Hay una iglesia guardada (solo se guarda con sesión): la aplicación puede abrir sin esperar a Clerk. */
export const hasOfflineData = () => restored

/** Devuelve la caché guardada a la consulta, antes de pintar nada. */
export function restoreCache(client: QueryClient) {
  const snapshot = read()
  if (!snapshot || snapshot.church !== (getActiveChurch() ?? null)) return
  owner = snapshot.owner
  for (const query of snapshot.queries) client.setQueryData(query.key, query.data, { updatedAt: query.at })
  restored = snapshot.queries.some((query) => query.key[0] === 'church')
}

/** Guarda la caché cuando cambia (con una pausa para no escribir en cada consulta). */
export function persistCache(client: QueryClient) {
  let timer: ReturnType<typeof setTimeout> | undefined
  client.getQueryCache().subscribe((event) => {
    // Lo que el servidor ya niega o ya no existe no se sigue mostrando ni se conserva.
    if (event.type === 'updated' && event.action.type === 'error') {
      const { error } = event.action
      if (error instanceof ApiError && (error.status === 403 || error.status === 404) && event.query.state.data !== undefined) event.query.setState({ data: undefined })
    }
    clearTimeout(timer)
    timer = setTimeout(() => {
      let size = 0
      // Cuenta lo que tiene datos aunque el último intento fallara (sin red). Si no cabe todo, se descarta lo más viejo.
      const queries = client.getQueryCache().getAll().filter((query) => query.state.data !== undefined)
        .map((query) => ({ key: query.queryKey, data: query.state.data, at: query.state.dataUpdatedAt }))
        .sort((a, b) => Number(ESSENTIAL.includes(b.key[0])) - Number(ESSENTIAL.includes(a.key[0])) || b.at - a.at)
        .filter((query) => {
          const next = size + JSON.stringify(query).length + 1
          if (next > LIMIT) return false
          size = next
          return true
        })
      if (queries.length === 0) return
      const text = JSON.stringify({ v: 1, owner, church: getActiveChurch() ?? null, queries } satisfies Snapshot)
      try { localStorage.setItem(KEY, text) } catch { /* sin espacio: queda lo guardado antes */ }
    }, 1500)
  })
}

/** Al iniciar sesión: si la caché es de otra cuenta se descarta; si no, se reclama para esta. */
export function claimCache(client: QueryClient, userId: string) {
  // `resetQueries` y no `clear`: las pantallas ya abiertas con lo guardado vuelven a pedirlo.
  if (owner !== null && owner !== userId) { void client.resetQueries(); forgetCache() }
  owner = userId
}

/** Al cerrar sesión: nada de la cuenta se queda en el dispositivo. */
export function forgetCache() {
  try { localStorage.removeItem(KEY) } catch { /* ídem */ }
  restored = false
  owner = null
}

/** Cada petición cuenta en el consumo del servidor: pocos cultos y sin repetir lo guardado hace poco. */
const MAX_SAVED = 3
const FRESH = 6 * 3_600_000

/**
 * Deja listos para leer sin conexión los próximos cultos: setlist, letras (también en el tono del servicio), participaciones y predicación.
 * Con `force` (a petición de la persona) se vuelve a pedir aunque sea reciente. Devuelve `false` si faltó algún setlist o alguna letra.
 */
export async function saveUpcoming(client: QueryClient, api: <T>(path: string, init?: { church?: string }) => Promise<T>, services: ReadonlyArray<{ id: string; church?: string; preaching?: boolean }>, { force = false } = {}) {
  const staleTime = force ? 0 : FRESH
  let complete = true
  const missed = () => { complete = false; return null }
  for (const { id, church, preaching } of services.slice(0, MAX_SAVED)) {
    const setlist = await client.fetchQuery({ queryKey: setlistKey(id), queryFn: () => api<Setlist>(`/api/services/${encodeURIComponent(id)}/setlist`, { church }), staleTime }).catch(missed)
    const base = `/api/services/${encodeURIComponent(id)}`
    await client.prefetchQuery({ queryKey: ['assignments', id], queryFn: () => api(`${base}/assignments`, { church }), staleTime })
    if (preaching) await client.prefetchQuery({ queryKey: ['preaching', id], queryFn: () => api(`${base}/preaching`, { church }), staleTime })
    for (const entry of setlist?.entries ?? []) {
      const song = entry.song?.id
      if (!song) continue
      await client.fetchQuery({ queryKey: lyricsKey(song), queryFn: () => api<Lyrics>(lyricsPath(song), { church }), staleTime }).catch(missed)
      const lyrics = client.getQueryData<Lyrics>(lyricsKey(song))
      if (entry.key && lyrics?.key && semitonesBetween(lyrics.key, entry.key) && lyrics.sections.some((section) => section.chordPro)) {
        const query = transpositionQuery({ toKey: entry.key })
        await client.fetchQuery({ queryKey: [...lyricsKey(song), 'view', query], queryFn: () => api<Lyrics>(`${lyricsPath(song)}?${query}`, { church }), staleTime }).catch(missed)
      }
    }
  }
  return complete
}
