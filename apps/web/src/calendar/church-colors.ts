import type { CSSProperties } from 'react'
import { localStore } from './external-store'

/** Los cinco temas de la aplicación (los mismos `--h` / `--c` de `ui/tokens.css`): de ahí salen los colores de las iglesias, y ninguno desentona. */
export const CHURCH_TONES = [
  { id: 'azul', name: 'Azul', h: 235, c: 0.11 },
  { id: 'salvia', name: 'Salvia', h: 178, c: 0.085 },
  { id: 'indigo', name: 'Índigo', h: 272, c: 0.15 },
  { id: 'ocre', name: 'Ocre', h: 62, c: 0.105 },
  { id: 'granate', name: 'Granate', h: 15, c: 0.13 },
] as const
export type ToneId = (typeof CHURCH_TONES)[number]['id']
const toneOf = (id: string | undefined) => CHURCH_TONES.find((tone) => tone.id === id)

type Colors = Record<string, string>
const store = localStore<Colors>('plan-lyrics.churchColors', (raw) => { try { return JSON.parse(raw ?? '{}') as Colors } catch { return {} } }, (value) => JSON.stringify(value))
export const churchColorsStore = store

/** Variables del tono para el elemento de una iglesia (`className="tone"`): el tema entero, con su croma y tono. */
export const toneStyle = (tone: { h: number; c: number }) => ({ '--h': tone.h, '--c': tone.c }) as CSSProperties

/**
 * El tono de cada iglesia en la vista «Todas»: el que la persona eligió o, sin elegir, uno repartido por el orden de sus iglesias (así dos
 * iglesias nunca empiezan con el mismo). Es de este dispositivo, como la apariencia.
 */
export function useChurchColors(churchIds: ReadonlyArray<string> = []) {
  const colors = store.use()
  const sorted = [...churchIds].sort()
  const tone = (id: string) => toneOf(colors[id]) ?? CHURCH_TONES[Math.max(0, sorted.indexOf(id)) % CHURCH_TONES.length]!
  return { tone, toneId: (id: string) => tone(id).id, style: (id: string) => toneStyle(tone(id)), set: (id: string, value: ToneId) => store.set({ ...store.get(), [id]: value }) }
}
