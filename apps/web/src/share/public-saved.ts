import type { PublicView } from './share-api'

/** Copia de un enlace guardada en este dispositivo para leerla sin conexión; quien abre el enlace no tiene cuenta. */
const key = (token: string) => `plan-lyrics.saved.${token}`

export function readSaved(token: string): PublicView | null {
  try { return JSON.parse(localStorage.getItem(key(token)) ?? 'null') as PublicView | null } catch { return null }
}
/** `false` si el almacenamiento no la aceptó (sin espacio o bloqueado). */
export function writeSaved(token: string, view: PublicView): boolean {
  try { localStorage.setItem(key(token), JSON.stringify(view)); return true } catch { return false }
}
export function clearSaved(token: string) {
  try { localStorage.removeItem(key(token)) } catch { /* ya no hay nada que quitar */ }
}
