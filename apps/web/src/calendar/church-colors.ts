import { localStore } from './external-store'

/** Tonos (OKLCH) entre los que se elige el color de cada iglesia; los mismos del tema de la aplicación y algunos más. */
export const CHURCH_HUES = [
  { hue: 235, name: 'Azul' }, { hue: 178, name: 'Salvia' }, { hue: 272, name: 'Índigo' }, { hue: 310, name: 'Morado' },
  { hue: 15, name: 'Granate' }, { hue: 40, name: 'Naranja' }, { hue: 62, name: 'Ocre' }, { hue: 145, name: 'Verde' },
] as const

type Colors = Record<string, number>
const store = localStore<Colors>('plan-lyrics.churchColors', (raw) => { try { return JSON.parse(raw ?? '{}') as Colors } catch { return {} } }, (value) => JSON.stringify(value))

const hashed = (id: string) => CHURCH_HUES[[...id].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 997, 7) % CHURCH_HUES.length]!.hue
/** El color de un tono, con contraste suficiente para texto blanco encima. */
export const cssColor = (hue: number) => `oklch(0.5 0.12 ${hue})`

/** El color de cada iglesia: el que la persona eligió o, sin elegir, uno repartido por su id. Es de este dispositivo, como la apariencia. */
export function useChurchColors() {
  const colors = store.use()
  return {
    hueOf: (id: string) => colors[id] ?? hashed(id),
    colorOf: (id: string) => cssColor(colors[id] ?? hashed(id)),
    set: (id: string, hue: number) => store.set({ ...store.get(), [id]: hue }),
  }
}
export const churchColorsStore = store
