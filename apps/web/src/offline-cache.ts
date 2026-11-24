import type { QueryClient } from '@tanstack/react-query'
import { getActiveChurch } from './calendar/active-church'
import { key as lyricsKey, path as lyricsPath } from './lyrics/lyrics-api'
import type { Lyrics } from './lyrics/lyrics-model'
import { key as setlistKey } from './setlist/setlist-api'
import type { Setlist } from './setlist/setlist-api'

/**
 * Lo último que la persona vio, guardado en el dispositivo para leerlo sin conexión (solo lectura).
 * Se restaura solo si es de la misma iglesia activa; la cuenta se comprueba al iniciar sesión y se borra al cerrarla.
 */
const KEY = 'plan-lyrics.cache'
const LIMIT = 2_500_000 // caracteres: localStorage ronda los 5 MB; pasado esto se conserva lo guardado antes
type Snapshot = { v: 1; owner: string | null; church: string | null; queries: Array<{ key: readonly unknown[]; data: unknown }> }

const read = (): Snapshot | null => {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Snapshot | null
    return parsed?.v === 1 && Array.isArray(parsed.queries) ? parsed : null
  } catch { return null }
}
let restored = false
let owner: string | null = null

/** Hay datos guardados de esta iglesia: la aplicación puede abrir sin conexión aunque Clerk no cargue. */
export const hasOfflineData = () => restored

/** Devuelve la caché guardada a la consulta, antes de pintar nada. */
export function restoreCache(client: QueryClient) {
  const snapshot = read()
  if (!snapshot || snapshot.church !== (getActiveChurch() ?? null)) return
  owner = snapshot.owner
  for (const query of snapshot.queries) client.setQueryData(query.key, query.data)
  restored = snapshot.queries.length > 0
}

/** Guarda la caché cuando cambia (con una pausa para no escribir en cada consulta). */
export function persistCache(client: QueryClient) {
  let timer: ReturnType<typeof setTimeout> | undefined
  client.getQueryCache().subscribe(() => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      const queries = client.getQueryCache().getAll().filter((query) => query.state.status === 'success' && query.state.data !== undefined).map((query) => ({ key: query.queryKey, data: query.state.data }))
      if (queries.length === 0) return
      const text = JSON.stringify({ v: 1, owner, church: getActiveChurch() ?? null, queries } satisfies Snapshot)
      if (text.length > LIMIT) return
      try { localStorage.setItem(KEY, text) } catch { /* sin espacio: queda lo guardado antes */ }
    }, 1500)
  })
}

/** Al iniciar sesión: si la caché es de otra cuenta se descarta; si no, se reclama para esta. */
export function claimCache(client: QueryClient, userId: string) {
  if (owner !== null && owner !== userId) { client.clear(); forgetCache() }
  owner = userId
}

/** Al cerrar sesión: nada de la cuenta se queda en el dispositivo. */
export function forgetCache() {
  try { localStorage.removeItem(KEY) } catch { /* ídem */ }
  restored = false
  owner = null
}

/** Deja listos para leer sin conexión el setlist y las letras de los próximos servicios de la iglesia activa. */
export async function saveUpcoming(client: QueryClient, api: <T>(path: string) => Promise<T>, serviceIds: ReadonlyArray<string>) {
  for (const id of serviceIds.slice(0, 6)) {
    const setlist = await client.fetchQuery({ queryKey: setlistKey(id), queryFn: () => api<Setlist>(`/api/services/${encodeURIComponent(id)}/setlist`), staleTime: 60_000 }).catch(() => null)
    for (const entry of setlist?.entries ?? []) {
      if (entry.song) await client.prefetchQuery({ queryKey: lyricsKey(entry.song.id), queryFn: () => api<Lyrics>(lyricsPath(entry.song!.id)), staleTime: 300_000 })
    }
  }
}
